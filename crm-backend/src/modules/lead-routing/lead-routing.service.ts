import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Lead } from '../../database/entities/lead.entity';
import { User } from '../../database/entities/user.entity';
import { RoutingHistory } from '../../database/entities/routing-history.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NON_QUEUEABLE_LEAD_STATUSES } from '../leads/lead-statuses';

@Injectable()
export class LeadRoutingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectDataSource('site') private readonly siteDataSource: DataSource,
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
      .andWhere('lead.status NOT IN (:...excluded)', { excluded: NON_QUEUEABLE_LEAD_STATUSES })
      .andWhere('(lead.lead_source IS NULL OR lead.lead_source != :websiteSource)', { websiteSource: 'Website – Property page' })
      .orderBy('lead.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Enrich each lead with previouslyHeldBy, releaseReason, daysInQueue
    if (items.length === 0) return { items: [], total, page, limit };

    const leadIds = items.map(i => i.id);
    
    // We want the latest history per lead
    // A quick way in MySQL is to get all history for these leads sorted, then pick first in JS
    const historyList = await this.dataSource
      .getRepository(RoutingHistory)
      .createQueryBuilder('rh')
      .leftJoinAndSelect('rh.from_user', 'fromUser')
      .where('rh.lead_id IN (:...leadIds)', { leadIds })
      .orderBy('rh.created_at', 'DESC')
      .getMany();

    const historyMap = new Map();
    historyList.forEach(h => {
      if (!historyMap.has(h.lead_id)) {
        historyMap.set(h.lead_id, h);
      }
    });

    const enriched = items.map((lead) => {
      const lastHistory = historyMap.get(lead.id);

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
    });

    return { items: enriched, total, page, limit };
  }

  // ── Enquiry Queue ──────────────────────────────────────────────────────────
  // One row per lead with >= 1 unacknowledged website enquiry, newest first.
  // Type rule: 'New' only when the lead has exactly one website inquiry and
  // it created the lead; everything else with an open enquiry is 'Repeat'.
  // Optional filters apply to the LATEST open website enquiry (the same row
  // the Purpose badge and Last Enquiry time are drawn from).
  async getEnquiryQueue(
    page: number,
    limit: number,
    filters?: { propertyType?: string; intent?: string; dateFrom?: string; dateTo?: string },
  ) {
    const skip = (page - 1) * limit;

    // Latest open website enquiry per lead (ROW_NUMBER pattern, as in getLeads).
    const latestJoin = `LEFT JOIN (
      SELECT lead_id, property_type, intent, created_at,
             ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY id DESC) AS rn
      FROM lead_inquiries WHERE source = 'website' AND acknowledged_at IS NULL
    ) lw ON lw.lead_id = l.id AND lw.rn = 1`;

    let filterConds = '';
    const filterParams: any[] = [];
    if (filters?.propertyType) {
      filterConds += ' AND lw.property_type = ?';
      filterParams.push(filters.propertyType);
    }
    if (filters?.intent === 'enquiry' || filters?.intent === 'site_visit') {
      filterConds += ' AND lw.intent = ?';
      filterParams.push(filters.intent);
    }
    if (filters?.dateFrom) {
      filterConds += ' AND DATE(lw.created_at) >= ?';
      filterParams.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      filterConds += ' AND DATE(lw.created_at) <= ?';
      filterParams.push(filters.dateTo);
    }

    const countRows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(DISTINCT l.id) AS total
       FROM leads l
       JOIN lead_inquiries i ON i.lead_id = l.id
         AND i.source = 'website' AND i.acknowledged_at IS NULL
       ${latestJoin}
       WHERE l.status NOT IN ('Not Interested', 'Dropped')${filterConds}`,
      filterParams,
    );
    const total = Number(countRows[0]?.total || 0);
    if (total === 0) return { items: [], total, page, limit };

    const rows: any[] = await this.dataSource.query(
      `SELECT l.id, l.name, l.mobile_number, l.email, l.status, l.department,
              l.lead_source, l.created_at, l.assigned_staff_id,
              s.name AS assigned_staff_name,
              -- All-time website enquiries for this lead (acknowledged or not):
              -- the repeat count must survive acknowledgement, while membership
              -- (the JOIN above) only sees unacknowledged rows.
              (SELECT COUNT(*) FROM lead_inquiries ia
               WHERE ia.lead_id = l.id AND ia.source = 'website') AS repeat_count,
              (SELECT MAX(ia.is_new_lead) FROM lead_inquiries ia
               WHERE ia.lead_id = l.id AND ia.source = 'website') AS has_new_lead_flag,
              MAX(i.created_at) AS last_enquiry_at
       FROM leads l
       JOIN lead_inquiries i ON i.lead_id = l.id
         AND i.source = 'website' AND i.acknowledged_at IS NULL
       LEFT JOIN users s ON s.id = l.assigned_staff_id
       ${latestJoin}
       WHERE l.status NOT IN ('Not Interested', 'Dropped')${filterConds}
       GROUP BY l.id
       ORDER BY last_enquiry_at DESC
       LIMIT ? OFFSET ?`,
      [...filterParams, limit, skip],
    );

    // Batch-resolve the latest website-enquiry property per lead (best effort:
    // a site-DB outage yields nulls, never a 500 — same contract as getLeadById).
    const leadIds = rows.map((r: any) => r.id);
    let latestByLead: Record<number, any> = {};
    try {
      const latest: any[] = await this.dataSource.query(
        `SELECT i.lead_id, i.property_id, i.property_code, i.property_slug,
                i.intent, i.visit_date, i.visit_slot
         FROM lead_inquiries i
         JOIN (SELECT lead_id, MAX(id) AS max_id FROM lead_inquiries
               WHERE lead_id IN (?) AND source = 'website' AND acknowledged_at IS NULL
               GROUP BY lead_id) m ON m.max_id = i.id`,
        [leadIds],
      );
      for (const row of latest) latestByLead[row.lead_id] = row;
    } catch {
      latestByLead = {};
    }

    let propertiesById: Record<number, any> = {};
    const propertyIds = [...new Set(
      Object.values(latestByLead).map((r: any) => r.property_id).filter(Boolean),
    )];
    if (propertyIds.length > 0) {
      try {
        const props: any[] = await this.siteDataSource.query(
          'SELECT id, title, property_code AS code FROM properties WHERE id IN (?)',
          [propertyIds],
        );
        for (const p of props) propertiesById[p.id] = p;
      } catch {
        propertiesById = {};
      }
    }

    const items = rows.map((r: any) => {
      const repeatCount = Number(r.repeat_count);
      const latest = latestByLead[r.id] ?? {};
      const prop = latest.property_id ? propertiesById[latest.property_id] : null;
      return {
        id: r.id,
        display_id: `L${String(r.id).padStart(5, '0')}`,
        name: r.name,
        mobile_number: r.mobile_number,
        email: r.email,
        status: r.status,
        department: r.department,
        lead_source: r.lead_source,
        created_at: r.created_at,
        assigned_staff_id: r.assigned_staff_id,
        assigned_staff_name: r.assigned_staff_name ?? null,
        type: repeatCount === 1 && Number(r.has_new_lead_flag) === 1 ? 'New' : 'Repeat',
        repeat_count: repeatCount,
        last_enquiry_at: r.last_enquiry_at,
        property_code: latest.property_code ?? null,
        property_title: prop?.title ?? null,
        intent: latest.intent ?? 'enquiry',
        visit_date: latest.visit_date ?? null,
        // visit_slot is SQL TIME: mysql2 returns 'HH:MM:SS'; Task 7 slices it.
        visit_slot: latest.visit_slot ?? null,
      };
    });

    return { items, total, page, limit };
  }

  // ── Claim ──────────────────────────────────────────────────────────────────
  // Role gate is fail-open on a missing role (preserves behavior for any
  // missed internal caller) and fail-closed on a present-but-wrong role.
  async claimLead(leadId: number, requestingUserId: number, requestingRole?: string) {
    if (requestingRole && !['Staff', 'Team Lead', 'Manager'].includes(requestingRole)) {
      throw new ForbiddenException('Your role cannot claim leads');
    }
    await this.dataSource.transaction(async (manager) => {
      const result = await manager.query(
        'UPDATE leads SET assigned_staff_id = ? WHERE id = ? AND assigned_staff_id IS NULL',
        [requestingUserId, leadId]
      );
      if (result.affectedRows === 0) {
        throw new BadRequestException('Lead already claimed or not found');
      }

      const lead = await manager.getRepository(Lead).findOne({ where: { id: leadId } });

      const rh = manager.getRepository(RoutingHistory).create({
        lead_id: leadId,
        event_type: 'Claimed',
        to_user_id: requestingUserId,
        from_user_id: null,
        department: lead?.department,
      });
      await manager.save(rh);

      // Acknowledge this lead's open website enquiries: claiming removes it
      // from the Enquiry Queue.
      await manager.query(
        `UPDATE lead_inquiries SET acknowledged_at = NOW(6)
         WHERE lead_id = ? AND source = 'website' AND acknowledged_at IS NULL`,
        [leadId],
      );

      const claimingUser = await manager.getRepository(User).findOne({ 
        where: { id: requestingUserId }, 
        relations: { department: true } 
      });

      await this.notificationsService.createNotification(
        requestingUserId,
        'Lead Claimed',
        `You claimed Lead #${leadId}`,
        'lead_claimed',
        leadId,
        'lead',
      );

      if (claimingUser?.department_id) {
        const teamLeads = await manager.createQueryBuilder(User, 'u')
          .leftJoin('u.role', 'r')
          .where('u.department_id = :deptId', { deptId: claimingUser.department_id })
          .andWhere('r.name = :role', { role: 'Team Lead' })
          .andWhere('u.is_active = 1')
          .getMany();

        for (const tl of teamLeads) {
          await this.notificationsService.createNotification(
            tl.id,
            'Lead Claimed',
            `${claimingUser.name} claimed Lead #${leadId}`,
            'lead_claimed_team',
            leadId,
            'lead',
          );
        }
      }
    });

    return { success: true };
  }

  // Role gate is fail-open on a missing role (preserves behavior for any
  // missed internal caller) and fail-closed on a present-but-wrong role.
  async assignLead(leadId: number, toUserId: number, actionedById: number | null, actionedRole?: string, feedback?: string) {
    if (actionedRole && !['Team Lead', 'Manager', 'Admin'].includes(actionedRole)) {
      throw new ForbiddenException('Your role cannot assign leads');
    }
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

    // Acknowledge this lead's open website enquiries: assigning removes it
    // from the Enquiry Queue.
    await this.dataSource.query(
      `UPDATE lead_inquiries SET acknowledged_at = NOW(6)
       WHERE lead_id = ? AND source = 'website' AND acknowledged_at IS NULL`,
      [leadId],
    );

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
  async siteVisitComplete(leadId: number, requestingUserId: number, feedback?: string) {
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
  async rnr5Release(leadId: number, requestingUserId: number, feedback?: string) {
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
  async convertLead(leadId: number, convertTo: 'inbound' | 'agent', feedback: string | undefined, requestingUserId: number) {
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

  // ── Return to Queue ────────────────────────────────────────────────────────
  async returnToQueue(leadId: number, requestingUserId: number, feedback?: string) {
    const leadRepo = this.dataSource.getRepository(Lead);
    const lead = await leadRepo.findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const prevAssignedId = lead.assigned_staff_id;

    lead.assigned_staff_id = null as unknown as number;
    await leadRepo.save(lead);

    const rh = this.dataSource.getRepository(RoutingHistory).create({
      lead_id: leadId,
      event_type: 'Returned to Queue',
      from_user_id: prevAssignedId ?? null,
      to_user_id: null,
      actioned_by_id: requestingUserId,
      feedback,
      department: lead.department,
    });
    await this.dataSource.getRepository(RoutingHistory).save(rh);

    return { success: true };
  }

  // ── Staff List ─────────────────────────────────────────────────────────────
  async getStaffList(department: string, requestingUserRole?: string, requestingUserDeptId?: number) {
    const qb = this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'role')
      .leftJoinAndSelect('u.department', 'dept')
      .where('u.is_active = 1');

    // Only show assignable roles: Manager, Team Lead, Staff
    qb.andWhere('role.name IN (:...assignableRoles)', { assignableRoles: ['Manager', 'Team Lead', 'Staff'] });

    if (requestingUserRole === 'Team Lead') {
      // Team Lead: only Staff in their own department
      qb.andWhere('role.name = :roleName', { roleName: 'Staff' });
      if (requestingUserDeptId) {
        qb.andWhere('u.department_id = :deptId', { deptId: requestingUserDeptId });
      }
    } else {
      // Admin and Manager: everyone (Manager + Team Lead + Staff),
      // optionally filtered by department param
      if (department && department.toLowerCase() !== 'all') {
        const searchTerm = department.toLowerCase().replace(' department', '').trim();
        qb.andWhere('LOWER(dept.name) LIKE :searchTerm', { searchTerm: `%${searchTerm}%` });
      }
    }

    const users = await qb.getMany();

    if (users.length === 0) return [];

    const userIds = users.map(u => u.id);
    const counts = await this.dataSource
      .getRepository(Lead)
      .createQueryBuilder('lead')
      .select('lead.assigned_staff_id', 'staffId')
      .addSelect('COUNT(lead.id)', 'count')
      .where('lead.assigned_staff_id IN (:...userIds)', { userIds })
      .groupBy('lead.assigned_staff_id')
      .getRawMany();

    const countMap = new Map();
    counts.forEach(c => countMap.set(c.staffId, Number(c.count)));

    return users.map(u => ({
      ...u,
      current_lead_count: countMap.get(u.id) || 0,
    }));
  }
}
