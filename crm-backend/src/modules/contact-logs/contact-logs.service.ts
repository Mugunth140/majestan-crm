import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';

type CallDirection = 'Incoming' | 'Outgoing' | 'Missed';
type LoggerEvent = 'app_open' | 'sync_started' | 'sync_success' | 'sync_error' | 'permission_denied';

interface IncomingCallLog {
  sourceCallId: string;
  phoneNumber: string;
  direction: CallDirection;
  duration: number;
  timestamp: string;
}

interface DeviceReport {
  deviceId: string;
  deviceModel: string;
  androidVersion: string;
  appVersion: string;
  callLogPermission: boolean;
  event: LoggerEvent;
  syncedCount: number;
  error: string | null;
}

@Injectable()
export class ContactLogsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async getTrackableNumbers(userId: number) {
    await this.userRepo.update(userId, { device_last_sync_at: new Date() });

    const leads = await this.dataSource.query(`SELECT mobile_number, whatsapp_number FROM leads WHERE assigned_staff_id = ?`, [userId]);
    const agents = await this.dataSource.query(`SELECT mobile_number, whatsapp_number FROM agents WHERE assigned_staff_id = ?`, [userId]);
    const inbounds = await this.dataSource.query(`SELECT mobile_number, whatsapp_number, manager_mobile, caretaker_mobile, security_contact, broker_mobile FROM inbounds WHERE assigned_staff_id = ?`, [userId]);
    const numbers = new Set<string>();

