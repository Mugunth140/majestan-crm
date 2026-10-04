import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Lead } from '../../database/entities/lead.entity';
import { User } from '../../database/entities/user.entity';
import { RoutingHistory } from '../../database/entities/routing-history.entity';
import { LeadInquiry } from '../../database/entities/lead-inquiry.entity';
import { LeadFollowUp } from '../../database/entities/lead-follow-up.entity';
import { WebsiteEnquiryEvent } from '../../database/entities/website-enquiry-event.entity';
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
      // A lead stays out of Routing only while it has pending decisions;
      // converted/decided website leads flow into Routing normally; legacy
      // website leads surface in Routing once their backfilled events resolve.
      .andWhere(`NOT EXISTS (SELECT 1 FROM website_enquiry_events e WHERE (e.matched_lead_id = lead.id OR e.resolved_lead_id = lead.id) AND e.status = 'open')`)
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

  // ── Enquiry Queue (event-sourced) ───────────────────────────────────────────
  // One row per OPEN website_enquiry_event, newest first. With hold-everything
  // intake, new activity lands as events, so the queue reads open events —
  // not acknowledged inquiry rows.
  // Type rule: per-event — matched_lead_id IS NULL ? 'New' : 'Repeat'.
  // repeat_count answers "how many pending items for this person": the number
  // of OPEN events sharing this event's mobile_number (the queue's working
  // set — not an all-time lead counter).
  // Visibility: dead/converted leads' events stay visible (attach-keeps-status
  // rule) — only Dropped/Not Interested matched leads are excluded; unmatched
  // events (no lead) always show. Optional filters apply to each row's event.
  // Item shape: `id` is the matched lead id (null when unmatched — the
  // frontend uses `enquiry_id` for event endpoints and `id` to tell Convert
  // (null) from Accept (non-null) rows); `display_id` is L+lead when matched,
  // EQ+event when unmatched; `created_at` is the event's timestamp.
  async getEnquiryQueue(
    page: number,
    limit: number,
    filters?: { propertyType?: string; intent?: string; dateFrom?: string; dateTo?: string },
  ) {
    const skip = (page - 1) * limit;

    let filterConds = '';
    const filterParams: any[] = [];
    if (filters?.propertyType) {
      filterConds += ' AND e.property_type = ?';
      filterParams.push(filters.propertyType);
    }
    if (filters?.intent === 'enquiry' || filters?.intent === 'site_visit') {
      filterConds += ' AND e.intent = ?';
      filterParams.push(filters.intent);
    }
    if (filters?.dateFrom) {
      filterConds += ' AND DATE(e.created_at) >= ?';
      filterParams.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      filterConds += ' AND DATE(e.created_at) <= ?';
      filterParams.push(filters.dateTo);
    }

    const countRows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS total
       FROM website_enquiry_events e
       LEFT JOIN leads l ON l.id = e.matched_lead_id
       WHERE e.status = 'open'
         AND (l.id IS NULL OR l.status NOT IN ('Not Interested', 'Dropped'))${filterConds}`,
      filterParams,
    );
    const total = Number(countRows[0]?.total || 0);
    if (total === 0) return { items: [], total, page, limit };

    const rows: any[] = await this.dataSource.query(
      `SELECT e.id AS enquiry_id, e.created_at AS enquiry_at, e.name AS event_name,
              e.mobile_number, e.email, e.property_id, e.property_code, e.property_slug,
              e.property_type, e.intent, e.visit_date, e.visit_slot,
              e.matched_lead_id, e.status,
              l.id, l.name, l.mobile_number AS lead_mobile, l.email AS lead_email,
              l.status AS lead_status, l.department, l.lead_source,
              l.assigned_staff_id,
              s.name AS assigned_staff_name,
              -- Open events for this person: the queue's pending working set.
              (SELECT COUNT(*) FROM website_enquiry_events
               WHERE mobile_number = e.mobile_number AND status = 'open') AS repeat_count
       FROM website_enquiry_events e
       LEFT JOIN leads l ON l.id = e.matched_lead_id
       LEFT JOIN users s ON s.id = l.assigned_staff_id
       WHERE e.status = 'open'
         AND (l.id IS NULL OR l.status NOT IN ('Not Interested', 'Dropped'))${filterConds}
       ORDER BY e.id DESC
       LIMIT ? OFFSET ?`,
      [...filterParams, limit, skip],
    );

    // Batch-resolve property titles for the page's rows (best effort:
    // a site-DB outage yields nulls, never a 500 — same contract as getLeadById).
    let propertiesById: Record<number, any> = {};
    const propertyIds = [...new Set(
      rows.map((r: any) => r.property_id).filter(Boolean),
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
      const prop = r.property_id ? propertiesById[r.property_id] : null;
      const matched = r.matched_lead_id != null;
      return {
        // Matched lead id, or null for unmatched events (frontend uses
        // enquiry_id for event endpoints; null id => Convert, id => Accept).
        id: matched ? r.matched_lead_id : null,
        display_id: matched
          ? `L${String(r.id).padStart(5, '0')}`
          : `EQ${String(r.enquiry_id).padStart(5, '0')}`,
        // This row's own event (one row per open event).
        enquiry_id: r.enquiry_id,
        enquiry_at: r.enquiry_at,
        name: r.event_name ?? r.name ?? null,
        mobile_number: r.mobile_number ?? r.lead_mobile ?? null,
        email: r.email ?? r.lead_email ?? null,
        status: r.lead_status ?? '—',
        department: r.department ?? null,
        lead_source: r.lead_source ?? null,
        created_at: r.enquiry_at,
        assigned_staff_id: r.assigned_staff_id ?? null,
        assigned_staff_name: r.assigned_staff_name ?? null,
        // Per-event typing: unmatched => New, matched => Repeat.
        type: matched ? 'Repeat' : 'New',
        repeat_count: repeatCount,
        property_code: r.property_code ?? null,
        property_title: prop?.title ?? null,
        intent: r.intent ?? 'enquiry',
        visit_date: r.visit_date ?? null,
        // visit_slot is SQL TIME: mysql2 returns 'HH:MM:SS'; the frontend slices it.
        visit_slot: r.visit_slot ?? null,
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

  // ── Website Enquiry Events (decide-first intake) ────────────────────────────
  // Convert grants no ownership — it only queues the enquiry into routing —
  // so every known staff role may call it. Like claim/assign, the gate is
  // fail-open on a missing role (missed internal caller) and fail-closed on
  // a present-but-unknown role.
  private assertConvertRole(requestingRole?: string) {
    if (requestingRole && !['Staff', 'Team Lead', 'Manager', 'Admin'].includes(requestingRole)) {
      throw new ForbiddenException('Your role cannot convert enquiries');
    }
  }

  // Accept/Acknowledge decide another lead's fate, so they need Team
  // Lead/Manager/Admin. Same fail-open/fail-closed convention.
  private assertDeciderRole(requestingRole?: string) {
    if (requestingRole && !['Team Lead', 'Manager', 'Admin'].includes(requestingRole)) {
      throw new ForbiddenException('Your role cannot decide enquiries');
    }
  }

  // Row-lock the event, 404 when missing, 409 (with handledBy) when another
  // staff member already resolved it. The decider-name lookup is best effort:
  // a missing user row falls back to 'another staff member', never a 500.
  private async lockOpenEvent(manager: EntityManager, eventId: number) {
    const rows: any[] = await manager.query(
      'SELECT * FROM website_enquiry_events WHERE id = ? FOR UPDATE',
      [eventId],
    );
    const event = Array.isArray(rows) ? rows[0] : rows;
    if (!event) throw new NotFoundException('Enquiry event not found');
    if (event.status !== 'open') {
      let name = 'another staff member';
      if (event.decided_by) {
        try {
          const decider = await manager.getRepository(User).findOne({
            where: { id: event.decided_by },
          });
          if (decider?.name) name = decider.name;
        } catch {
          // Best effort only — keep the fallback name.
        }
      }
      throw new ConflictException({
        message: `Enquiry already handled by ${name}`,
        handledBy: event.decided_by ?? null,
      });
    }
    return event;
  }

  // One inquiry row per event — field mapping mirrors createLead's new-lead
  // branch (property link, intent, source website), except the double-write:
  // an event already carries its own intent, so visit fields land only on
  // site_visit rows, never as a duplicated base enquiry.
  private async inquiryFromEvent(
    manager: EntityManager,
    leadId: number,
    event: any,
    isNewLead: boolean,
  ) {
    const repo = manager.getRepository(LeadInquiry);
    return repo.save(
      repo.create({
        lead_id: leadId,
        property_id: event.property_id ?? null,
        property_code: event.property_code ?? null,
        property_slug: event.property_slug ?? null,
        property_type: event.property_type ?? null,
        intent: event.intent ?? 'enquiry',
        visit_date: event.intent === 'site_visit' ? (event.visit_date ?? null) : null,
        visit_slot: event.intent === 'site_visit' ? (event.visit_slot ?? null) : null,
        preferences: event.preferences ?? null,
        source: 'website',
        is_new_lead: isNewLead,
      }),
    );
  }

  // Visit follow-up fallback mirrors createLead: a booked visit always needs
  // its Site Visit follow-up, dated from the visit itself.
  private async visitFollowUp(manager: EntityManager, leadId: number, event: any) {
    if (event.intent !== 'site_visit') return null;
    const repo = manager.getRepository(LeadFollowUp);
    return repo.save(
      repo.create({
        lead_id: leadId,
        next_follow_up_date: event.visit_date ?? null,
        next_follow_up_time: event.visit_slot ?? null,
        purpose: 'Site Visit',
      }),
    );
  }

  // History shape mirrors assignLead (from/to/actioned_by) with to_user_id
  // null for queue-level events; attach/acknowledge point at the current
  // owner so the trail shows whose lead was touched.
  private async writeEventHistory(
    manager: EntityManager,
    lead: any,
    eventType: string,
    actionedById: number,
    toOwner: boolean,
  ) {
    const repo = manager.getRepository(RoutingHistory);
    return repo.save(
      repo.create({
        lead_id: lead.id,
        event_type: eventType,
        from_user_id: null,
        to_user_id: toOwner ? (lead.assigned_staff_id ?? null) : null,
        actioned_by_id: actionedById,
        department: lead.department ?? null,
      }),
    );
  }

  private async notifyLeadOwner(lead: any, deciderId: number, title: string, message: string, type: string) {
    if (lead.assigned_staff_id && lead.assigned_staff_id !== deciderId) {
      await this.notificationsService.createNotification(
        lead.assigned_staff_id,
        title,
        message,
        type,
        lead.id,
        'lead',
      );
    }
  }

  // ── Convert ── fresh mobile → unassigned lead, meanwhile-created mobile →
  // attach (kills the duplicate instead of creating a second lead).
  async convertEvent(eventId: number, requestingUserId: number, requestingRole?: string) {
    this.assertConvertRole(requestingRole);
    return this.dataSource.transaction(async (manager) => {
      const event = await this.lockOpenEvent(manager, eventId);
      const leadRepo = manager.getRepository(Lead);
      const eventRepo = manager.getRepository(WebsiteEnquiryEvent);

      const meanwhile = await leadRepo.findOne({
        where: { mobile_number: event.mobile_number },
      });
      if (meanwhile) {
        const inquiry = await this.inquiryFromEvent(manager, meanwhile.id, event, false);
        await this.visitFollowUp(manager, meanwhile.id, event);
        await eventRepo.save({
          ...event,
          status: 'attached',
          resolved_lead_id: meanwhile.id,
          decided_by: requestingUserId,
          decided_at: new Date(),
        });
        await this.writeEventHistory(manager, meanwhile, 'Enquiry Attached', requestingUserId, true);
        return { leadId: meanwhile.id, converted: 1 };
      }

      // Status rule copied from createLead's new-lead branch.
      const lead = await leadRepo.save(
        leadRepo.create({
          name: event.name || 'Unknown',
          mobile_number: event.mobile_number,
          email: event.email ?? null,
          whatsapp_number: event.whatsapp_number ?? null,
          city: event.city ?? null,
          lead_source: 'Website – Property page',
          status: event.intent === 'site_visit' ? 'Site Visit Scheduled' : 'New Lead',
        }),
      );

      // Resolve the triggering event plus every other open same-mobile event
      // (a second property enquiry may have landed while this one waited).
      const siblings: any[] = await eventRepo.find({
        where: { mobile_number: event.mobile_number, status: 'open' },
      });
      if (!siblings.some((e) => e.id === event.id)) siblings.unshift(event);

      let converted = 0;
      for (const sibling of siblings) {
        await this.inquiryFromEvent(manager, lead.id, sibling, true);
        await this.visitFollowUp(manager, lead.id, sibling);
        await eventRepo.save({
          ...sibling,
          status: 'converted',
          resolved_lead_id: lead.id,
          decided_by: requestingUserId,
          decided_at: new Date(),
        });
        converted += 1;
      }
      await this.writeEventHistory(manager, lead, 'Queued', requestingUserId, false);
      return { leadId: lead.id, converted };
    });
  }

  // ── Accept (attach) ── matched enquiries only; lead status untouched.
  async acceptEvent(eventId: number, requestingUserId: number, requestingRole?: string) {
    this.assertDeciderRole(requestingRole);
    return this.dataSource.transaction(async (manager) => {
      const event = await this.lockOpenEvent(manager, eventId);
      if (!event.matched_lead_id) {
        throw new BadRequestException('only matched enquiries can be attached — convert the others');
      }
      const lead = await manager.getRepository(Lead).findOne({
        where: { id: event.matched_lead_id },
      });
      if (!lead) throw new NotFoundException('Matched lead not found');

      const inquiry = await this.inquiryFromEvent(manager, lead.id, event, false);
      await this.visitFollowUp(manager, lead.id, event);
      // Lead status deliberately untouched — even Dropped/Converted: attaching
      // evidence must never resurrect or rewrite lifecycle state.
      await manager.getRepository(WebsiteEnquiryEvent).save({
        ...event,
        status: 'attached',
        resolved_lead_id: lead.id,
        decided_by: requestingUserId,
        decided_at: new Date(),
      });
      await this.writeEventHistory(manager, lead, 'Enquiry Attached', requestingUserId, true);
      const label = event.property_code ?? event.property_slug ?? `#${event.property_id ?? 'N/A'}`;
      await this.notifyLeadOwner(
        lead,
        requestingUserId,
        'Website enquiry attached',
        `Website enquiry for property ${label} attached to Lead #${lead.id}`,
        'lead_enquiry_attached',
      );
      return { leadId: lead.id, inquiryId: inquiry.id };
    });
  }

  // ── Acknowledge ── no inquiry row; records that staff saw and dismissed it.
  // Works on ANY open event, including junk new enquiries with no matched
  // lead: with no lead there is no history row to attach and no owner to
  // notify, so both are skipped.
  async acknowledgeEvent(eventId: number, requestingUserId: number, requestingRole?: string) {
    this.assertDeciderRole(requestingRole);
    return this.dataSource.transaction(async (manager) => {
      const event = await this.lockOpenEvent(manager, eventId);
      const lead = event.matched_lead_id
        ? await manager.getRepository(Lead).findOne({
            where: { id: event.matched_lead_id },
          })
        : null;
      if (event.matched_lead_id && !lead) throw new NotFoundException('Matched lead not found');

      await manager.getRepository(WebsiteEnquiryEvent).save({
        ...event,
        status: 'acknowledged',
        resolved_lead_id: lead ? lead.id : null,
        decided_by: requestingUserId,
        decided_at: new Date(),
      });
      if (event.matched_lead_id && lead) {
        await this.writeEventHistory(manager, lead, 'Enquiry Acknowledged', requestingUserId, true);
        const label = event.property_code ?? event.property_slug ?? `#${event.property_id ?? 'N/A'}`;
        await this.notifyLeadOwner(
          lead,
          requestingUserId,
          'Website enquiry acknowledged',
          `Website enquiry for property ${label} acknowledged on Lead #${lead.id}`,
          'lead_enquiry_acknowledged',
        );
      }
      return { leadId: lead ? lead.id : null, acknowledged: 1 };
    });
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
