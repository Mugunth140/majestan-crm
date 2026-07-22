import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Lead } from '../../database/entities/lead.entity';
import { User } from '../../database/entities/user.entity';
import { RoutingHistory } from '../../database/entities/routing-history.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LeadRoutingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Queue ──────────────────────────────────────────────────────────────────
  async getQueue(department: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.dataSource
      .getRepository(Lead)
      .createQueryBuilder('lead')
      .where('lead.assigned_staff_id IS NULL')
      .andWhere('lead.department = :department', { department })
      .orderBy('lead.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Enrich each lead with previouslyHeldBy, releaseReason, daysInQueue
    const enriched = await Promise.all(
      items.map(async (lead) => {
        const lastHistory = await this.dataSource
          .getRepository(RoutingHistory)
          .createQueryBuilder('rh')
          .leftJoinAndSelect('rh.from_user', 'fromUser')
          .where('rh.lead_id = :leadId', { leadId: lead.id })
          .orderBy('rh.created_at', 'DESC')
          .getOne();

        const referenceDate = lastHistory ? lastHistory.created_at : lead.created_at;
        const daysInQueue = Math.floor(
          (Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          ...lead,
          previously_held_by: lastHistory?.from_user?.name ?? null,
          release_reason: lastHistory?.event_type ?? null,
          days_in_queue: daysInQueue,
        };
      }),
    );

    return { items: enriched, total, page, limit };
  }

  // ── Claim ──────────────────────────────────────────────────────────────────
  async claimLead(leadId: number, requestingUserId: number) {
    const leadRepo = this.dataSource.getRepository(Lead);
    const lead = await leadRepo.findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const prevAssignedId = lead.assigned_staff_id;

    lead.assigned_staff_id = requestingUserId;
    const updated = await leadRepo.save(lead);

    // Insert routing history
    const rh = this.dataSource.getRepository(RoutingHistory).create({
      lead_id: leadId,
      event_type: 'Claimed',
      to_user_id: requestingUserId,
      from_user_id: prevAssignedId ?? null,
      department: lead.department,
    });
    await this.dataSource.getRepository(RoutingHistory).save(rh);

    // Fetch claiming user + their team lead
    const claimingUser = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: requestingUserId }, relations: { department: true } });

    // Notify claiming staff
    await this.notificationsService.createNotification(
      requestingUserId,
      'Lead Claimed',
      `You claimed Lead #${leadId}`,
      'lead_claimed',
      leadId,
      'lead',
    );

    // Notify their team lead(s) — users in same department with Team Lead role
    if (claimingUser?.department_id) {
      const teamLeads = await this.dataSource
        .getRepository(User)
        .createQueryBuilder('u')
        .leftJoinAndSelect('u.role', 'role')
        .where('u.department_id = :deptId', { deptId: claimingUser.department_id })
        .andWhere('role.name = :roleName', { roleName: 'Team Lead' })
        .andWhere('u.is_active = 1')
        .getMany();

      for (const tl of teamLeads) {
        await this.notificationsService.createNotification(
          tl.id,
          'Lead Claimed by Staff',
          `Staff ${claimingUser.name} claimed Lead #${leadId}`,
          'lead_claimed',
          leadId,
          'lead',
        );
      }
    }

    return updated;
  }

  // ── Assign ─────────────────────────────────────────────────────────────────
  async assignLead(leadId: number, toUserId: number, actionedById: number, feedback?: string) {
    const leadRepo = this.dataSource.getRepository(Lead);
    const lead = await leadRepo.findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const prevAssignedId = lead.assigned_staff_id;

    lead.assigned_staff_id = toUserId;
    const updated = await leadRepo.save(lead);

    const rh = this.dataSource.getRepository(RoutingHistory).create({
      lead_id: leadId,
      event_type: 'Assigned',
      to_user_id: toUserId,
      from_user_id: prevAssignedId ?? null,
      actioned_by_id: actionedById,
      feedback: feedback ?? null,
      department: lead.department,
    });
    await this.dataSource.getRepository(RoutingHistory).save(rh);

    // Notify assigned staff
    await this.notificationsService.createNotification(
      toUserId,
      'Lead Assigned',
      `Lead #${leadId} has been assigned to you`,
      'lead_assigned',
      leadId,
      'lead',
    );

    return updated;
  }

  // ── Site Visit Complete → Transfer to Sales ────────────────────────────────
  async siteVisitComplete(leadId: number, requestingUserId: number, feedback: string) {
    const leadRepo = this.dataSource.getRepository(Lead);
    const lead = await leadRepo.findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.department !== 'telecalling') {
      throw new BadRequestException('Lead is not in the telecalling department');
    }
    if (lead.status !== 'Site Visit Completed') {
      throw new BadRequestException('Lead status must be "Site Visit Completed"');
    }

    const prevAssignedId = lead.assigned_staff_id;

    lead.department = 'sales';
    lead.assigned_staff_id = null as unknown as number;
    await leadRepo.save(lead);

    const rh = this.dataSource.getRepository(RoutingHistory).create({
      lead_id: leadId,
      event_type: 'Auto-transferred',
      from_user_id: prevAssignedId ?? null,
      to_user_id: null,
      actioned_by_id: requestingUserId,
      feedback,
      department: 'sales',
    });
    await this.dataSource.getRepository(RoutingHistory).save(rh);

    // Notify all Sales department users + their team leads
    const salesDeptUsers = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.department', 'dept')
      .leftJoinAndSelect('u.role', 'role')
      .where('dept.name = :deptName', { deptName: 'Sales' })
      .andWhere('u.is_active = 1')
      .getMany();

    const salesTeamLeadIds = new Set<number>();
    for (const u of salesDeptUsers) {
      await this.notificationsService.createNotification(
        u.id,
        'New Lead in Sales Queue',
        `Lead #${leadId} has been transferred to Sales — Site Visit Completed`,
        'lead_transferred',
        leadId,
        'lead',
      );
      if ((u as any).role?.name === 'Team Lead') {
        salesTeamLeadIds.add(u.id);
      }
    }
  }

  // ── RNR5 Release ───────────────────────────────────────────────────────────
  async rnr5Release(leadId: number, requestingUserId: number, feedback: string) {
    const leadRepo = this.dataSource.getRepository(Lead);
    const lead = await leadRepo.findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.rnr_consecutive_count < 5) {
      throw new BadRequestException('Lead does not have 5 consecutive RNR calls');
    }

    const prevAssignedId = lead.assigned_staff_id;

    lead.assigned_staff_id = null as unknown as number;
    lead.rnr_consecutive_count = 0;
    await leadRepo.save(lead);

    const rh = this.dataSource.getRepository(RoutingHistory).create({
      lead_id: leadId,
      event_type: 'Auto-unassigned',
      from_user_id: prevAssignedId ?? null,
      to_user_id: null,
      actioned_by_id: requestingUserId,
      feedback,
      department: lead.department,
    });
    await this.dataSource.getRepository(RoutingHistory).save(rh);

    // Notify released staff
    if (prevAssignedId) {
      await this.notificationsService.createNotification(
        prevAssignedId,
        'Lead Unassigned (RNR5)',
        `Lead #${leadId} has been unassigned due to 5 consecutive RNR calls`,
        'rnr5_unassigned',
        leadId,
        'lead',
      );

      // Notify their team lead
      const releasedUser = await this.dataSource
        .getRepository(User)
        .findOne({ where: { id: prevAssignedId } });

      if (releasedUser?.department_id) {
        const teamLeads = await this.dataSource
          .getRepository(User)
          .createQueryBuilder('u')
          .leftJoinAndSelect('u.role', 'role')
          .where('u.department_id = :deptId', { deptId: releasedUser.department_id })
          .andWhere('role.name = :roleName', { roleName: 'Team Lead' })
          .andWhere('u.is_active = 1')
          .getMany();

        for (const tl of teamLeads) {
          await this.notificationsService.createNotification(
            tl.id,
            'Lead Auto-unassigned (RNR5)',
            `Lead #${leadId} was unassigned from ${releasedUser.name} after 5 RNR calls`,
            'rnr5_unassigned',
            leadId,
            'lead',
          );
        }
      }
    }
  }

  // ── Convert ────────────────────────────────────────────────────────────────
  async convertLead(leadId: number, convertTo: 'inbound' | 'agent', feedback: string, requestingUserId: number) {
    const leadRepo = this.dataSource.getRepository(Lead);
    const lead = await leadRepo.findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const prevAssignedId = lead.assigned_staff_id;

    lead.converted_to = convertTo;
    lead.converted_at = new Date();
    lead.assigned_staff_id = null as unknown as number;
    lead.status = 'Converted';
    await leadRepo.save(lead);

    const rh = this.dataSource.getRepository(RoutingHistory).create({
      lead_id: leadId,
      event_type: 'Converted',
      from_user_id: prevAssignedId ?? null,
      to_user_id: null,
      actioned_by_id: requestingUserId,
      feedback,
      department: lead.department,
    });
    await this.dataSource.getRepository(RoutingHistory).save(rh);

    // Notify converting staff
    await this.notificationsService.createNotification(
      requestingUserId,
      'Lead Converted',
      `Lead #${leadId} has been converted to ${convertTo}`,
      'lead_converted',
      leadId,
      'lead',
    );

    // Notify all Managers and Admins
    const managersAndAdmins = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'role')
      .where('role.name IN (:...roles)', { roles: ['Manager', 'Admin'] })
      .andWhere('u.is_active = 1')
      .getMany();

    for (const u of managersAndAdmins) {
      if (u.id !== requestingUserId) {
        await this.notificationsService.createNotification(
          u.id,
          'Lead Converted',
          `Lead #${leadId} was converted to ${convertTo}`,
          'lead_converted',
          leadId,
          'lead',
        );
      }
    }
  }

  // ── Routing History ────────────────────────────────────────────────────────
  async getHistory(filters: {
    department?: string;
    from_date?: string;
    to_date?: string;
    staff_id?: number;
    event_type?: string;
    page: number;
    limit: number;
  }) {
    const { department, from_date, to_date, staff_id, event_type, page, limit } = filters;
    const skip = (page - 1) * limit;

    const qb = this.dataSource
      .getRepository(RoutingHistory)
      .createQueryBuilder('rh')
      .leftJoinAndSelect('rh.lead', 'lead')
      .leftJoinAndSelect('rh.from_user', 'fromUser')
      .leftJoinAndSelect('rh.to_user', 'toUser')
      .leftJoinAndSelect('rh.actioned_by', 'actionedBy')
      .orderBy('rh.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (department) {
      qb.andWhere('rh.department = :department', { department });
    }
    if (from_date) {
      qb.andWhere('rh.created_at >= :from_date', { from_date });
    }
    if (to_date) {
      qb.andWhere('rh.created_at <= :to_date', { to_date: to_date + ' 23:59:59' });
    }
    if (staff_id) {
      qb.andWhere(
        '(rh.from_user_id = :staff_id OR rh.to_user_id = :staff_id)',
        { staff_id },
      );
    }
    if (event_type) {
      qb.andWhere('rh.event_type = :event_type', { event_type });
    }

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, limit };
  }

  // ── Staff List ─────────────────────────────────────────────────────────────
  async getStaffList(department: string) {
    const qb = this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'role')
      .leftJoinAndSelect('u.department', 'dept')
      .where('u.is_active = 1');

    if (department && department.toLowerCase() !== 'all') {
      const searchTerm = department.toLowerCase().replace(' department', '').trim();
      qb.andWhere('LOWER(dept.name) LIKE :searchTerm', { searchTerm: `%${searchTerm}%` });
    }

    const users = await qb.getMany();

    // For each user, count their current assigned leads
    const enriched = await Promise.all(
      users.map(async (u) => {
        const leadCount = await this.dataSource
          .getRepository(Lead)
          .count({ where: { assigned_staff_id: u.id } });
        return { ...u, current_lead_count: leadCount };
      }),
    );

    return enriched;
  }
}