    for (const rows of [leads, agents, inbounds]) {
      for (const row of rows) {
        for (const value of Object.values(row)) {
          if (typeof value === 'string' && value.trim().length > 5) numbers.add(value.trim());
        }
      }
    }
    return Array.from(numbers);
  }

  async recordDeviceHeartbeat(userId: number, body: unknown) {
    const report = this.parseDeviceReport(body);
    if (!report) return { registered: false };

    const now = new Date();
    const isAttempt = report.event === 'sync_started' || report.event === 'sync_success' || report.event === 'sync_error';
    const isSuccess = report.event === 'sync_success';
    const result = report.event === 'app_open' ? null : report.event.replace('sync_', '');

    await this.dataSource.query(
      `INSERT INTO logger_devices
        (user_id, device_id, device_model, android_version, app_version, call_log_permission, last_seen_at, last_sync_attempt_at, last_successful_sync_at, last_sync_result, last_sync_count, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         device_model = VALUES(device_model),
         android_version = VALUES(android_version),
         app_version = VALUES(app_version),
         call_log_permission = VALUES(call_log_permission),
         last_seen_at = VALUES(last_seen_at),
         last_sync_attempt_at = CASE WHEN VALUES(last_sync_attempt_at) IS NULL THEN last_sync_attempt_at ELSE VALUES(last_sync_attempt_at) END,
         last_successful_sync_at = CASE WHEN VALUES(last_successful_sync_at) IS NULL THEN last_successful_sync_at ELSE VALUES(last_successful_sync_at) END,
         last_sync_result = CASE WHEN VALUES(last_sync_result) IS NULL THEN last_sync_result ELSE VALUES(last_sync_result) END,
         last_sync_count = CASE WHEN VALUES(last_sync_result) IS NULL THEN last_sync_count ELSE VALUES(last_sync_count) END,
         last_error = CASE WHEN VALUES(last_sync_result) IS NULL THEN last_error ELSE VALUES(last_error) END`,
      [
        userId, report.deviceId, report.deviceModel, report.androidVersion, report.appVersion,
        report.callLogPermission, now, isAttempt ? now : null, isSuccess ? now : null,
        result, report.syncedCount, report.error,
      ],
    );
    await this.userRepo.update(userId, { device_last_sync_at: now });
    return { registered: true };
  }

  async getLoggerDevices(requesterId: number) {
    const requester = await this.userRepo.findOne({ where: { id: requesterId }, relations: { role: true } });
    if (!['Admin', 'Super Admin', 'Manager'].includes(requester?.role?.name || '')) {
      throw new ForbiddenException('Only admins and managers can view logger devices');
    }

    const rows = await this.dataSource.query(`
      SELECT d.id, d.device_id, d.device_model, d.android_version, d.app_version, d.call_log_permission,
             d.registered_at, d.last_seen_at, d.last_sync_attempt_at, d.last_successful_sync_at,
             d.last_sync_result, d.last_sync_count, d.last_error,
             u.id AS user_id, u.name AS staff_name, u.email AS staff_email, r.name AS staff_role
      FROM logger_devices d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY d.last_seen_at DESC
    `);
    const freshAfter = Date.now() - 60 * 60 * 1000;

    return rows.map((row: any) => {
      const seenAt = new Date(row.last_seen_at).getTime();
      const successfulAt = row.last_successful_sync_at ? new Date(row.last_successful_sync_at).getTime() : 0;
      const permissionGranted = Boolean(row.call_log_permission);
      const isFresh = seenAt >= freshAfter;
      const isHealthy = permissionGranted && successfulAt >= freshAfter && row.last_sync_result === 'success';
      const health = !permissionGranted
        ? 'permission_required'
        : row.last_sync_result === 'error'
          ? 'sync_error'
          : isHealthy
            ? 'healthy'
            : isFresh
              ? 'awaiting_sync'
              : 'offline';

      return {
        id: row.id,
        device_id: row.device_id,
        staff: { id: row.user_id, name: row.staff_name, email: row.staff_email, role: row.staff_role || 'Staff' },
        device_model: row.device_model,
        android_version: row.android_version,
        app_version: row.app_version,
        call_log_permission: permissionGranted,
        registered_at: row.registered_at,
        last_seen_at: row.last_seen_at,
        last_sync_attempt_at: row.last_sync_attempt_at,
        last_successful_sync_at: row.last_successful_sync_at,
        last_sync_count: Number(row.last_sync_count || 0),
        last_error: row.last_error,
        health,
        is_active: isFresh,
      };
    });
  }

  async syncCallLogs(userId: number, logs: unknown) {
    if (!Array.isArray(logs) || logs.length === 0) return { synced: 0 };

    const leads = await this.dataSource.query(`SELECT id, mobile_number, whatsapp_number, created_at FROM leads WHERE assigned_staff_id = ?`, [userId]);
    const agents = await this.dataSource.query(`SELECT id, mobile_number, whatsapp_number, created_at FROM agents WHERE assigned_staff_id = ?`, [userId]);
    const inbounds = await this.dataSource.query(`SELECT id, mobile_number, whatsapp_number, created_at FROM inbounds WHERE assigned_staff_id = ?`, [userId]);
    const clean = (value: string | null | undefined) => (value || '').replace(/[^0-9+]/g, '');
    const matches = (saved: string | null | undefined, observed: string) => {
      const left = clean(saved);
      const right = clean(observed);
      return Boolean(left && right && (left.endsWith(right) || right.endsWith(left)));
    };

    const sourceIds = new Set<string>();
    const leadLogs: unknown[][] = [];
    const agentLogs: unknown[][] = [];
    const inboundLogs: unknown[][] = [];
    for (const candidate of logs.slice(0, 500)) {
      const log = this.parseCallLog(candidate);
      if (!log || sourceIds.has(log.sourceCallId)) continue;
      sourceIds.add(log.sourceCallId);

      const callAt = new Date(log.timestamp);
      const lead = leads.find((item: any) => matches(item.mobile_number, log.phoneNumber) || matches(item.whatsapp_number, log.phoneNumber));
      if (lead && callAt >= new Date(lead.created_at)) {
        leadLogs.push([lead.id, 'call', userId, log.duration, log.direction, log.sourceCallId, callAt]);
        continue;
      }
      const agent = agents.find((item: any) => matches(item.mobile_number, log.phoneNumber) || matches(item.whatsapp_number, log.phoneNumber));
      if (agent && callAt >= new Date(agent.created_at)) {
        agentLogs.push([agent.id, 'call', userId, log.duration, log.direction, log.sourceCallId, callAt]);
        continue;
      }
      const inbound = inbounds.find((item: any) => matches(item.mobile_number, log.phoneNumber) || matches(item.whatsapp_number, log.phoneNumber));
      if (inbound && callAt >= new Date(inbound.created_at)) {
        inboundLogs.push([inbound.id, 'call', userId, log.duration, log.direction, log.sourceCallId, callAt]);
      }
    }

    let synced = 0;
    synced += await this.insertCallLogs('contact_logs', 'lead_id', leadLogs);
    synced += await this.insertCallLogs('agent_contact_logs', 'agent_id', agentLogs);
    synced += await this.insertCallLogs('inbound_contact_logs', 'inbound_id', inboundLogs);
    return { synced };
  }

  private async insertCallLogs(table: string, entityColumn: string, values: unknown[][]) {
    if (!values.length) return 0;
    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const result = await this.dataSource.query(
      `INSERT INTO ${table} (${entityColumn}, contact_type, sent_by_id, call_duration, call_direction, source_call_id, created_at)
       VALUES ${placeholders} ON DUPLICATE KEY UPDATE id = id`,
      values.flat(),
    );
    return Number(result?.affectedRows || 0);
  }

  private parseCallLog(candidate: unknown): IncomingCallLog | null {
    if (!candidate || typeof candidate !== 'object') return null;
    const log = candidate as Record<string, unknown>;
    const sourceCallId = typeof log.sourceCallId === 'string' ? log.sourceCallId.trim() : '';
    const phoneNumber = typeof log.phoneNumber === 'string' ? log.phoneNumber.trim() : '';
    const duration = log.duration;
    const timestamp = typeof log.timestamp === 'string' ? log.timestamp : '';
    if (!sourceCallId || sourceCallId.length > 255 || !phoneNumber || !['Incoming', 'Outgoing', 'Missed'].includes(log.direction as string) || !Number.isInteger(duration) || (duration as number) < 0 || Number.isNaN(new Date(timestamp).getTime())) return null;
    return { sourceCallId, phoneNumber, direction: log.direction as CallDirection, duration: duration as number, timestamp };
  }

  private parseDeviceReport(body: unknown): DeviceReport | null {
    if (!body || typeof body !== 'object') return null;
    const value = body as Record<string, unknown>;
    const text = (key: string, max: number) => typeof value[key] === 'string' ? value[key].trim().slice(0, max) : '';
    const event = value.event;
    const deviceId = text('deviceId', 255);
    if (!deviceId || deviceId.length < 8 || !['app_open', 'sync_started', 'sync_success', 'sync_error', 'permission_denied'].includes(event as string)) return null;
    const count = typeof value.syncedCount === 'number' && Number.isInteger(value.syncedCount) && value.syncedCount >= 0 ? value.syncedCount : 0;
    return {
      deviceId,
      deviceModel: text('deviceModel', 255) || 'Unknown device',
      androidVersion: text('androidVersion', 100) || 'Unknown Android',
      appVersion: text('appVersion', 100) || 'Unknown version',
      callLogPermission: value.callLogPermission === true,
      event: event as LoggerEvent,
      syncedCount: count,
      error: text('error', 500) || null,
    };
  }

  async getGlobalFeed() {
    return this.dataSource.query(`
      SELECT 'Lead' as entity_type, l.id as entity_id, l.name as entity_name, c.contact_type, c.call_duration, c.call_direction, c.created_at, u.name as staff_name FROM contact_logs c JOIN leads l ON c.lead_id = l.id LEFT JOIN users u ON c.sent_by_id = u.id
      UNION ALL SELECT 'Agent', a.id, a.name, ac.contact_type, ac.call_duration, ac.call_direction, ac.created_at, u.name FROM agent_contact_logs ac JOIN agents a ON ac.agent_id = a.id LEFT JOIN users u ON ac.sent_by_id = u.id
      UNION ALL SELECT 'Inbound', i.id, i.property_title, ic.contact_type, ic.call_duration, ic.call_direction, ic.created_at, u.name FROM inbound_contact_logs ic JOIN inbounds i ON ic.inbound_id = i.id LEFT JOIN users u ON ic.sent_by_id = u.id
      ORDER BY created_at DESC LIMIT 100
    `);
  }
}
