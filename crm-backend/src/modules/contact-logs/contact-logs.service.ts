import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Not } from 'typeorm';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class ContactLogsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async getTrackableNumbers(userId: number) {
    // Update heartbeat
    await this.userRepo.update(userId, { device_last_sync_at: new Date() });

    // Fetch numbers from leads, agents, inbounds assigned to this user
    const leads = await this.dataSource.query(`SELECT mobile_number, whatsapp_number FROM leads WHERE assigned_staff_id = ?`, [userId]);
    const agents = await this.dataSource.query(`SELECT mobile_number, whatsapp_number FROM agents WHERE assigned_staff_id = ?`, [userId]);
    const inbounds = await this.dataSource.query(`SELECT mobile_number, whatsapp_number, manager_mobile, caretaker_mobile, security_contact, broker_mobile FROM inbounds WHERE assigned_staff_id = ?`, [userId]);

    const numbers = new Set<string>();
    
    const addNumbers = (rows: any[]) => {
      rows.forEach(row => {
        Object.values(row).forEach(val => {
          if (val && typeof val === 'string' && val.trim().length > 5) numbers.add(val.trim());
        });
      });
    };

    addNumbers(leads);
    addNumbers(agents);
    addNumbers(inbounds);

    return Array.from(numbers);
  }

  async recordDeviceHeartbeat(userId: number, deviceId: unknown) {
    if (typeof deviceId !== 'string' || deviceId.length < 8 || deviceId.length > 255) {
      return { registered: false };
    }

    await this.userRepo.update(userId, { device_last_sync_at: new Date() });
    return { registered: true };
  }

  async getLoggerDevices(requesterId: number) {
    const requester = await this.userRepo.findOne({
      where: { id: requesterId },
      relations: { role: true },
    });
    const roleName = requester?.role?.name || '';
    if (!['Admin', 'Super Admin', 'Manager'].includes(roleName)) {
      throw new ForbiddenException('Only admins and managers can view logger devices');
    }

    const users = await this.userRepo.find({
      where: { device_last_sync_at: Not(IsNull()) },
      relations: { role: true },
      order: { device_last_sync_at: 'DESC' },
    });
    const activeCutoff = Date.now() - 60 * 60 * 1000;

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name || 'Staff',
      last_sync_at: user.device_last_sync_at,
      is_active: new Date(user.device_last_sync_at).getTime() >= activeCutoff,
    }));
  }

  async syncCallLogs(userId: number, logs: unknown) {
    if (!Array.isArray(logs) || logs.length === 0) return { synced: 0 };

    // Fetch all assigned entities for this user to perform fuzzy matching
    const leads = await this.dataSource.query(`SELECT id, mobile_number, whatsapp_number, created_at FROM leads WHERE assigned_staff_id = ?`, [userId]);
    const agents = await this.dataSource.query(`SELECT id, mobile_number, whatsapp_number, created_at FROM agents WHERE assigned_staff_id = ?`, [userId]);
    const inbounds = await this.dataSource.query(`SELECT id, mobile_number, whatsapp_number, created_at FROM inbounds WHERE assigned_staff_id = ?`, [userId]);

    const clean = (n: string | null | undefined) => (n || '').replace(/[^0-9+]/g, '');
    const isMatch = (dbNum: string | null | undefined, callNum: string) => {
      const cDb = clean(dbNum);
      const cCall = clean(callNum);
      if (!cDb || !cCall) return false;
      return cDb.endsWith(cCall) || cCall.endsWith(cDb);
    };

    const leadLogs: any[] = [];
    const agentLogs: any[] = [];
    const inboundLogs: any[] = [];

    // Fetch existing logs to prevent duplicates
    const existingLogsRaw = await this.dataSource.query(`
      SELECT lead_id as entity_id, 'Lead' as type, created_at, call_direction, call_duration FROM contact_logs WHERE contact_type = 'call' AND sent_by_id = ?
      UNION ALL
      SELECT agent_id as entity_id, 'Agent' as type, created_at, call_direction, call_duration FROM agent_contact_logs WHERE contact_type = 'call' AND sent_by_id = ?
      UNION ALL
      SELECT inbound_id as entity_id, 'Inbound' as type, created_at, call_direction, call_duration FROM inbound_contact_logs WHERE contact_type = 'call' AND sent_by_id = ?
    `, [userId, userId, userId]);

    for (const log of logs as any[]) {
      if (!log || !log.phoneNumber || !log.timestamp) continue;

      const p = log.phoneNumber;
      const logDate = new Date(log.timestamp);
      let inserted = false;

      const isDuplicate = (entityId: number, type: string) => {
        return existingLogsRaw.some((e: any) => 
          e.entity_id === entityId && 
          e.type === type && 
          e.call_direction === log.direction && 
          e.call_duration === log.duration && 
          Math.abs(new Date(e.created_at).getTime() - logDate.getTime()) < 5000 // 5 seconds margin
        );
      };
      
      const leadMatch = leads.find((l: any) => isMatch(l.mobile_number, p) || isMatch(l.whatsapp_number, p));
      if (leadMatch && logDate >= new Date(leadMatch.created_at) && !isDuplicate(leadMatch.id, 'Lead')) {
        leadLogs.push([leadMatch.id, 'call', userId, log.duration, log.direction, logDate]);
        inserted = true;
      }

      if (!inserted) {
        const agentMatch = agents.find((a: any) => isMatch(a.mobile_number, p) || isMatch(a.whatsapp_number, p));
        if (agentMatch && logDate >= new Date(agentMatch.created_at) && !isDuplicate(agentMatch.id, 'Agent')) {
          agentLogs.push([agentMatch.id, 'call', userId, log.duration, log.direction, logDate]);
          inserted = true;
        }
      }

      if (!inserted) {
        const inboundMatch = inbounds.find((i: any) => isMatch(i.mobile_number, p) || isMatch(i.whatsapp_number, p));
        if (inboundMatch && logDate >= new Date(inboundMatch.created_at) && !isDuplicate(inboundMatch.id, 'Inbound')) {
          inboundLogs.push([inboundMatch.id, 'call', userId, log.duration, log.direction, logDate]);
          inserted = true;
        }
      }
    }

    let syncedCount = 0;
    if (leadLogs.length > 0) {
      const placeholders = leadLogs.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const result = await this.dataSource.query(
        `INSERT INTO contact_logs (lead_id, contact_type, sent_by_id, call_duration, call_direction, created_at) VALUES ${placeholders}`,
        leadLogs.flat()
      );
      syncedCount += leadLogs.length;
    }

    if (agentLogs.length > 0) {
      const placeholders = agentLogs.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const result = await this.dataSource.query(
        `INSERT INTO agent_contact_logs (agent_id, contact_type, sent_by_id, call_duration, call_direction, created_at) VALUES ${placeholders}`,
        agentLogs.flat()
      );
      syncedCount += agentLogs.length;
    }

    if (inboundLogs.length > 0) {
      const placeholders = inboundLogs.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const result = await this.dataSource.query(
        `INSERT INTO inbound_contact_logs (inbound_id, contact_type, sent_by_id, call_duration, call_direction, created_at) VALUES ${placeholders}`,
        inboundLogs.flat()
      );
      syncedCount += inboundLogs.length;
    }

    return { synced: syncedCount };
  }

  async getGlobalFeed() {
    // Uses UNION ALL to combine logs from all 3 tables
    const query = `
      SELECT 'Lead' as entity_type, l.id as entity_id, l.name as entity_name, c.contact_type, c.call_duration, c.call_direction, c.created_at, u.name as staff_name
      FROM contact_logs c JOIN leads l ON c.lead_id = l.id LEFT JOIN users u ON c.sent_by_id = u.id
      UNION ALL
      SELECT 'Agent' as entity_type, a.id as entity_id, a.name as entity_name, ac.contact_type, ac.call_duration, ac.call_direction, ac.created_at, u.name as staff_name
      FROM agent_contact_logs ac JOIN agents a ON ac.agent_id = a.id LEFT JOIN users u ON ac.sent_by_id = u.id
      UNION ALL
      SELECT 'Inbound' as entity_type, i.id as entity_id, i.property_title as entity_name, ic.contact_type, ic.call_duration, ic.call_direction, ic.created_at, u.name as staff_name
      FROM inbound_contact_logs ic JOIN inbounds i ON ic.inbound_id = i.id LEFT JOIN users u ON ic.sent_by_id = u.id
      ORDER BY created_at DESC
      LIMIT 100
    `;
    return this.dataSource.query(query);
  }
}
