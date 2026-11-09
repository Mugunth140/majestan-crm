import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Agent } from '../../database/entities/agent.entity';
import { AgentFollowUp } from '../../database/entities/agent-follow-up.entity';
import { AgentContactLog } from '../../database/entities/agent-contact-log.entity';
import { User } from '../../database/entities/user.entity';
import { RecordEventsService } from '../record-events/record-events.service';

// Columns the agent page edits one at a time (PATCH /agents/:id).
const EDITABLE = [
  'name', 'company_name', 'mobile_number', 'whatsapp_number', 'email', 'city', 'state', 'partner_type',
  'property_category', 'commission_accepted', 'commission_type', 'commission_value', 'remarks',
] as const;

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export interface CreateAgentResult {
  agent: Agent;
  isExistingAgent: boolean;
  existingStaff?: string;
}

@Injectable()
export class AgentsService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @Optional() private readonly events?: EventEmitter2,
    @Optional() private readonly recordEvents?: RecordEventsService,
  ) {}

  /** Who an agent can be assigned to, and whether this user may reassign. */
  async staffList(user?: any) {
    const people = await this.dataSource.getRepository(User).find({
      where: { is_active: true }, relations: { department: true },
      select: { id: true, name: true, department: { id: true, name: true } }, order: { name: 'ASC' },
    });
    return {
      canAssign: !!user && user.role !== 'Staff',
      data: people.map((p) => ({ id: p.id, name: p.name, hint: p.department?.name ?? undefined })),
    };
  }

  async activity(id: number, user?: any) {
    await this.mustSee(id, user);
    return this.recordEvents?.activity('agent', id) ?? [];
  }

  private async mustSee(id: number, user?: any) {
    const agent = await this.dataSource.getRepository(Agent).findOne({ where: { id } });
    if (!agent || (user && user.role === 'Staff' && agent.assigned_staff_id !== user.id)) throw new NotFoundException('Agent not found');
    return agent;
  }

  /**
   * Saves the fields sent, by column name; null clears one. Status and the
   * assignee are recorded as their own events; staff can't reassign.
   */
  async patchAgent(id: number, body: Record<string, unknown>, user?: any) {
    const actorId = user?.id ?? null;
    const repo = this.dataSource.getRepository(Agent);
    const agent = await this.mustSee(id, user);
    const before: Record<string, unknown> = { ...agent };

    const fields = EDITABLE.filter((k) => k in body);
    for (const k of fields) {
      const v = body[k];
      if (k === 'commission_accepted') agent.commission_accepted = !!v;
      else (agent as any)[k] = typeof v === 'string' ? (v.trim() || null) : v ?? null;
    }
    if (fields.includes('name') && !agent.name) throw new BadRequestException('Name is required');
    if (fields.includes('mobile_number')) {
      if (!agent.mobile_number) throw new BadRequestException('Mobile number is required');
      if (agent.mobile_number !== before.mobile_number && await repo.findOne({ where: { mobile_number: agent.mobile_number } })) {
        throw new BadRequestException('Another agent already has this mobile number');
      }
    }

    let assigned: { from: number | null; to: number | null } | null = null;
    if ('assigned_staff_id' in body) {
      if (!user || user.role === 'Staff') throw new ForbiddenException('Only managers can reassign agents');
      const to = body.assigned_staff_id == null ? null : Number(body.assigned_staff_id);
      if (to !== null && !(await this.dataSource.getRepository(User).findOne({ where: { id: to, is_active: true } }))) {
        throw new BadRequestException('Choose an active staff member');
      }
      if (to !== agent.assigned_staff_id) assigned = { from: agent.assigned_staff_id ?? null, to };
      agent.assigned_staff_id = to as number;
    }
    const previousStatus = agent.status;
    if (typeof body.status === 'string' && body.status.trim()) agent.status = body.status.trim();

    const saved = await repo.save(agent);
    await this.recordEvents?.recordChanges('agent', id, actorId, before, saved as unknown as Record<string, unknown>, [...fields]);
    if (assigned) {
      const names = await this.dataSource.getRepository(User).find({
        where: [assigned.from, assigned.to].filter((x): x is number => !!x).map((uid) => ({ id: uid })), select: { id: true, name: true },
      });
      const name = (uid: number | null) => names.find((n) => n.id === uid)?.name ?? null;
      await this.recordEvents?.record({
        entity: 'agent', entityId: id, actorId, type: assigned.to === null ? 'unassigned' : 'assigned', from: name(assigned.from), to: name(assigned.to),
      });
    }
    if (saved.status !== previousStatus) {
      await this.recordEvents?.record({ entity: 'agent', entityId: id, actorId, type: 'status_changed', field: 'status', from: previousStatus, to: saved.status });
      await this.events?.emitAsync('partners.agent.status_changed', { entityId: id, actorId, from: previousStatus, to: saved.status });
    }
    return this.dataSource.getRepository(Agent).findOne({ where: { id }, relations: { assigned_staff: true } });
  }

  /**
   * The partners a user may see, as a condition on alias `a`; null when they
   * may see none. Shared by the partner list and the global search.
   */
  static scopeFor(user?: any): { where: string; params: any[] } | null {
    if (user && user.role === 'Staff') {
      const staffId = Number(user.id);
      return isFinite(staffId) ? { where: 'a.assigned_staff_id = ?', params: [staffId] } : null;
    }
    if (user && user.role === 'Team Lead') {
      const deptId = Number(user.department_id);
      return isFinite(deptId) ? { where: 'a.assigned_staff_id IN (SELECT id FROM users WHERE department_id = ?)', params: [deptId] } : null;
    }
    return { where: '1=1', params: [] };
  }

  async getAgents(user?: any): Promise<any[]> {
    const scope = AgentsService.scopeFor(user);
    if (!scope) return [];
    const roleWhere = scope.where;
    const params: any[] = [...scope.params];

    const rawAgents = await this.dataSource.query(`
      SELECT 
        a.id as rawId, 
        a.name, 
        a.company_name, 
        a.mobile_number as mobile, 
        a.email, 
        a.city, 
        a.partner_type as partnerType, 
        a.status, 
        a.created_at as createdAt,
        s.name as staff,
        latest_f.next_follow_up_date as nextFollowUpDate,
        latest_f.next_follow_up_time as nextFollowUpTime,
        latest_actual_f.follow_up_date as lastFollowedUpDate,
        latest_actual_f.follow_up_time as lastFollowedUpTime
      FROM agents a
      LEFT JOIN users s ON a.assigned_staff_id = s.id
      LEFT JOIN (
        SELECT agent_id, next_follow_up_date, next_follow_up_time,
               ROW_NUMBER() OVER(PARTITION BY agent_id ORDER BY created_at DESC) as rn
        FROM agent_follow_ups
      ) latest_f ON latest_f.agent_id = a.id AND latest_f.rn = 1
      LEFT JOIN (
        SELECT agent_id, follow_up_date, follow_up_time,
               ROW_NUMBER() OVER(PARTITION BY agent_id ORDER BY follow_up_date DESC) as rn
        FROM agent_follow_ups
        WHERE follow_up_date IS NOT NULL
      ) latest_actual_f ON latest_actual_f.agent_id = a.id AND latest_actual_f.rn = 1
      WHERE ${roleWhere}
      ORDER BY a.created_at DESC
    `, params);

    return rawAgents.map((row: any) => ({
      id: row.rawId,
      created_at: row.createdAt,
      name: row.name,
      email: row.email || '',
      mobile: row.mobile,
      company_name: row.company_name || '—',
      partner_type: row.partnerType || '—',
      staff: row.staff ?? 'Unassigned',
      status: row.status ?? 'New',
      nextFollowUpDate: row.nextFollowUpDate || null,
      nextFollowUpTime: row.nextFollowUpTime || null,
      lastFollowedUpDate: row.lastFollowedUpDate || null,
      lastFollowedUpTime: row.lastFollowedUpTime || null,
    }));
  }

  async getAgentById(id: number, user?: any) {
    const agent = await this.dataSource.getRepository(Agent).findOne({
      where: { id },
      relations: {
        assigned_staff: true,
      },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    if (user && user.role === 'Staff' && agent.assigned_staff_id !== user.id) {
      throw new NotFoundException('Agent not found');
    }

    const followUps = await this.dataSource.getRepository(AgentFollowUp).find({
      where: { agent_id: id },
      relations: { created_by: true },
      order: { created_at: 'DESC' },
    });

    const contactLogs = await this.dataSource.getRepository(AgentContactLog).find({
      where: { agent_id: id },
      relations: { sent_by: true },
      order: { created_at: 'DESC' },
    });

    return { ...agent, follow_ups: followUps, contact_logs: contactLogs };
  }

  async bulkCreateAgents(agents: any[]) {
    if (!agents || agents.length === 0) return { count: 0 };

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const normalizedAgents = agents.map(body => ({
        ...body,
        mobile: body.mobile ?? body.mobile_number ?? null,
      })).filter(a => a.mobile);

      if (normalizedAgents.length === 0) return { count: 0 };

      const mobiles = [...new Set(normalizedAgents.map(a => String(a.mobile)))];
      const existingAgents = await manager.getRepository(Agent)
        .createQueryBuilder('agent')
        .where('agent.mobile_number IN (:...mobiles)', { mobiles })
        .getMany();
      
      const existingMap = new Map();
      existingAgents.forEach(a => existingMap.set(a.mobile_number, a));

      const agentsToCreate = [];
      const rowToAgentMap = new Map();

      for (const row of normalizedAgents) {
        const mobile = String(row.mobile);
        if (existingMap.has(mobile)) {
          rowToAgentMap.set(row, existingMap.get(mobile));
        } else {
          const agent = manager.getRepository(Agent).create({
            name: row.name,
            company_name: row.company_name || null,
            mobile_number: mobile,
            whatsapp_number: row.whatsapp || null,
            email: row.email || null,
            city: row.city || null,
            state: row.state || null,
            partner_type: row.partner_type || null,
            property_category: row.property_category || null,
            commission_accepted: row.commission_accepted || false,
            commission_type: row.commission_type || null,
            commission_value: row.commission_value || null,
            remarks: row.remarks || null,
            status: 'New',
            assigned_staff_id: row.userId || null,
          });
          agentsToCreate.push({ agent, row });
        }
      }

      if (agentsToCreate.length > 0) {
        const entitiesToSave = agentsToCreate.map(item => item.agent);
        const savedEntities = await manager.save(Agent, entitiesToSave, { chunk: 1000 });
        for (let i = 0; i < agentsToCreate.length; i++) {
          rowToAgentMap.set(agentsToCreate[i].row, savedEntities[i]);
        }
      }

      const followUps = [];
      for (const row of normalizedAgents) {
        const agent = rowToAgentMap.get(row);
        if (!agent) continue;

        if (row.followUpDate || row.priority || row.notes || row.rnr) {
          followUps.push(
            manager.getRepository(AgentFollowUp).create({
              agent_id: agent.id,
              follow_up_date: row.followUpDate || null,
              follow_up_time: row.followUpTime || null,
              priority: row.priority || null,
              rnr: row.rnr || null,
              notes: row.notes || null,
            })
          );
        }
      }

      if (followUps.length > 0) {
        await manager.save(AgentFollowUp, followUps, { chunk: 1000 });
      }

      return { count: normalizedAgents.length };
    });
  }

  /** The agent with this exact mobile (as the add form sends it), with only what a repeat add would reveal. */
  async findByMobile(mobile: string): Promise<{ id: number; name: string; existingStaff: string } | null> {
    const value = mobile.trim();
    if (!value) return null;
    const agent = await this.dataSource.getRepository(Agent).findOne({ where: { mobile_number: value }, relations: { assigned_staff: true } });
    return agent ? { id: agent.id, name: agent.name, existingStaff: agent.assigned_staff?.name ?? 'Unassigned' } : null;
  }

  async createAgent(body: any, actorId: number | null = null): Promise<CreateAgentResult> {
    const result = await this.createAgentRecord(body, actorId);
    // partners@ "thanks for connecting" draft, after commit (only reaches partners with an email).
    if (!result.isExistingAgent) {
      await this.recordEvents?.record({ entity: 'agent', entityId: result.agent.id, actorId, type: 'created', to: result.agent.status });
      await this.events?.emitAsync('partners.agent.created', { entityId: result.agent.id, actorId });
    }
    return result;
  }

  /** The follow-up logged with a new agent, by whoever added them. */
  private firstFollowUp(agentId: number, body: any, actorId: number | null): Partial<AgentFollowUp> {
    return {
      agent_id: agentId,
      follow_up_date: body.followUpDate || today(),
      follow_up_time: body.followUpTime || null,
      contacted_via: body.contactedVia || null,
      next_follow_up_date: body.nextFollowUpDate || null,
      next_follow_up_time: body.nextFollowUpTime || null,
      priority: body.priority || null,
      rnr: body.rnr || null,
      notes: body.notes || null,
      created_by_id: actorId ?? undefined,
    };
  }

  private async createAgentRecord(body: any, actorId: number | null): Promise<CreateAgentResult> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const existingAgent = await manager.getRepository(Agent).findOne({
        where: { mobile_number: body.mobile },
        relations: { assigned_staff: true },
      });

      if (existingAgent) {
        if (body.followUpDate || body.contactedVia || body.priority || body.notes || body.rnr) {
          const followUp = manager.getRepository(AgentFollowUp).create(this.firstFollowUp(existingAgent.id, body, actorId));
          await manager.save(followUp);
        }

        return {
          agent: existingAgent,
          isExistingAgent: true,
          existingStaff: existingAgent.assigned_staff?.name ?? 'Unassigned',
        };
      }

      // The signed-in user (actorId), not the browser's `userId`, decides the default owner.
      let assignedStaffId: number | undefined;
      const requested = Number(body.assigned_staff_id ?? actorId ?? body.userId);
      if (Number.isInteger(requested) && requested > 0) {
        const user = await manager.getRepository(User).findOne({ where: { id: requested } });
        if (user) assignedStaffId = user.id;
      }

      const agentRepo = manager.getRepository(Agent);
      const agent = agentRepo.create({
        name: body.name,
        company_name: body.company_name || null,
        mobile_number: body.mobile,
        whatsapp_number: body.whatsapp || null,
        email: body.email || null,
        city: body.city || null,
        state: body.state || null,
        partner_type: body.partner_type || null,
        property_category: body.property_category || null,
        commission_accepted: body.commission_accepted || false,
        commission_type: body.commission_type || null,
        commission_value: body.commission_value || null,
        remarks: body.remarks || null,
        status: 'New',
        assigned_staff_id: assignedStaffId,
      });
      const savedAgent: Agent = await manager.save(agent);

      if (body.followUpDate || body.contactedVia || body.priority || body.notes || body.rnr) {
        const followUp = manager.getRepository(AgentFollowUp).create(this.firstFollowUp(savedAgent.id, body, actorId));
        await manager.save(followUp);
      }

      return { agent: savedAgent, isExistingAgent: false };
    });
  }

  async updateAgentStatus(id: number, body: { status_name?: string }, actorId: number | null = null) {
    const agentRepo = this.dataSource.getRepository(Agent);
    const existingAgent = await agentRepo.findOne({ where: { id } });
    if (!existingAgent) throw new NotFoundException('Agent not found');

    const previousStatus = existingAgent.status;
    if (body.status_name) {
      existingAgent.status = body.status_name;
    }

    const saved = await agentRepo.save(existingAgent);
    if (saved.status !== previousStatus) {
      await this.recordEvents?.record({ entity: 'agent', entityId: id, actorId, type: 'status_changed', field: 'status', from: previousStatus, to: saved.status });
      await this.events?.emitAsync('partners.agent.status_changed', { entityId: id, actorId, from: previousStatus, to: saved.status });
    }
    return saved;
  }

  async updateAgent(id: number, body: any) {
    return this.dataSource.transaction(async (manager) => {
      const agentRepo = manager.getRepository(Agent);
      const existingAgent = await agentRepo.findOne({ where: { id } });
      if (!existingAgent) throw new NotFoundException('Agent not found');

      if (body.mobile && body.mobile !== existingAgent.mobile_number) {
        const dup = await agentRepo.findOne({ where: { mobile_number: body.mobile } });
        if (dup) throw new Error('Mobile number already in use by another agent');
      }

      existingAgent.name = body.name ?? existingAgent.name;
      existingAgent.mobile_number = body.mobile ?? existingAgent.mobile_number;
      existingAgent.whatsapp_number = body.whatsapp ?? existingAgent.whatsapp_number;
      existingAgent.email = body.email ?? existingAgent.email;
      existingAgent.city = body.city ?? existingAgent.city;
      existingAgent.state = body.state ?? existingAgent.state;
      existingAgent.company_name = body.company_name ?? existingAgent.company_name;
      existingAgent.partner_type = body.partner_type ?? existingAgent.partner_type;
      existingAgent.property_category = body.property_category ?? existingAgent.property_category;
      existingAgent.commission_accepted = body.commission_accepted ?? existingAgent.commission_accepted;
      existingAgent.commission_type = body.commission_type ?? existingAgent.commission_type;
      existingAgent.commission_value = body.commission_value ?? existingAgent.commission_value;
      existingAgent.remarks = body.remarks ?? existingAgent.remarks;

      await manager.save(Agent, existingAgent);

      return existingAgent;
    });
  }

  async deleteAgent(id: number) {
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(AgentFollowUp).delete({ agent_id: id });
      await manager.getRepository(AgentContactLog).delete({ agent_id: id });
      await manager.getRepository(Agent).delete(id);
    });
  }

  // ── Contact Log ────────────────────────────────────────────────────────────
  async addContactLog(agentId: number, body: { contact_type: string; subject?: string; message?: string }, userId: number | null = null) {
    const agent = await this.dataSource.getRepository(Agent).findOne({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const sentById = userId ?? undefined;

    const log = this.dataSource.getRepository(AgentContactLog).create({
      agent_id: agentId,
      contact_type: body.contact_type,
      subject: body.subject,
      message: body.message,
      sent_by_id: sentById,
    });
    return this.dataSource.getRepository(AgentContactLog).save(log);
  }

  // ── Follow-Up CRUD ─────────────────────────────────────────────────────────
  async addFollowUp(agentId: number, body: any, userId: number | null = null) {
    const agent = await this.dataSource.getRepository(Agent).findOne({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');

    const repo = this.dataSource.getRepository(AgentFollowUp);
    const fu = repo.create({
      agent_id: agentId,
      // A follow-up logged without a date happened now.
      follow_up_date: body.followUpDate || today(),
      follow_up_time: body.followUpTime || null,
      contacted_via: body.contactedVia || null,
      next_follow_up_date: body.nextFollowUpDate || null,
      next_follow_up_time: body.nextFollowUpTime || null,
      priority: body.priority || null,
      rnr: body.rnr || null,
      notes: body.notes || null,
      created_by_id: userId ?? undefined,
    });
    return repo.save(fu);
  }

  async updateFollowUp(agentId: number, followUpId: number, body: any) {
    const repo = this.dataSource.getRepository(AgentFollowUp);
    const fu = await repo.findOne({ where: { id: followUpId, agent_id: agentId } });
    if (!fu) throw new NotFoundException('Follow-up not found');

    if (body.followUpDate !== undefined) fu.follow_up_date = body.followUpDate;
    if (body.followUpTime !== undefined) fu.follow_up_time = body.followUpTime;
    if (body.contactedVia !== undefined) fu.contacted_via = body.contactedVia;
    if (body.nextFollowUpDate !== undefined) fu.next_follow_up_date = body.nextFollowUpDate;
    if (body.nextFollowUpTime !== undefined) fu.next_follow_up_time = body.nextFollowUpTime;
    if (body.priority !== undefined) fu.priority = body.priority;
    if (body.rnr !== undefined) fu.rnr = body.rnr;
    if (body.notes !== undefined) fu.notes = body.notes;

    return repo.save(fu);
  }

  async deleteFollowUp(agentId: number, followUpId: number) {
    const repo = this.dataSource.getRepository(AgentFollowUp);
    const fu = await repo.findOne({ where: { id: followUpId, agent_id: agentId } });
    if (!fu) throw new NotFoundException('Follow-up not found');
    await repo.remove(fu);
    return { success: true };
  }
}
