import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Agent } from '../../database/entities/agent.entity';
import { AgentFollowUp } from '../../database/entities/agent-follow-up.entity';
import { AgentContactLog } from '../../database/entities/agent-contact-log.entity';
import { User } from '../../database/entities/user.entity';

export interface CreateAgentResult {
  agent: Agent;
  isExistingAgent: boolean;
  existingStaff?: string;
}

@Injectable()
export class AgentsService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async getAgents(): Promise<any[]> {
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
        latest_actual_f.follow_up_date as lastFollowedUpDate
      FROM agents a
      LEFT JOIN users s ON a.assigned_staff_id = s.id
      LEFT JOIN (
        SELECT agent_id, next_follow_up_date,
               ROW_NUMBER() OVER(PARTITION BY agent_id ORDER BY created_at DESC) as rn
        FROM agent_follow_ups
      ) latest_f ON latest_f.agent_id = a.id AND latest_f.rn = 1
      LEFT JOIN (
        SELECT agent_id, follow_up_date,
               ROW_NUMBER() OVER(PARTITION BY agent_id ORDER BY follow_up_date DESC) as rn
        FROM agent_follow_ups
        WHERE follow_up_date IS NOT NULL
      ) latest_actual_f ON latest_actual_f.agent_id = a.id AND latest_actual_f.rn = 1
      ORDER BY a.created_at DESC
    `);

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
      lastFollowedUpDate: row.lastFollowedUpDate || null,
    }));
  }

  async getAgentById(id: number) {
    const agent = await this.dataSource.getRepository(Agent).findOne({
      where: { id },
      relations: {
        assigned_staff: true,
      },
    });
    if (!agent) throw new NotFoundException('Agent not found');

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
    let count = 0;
    for (const body of agents) {
      const normalized = {
        ...body,
        mobile: body.mobile ?? body.mobile_number ?? null,
      };
      try {
        await this.createAgent(normalized);
        count++;
      } catch (err: any) {
        console.error('Bulk import error for agent', normalized.mobile, err?.message ?? err);
      }
    }
    return { count };
  }

  async createAgent(body: any): Promise<CreateAgentResult> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const existingAgent = await manager.getRepository(Agent).findOne({
        where: { mobile_number: body.mobile },
        relations: { assigned_staff: true },
      });

      if (existingAgent) {
        if (body.followUpDate || body.priority || body.notes || body.rnr) {
          const followUp = manager.getRepository(AgentFollowUp).create({
            agent_id: existingAgent.id,
            follow_up_date: body.followUpDate || null,
            follow_up_time: body.followUpTime || null,
            priority: body.priority || null,
            rnr: body.rnr || null,
            notes: body.notes || null,
          });
          await manager.save(followUp);
        }

        return {
          agent: existingAgent,
          isExistingAgent: true,
          existingStaff: existingAgent.assigned_staff?.name ?? 'Unassigned',
        };
      }

      let assignedStaffId: number | undefined;
      if (body.userId) {
        const user = await manager.getRepository(User).findOne({ where: { id: body.userId } });
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

      if (body.followUpDate || body.priority || body.notes || body.rnr) {
        const followUp = manager.getRepository(AgentFollowUp).create({
          agent_id: savedAgent.id,
          follow_up_date: body.followUpDate || null,
          follow_up_time: body.followUpTime || null,
          priority: body.priority || null,
          rnr: body.rnr || null,
          notes: body.notes || null,
        });
        await manager.save(followUp);
      }

      return { agent: savedAgent, isExistingAgent: false };
    });
  }

  async updateAgentStatus(id: number, body: { status_name?: string }) {
    const agentRepo = this.dataSource.getRepository(Agent);
    const existingAgent = await agentRepo.findOne({ where: { id } });
    if (!existingAgent) throw new NotFoundException('Agent not found');

    if (body.status_name) {
      existingAgent.status = body.status_name;
    }

    return agentRepo.save(existingAgent);
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
  async addContactLog(agentId: number, body: { contact_type: string; subject?: string; message?: string; sent_by_id?: number }) {
    const agent = await this.dataSource.getRepository(Agent).findOne({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');

    let sentById = body.sent_by_id;
    if (!sentById) {
      const adminRole = await this.dataSource.getRepository(User).findOne({ where: { role: { name: 'Admin' } }, relations: { role: true } });
      if (adminRole) sentById = adminRole.id;
    }

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
  async addFollowUp(agentId: number, body: any) {
    const agent = await this.dataSource.getRepository(Agent).findOne({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');

    let createdById = body.created_by_id;
    if (!createdById) {
      const adminRole = await this.dataSource.getRepository(User).findOne({ where: { role: { name: 'Admin' } }, relations: { role: true } });
      if (adminRole) createdById = adminRole.id;
    }

    const repo = this.dataSource.getRepository(AgentFollowUp);
    const fu = repo.create({
      agent_id: agentId,
      follow_up_date: body.followUpDate,
      follow_up_time: body.followUpTime,
      contacted_via: body.contactedVia,
      next_follow_up_date: body.nextFollowUpDate,
      next_follow_up_time: body.nextFollowUpTime,
      priority: body.priority,
      rnr: body.rnr,
      notes: body.notes,
      created_by_id: createdById,
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
