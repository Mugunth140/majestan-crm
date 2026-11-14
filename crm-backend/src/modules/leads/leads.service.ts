import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { leadScopeSql } from './lead-scope';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { isQueuedWebsiteSource } from './website-sources';
import { phoneDigits } from '../search/phone-digits';
import { matchCriteria, NO_CRITERIA, projectMatchQuery, propertyMatchQuery, SIMILAR_WHEN, similarCriteria } from './auto-match';
import { photoUrl, propertyShareName } from './share/listing-data';
import { LeadSource } from '../../database/entities/lead-source.entity';
import { Lead } from '../../database/entities/lead.entity';
import { LeadFollowUp } from '../../database/entities/lead-follow-up.entity';
import { LeadInquiry } from '../../database/entities/lead-inquiry.entity';
import { ContactLog } from '../../database/entities/contact-log.entity';
import { User } from '../../database/entities/user.entity';
import { LeadDocument } from '../../database/entities/lead-document.entity';
import { WebsiteEnquiryEvent } from '../../database/entities/website-enquiry-event.entity';
import { NON_QUEUEABLE_LEAD_STATUSES, SALES_PIPELINE_STATUSES } from './lead-statuses';
import { transferLeadToSales } from '../lead-routing/transfer-to-sales';
import { NotificationsService } from '../notifications/notifications.service';
import { LeadEventsService } from './lead-events.service';
import { S3Client } from 'bun';
import { extname } from 'path';
import { fetchWatermarkedImage, isImageMimetype } from '../../common/imgproxy-watermark';
import { WEBSITE } from './share/listing-data';

export interface CreateLeadResult {
  lead: Lead | null;
  isExistingCustomer: boolean;
  existingStaff?: string;
  eventId?: number;
}

export interface DuplicateLeadInfo {
  id: number;
  displayId: string;
  name: string;
  status: string;
  staff: string;
}

/** The website project a requirement came from (project enquiry forms keep it in preferences). */
export function inquiryProjectId(inquiry: { preferences?: unknown; [key: string]: any } | null | undefined): number | null {
  let prefs = inquiry?.preferences as unknown;
  if (typeof prefs === 'string') {
    try { prefs = JSON.parse(prefs); } catch { return null; }
  }
  const id = Number((prefs as { projectId?: unknown } | null)?.projectId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** The newest requirement linked to a website property or project. */
export function pickPropertyLink(inquiries?: Array<{ id: number; property_id?: number | null; [key: string]: any }> | null) {
  const linked = (inquiries ?? []).filter((i) => i.property_id || inquiryProjectId(i));
  if (linked.length === 0) return null;
  return linked.sort((a, b) => b.id - a.id)[0];
}

// Edits to these show on the lead Timeline (entity column names).
const LEAD_TRACKED_FIELDS = [
  'name', 'mobile_number', 'whatsapp_number', 'email', 'city', 'address', 'lead_source',
  'commission', 'commission_remarks', 'is_referral', 'referred_by_name', 'referred_by_contact',
];
const INQUIRY_TRACKED_FIELDS = [
  'purchase_type', 'property_category', 'property_type', 'funder', 'project_list', 'city_id',
  'sub_locations', 'purchase_timeline', 'qualification_purpose', 'decision_maker', 'preferences',
];

/** A JSON column that may arrive as text (raw queries) or parsed. */
function jsonOf(v: unknown): any {
  if (typeof v !== 'string') return v ?? null;
  try { return JSON.parse(v); } catch { return null; }
}
const listOf = (v: unknown): string[] => { const x = jsonOf(v); return Array.isArray(x) ? x.map(String) : []; };
function budgetOf(prefs: unknown): { minBudget: number | null; maxBudget: number | null } {
  const p = jsonOf(prefs) ?? {};
  const n = (x: unknown) => (x == null || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));
  return { minBudget: n(p.minBudget), maxBudget: n(p.maxBudget) };
}

@Injectable()
export class LeadsService {
  private _s3Client: S3Client | null = null;

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectDataSource('site') private siteDataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    // Domain events for the central mail service (docs/mail-composer-plan.md).
    @Optional() private readonly events?: EventEmitter2,
    // Lead history for the Timeline tab and analytics.
    @Optional() private readonly leadEvents?: LeadEventsService,
  ) {}

  private get s3Client(): S3Client {
    if (!this._s3Client) {
      this._s3Client = new S3Client({
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        bucket: process.env.R2_BUCKET_NAME || '',
        region: 'auto',
      });
    }
    return this._s3Client;
  }

  async getLeadById(id: number, user?: any) {
    const lead = await this.dataSource.getRepository(Lead).findOne({
      where: { id },
      relations: {
        inquiries: true,
        assigned_staff: true,
        documents: true,
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    if (user && user.role === 'Staff' && lead.assigned_staff_id !== user.id) {
      throw new ConflictException('Unauthorized access to this lead');
    }
    // Note: To be perfectly secure, Team Lead logic would be here too, but they use getLeads list primarily.

    // Load follow-ups with created_by relation ordered chronologically
    const followUps = await this.dataSource.getRepository(LeadFollowUp).find({
      where: { lead_id: id },
      relations: { created_by: true },
      order: { created_at: 'DESC' },
    });

    // Load contact logs with sent_by relation. id DESC breaks created_at
    // ties deterministically (bulk device syncs share second precision).
    const contactLogs = await this.dataSource.getRepository(ContactLog).find({
      where: { lead_id: id },
      relations: { sent_by: true },
      order: { created_at: 'DESC', id: 'DESC' },
    });

    const link: any = pickPropertyLink(lead.inquiries as any[]);
    let interestedProperty: {
      id: number; title: string; code: string | null; slug: string | null;
      price: string | number | null; propertyType: string | null; status: string | null; city: string | null;
      url: string | null; kind: 'property' | 'project'; maxPrice?: string | number | null;
    } | null = null;
    const projectId = link && !link.property_id ? inquiryProjectId(link) : null;
    try {
      if (projectId) {
        // A project enquiry: the project, with the price range of its units.
        const rows: any[] = await this.siteDataSource.query(
          `SELECT p.id, p.name AS title, p.project_code AS code, p.canonical_slug AS slug, p.project_type AS propertyType,
                  p.status, p.city, MIN(NULLIF(u.price, 0)) AS price, MAX(NULLIF(u.price, 0)) AS maxPrice
             FROM projects p LEFT JOIN project_units u ON u.project_id = p.id
            WHERE p.id = ? GROUP BY p.id LIMIT 1`,
          [projectId],
        );
        const p = rows[0];
        if (p) {
          interestedProperty = {
            id: p.id, title: p.title, code: p.code ?? null, slug: p.slug ?? null,
            price: p.price ?? null, maxPrice: p.maxPrice ?? null, propertyType: p.propertyType ?? null,
            status: p.status ?? null, city: p.city ?? null,
            url: p.slug ? `${WEBSITE}/${p.slug}` : null, kind: 'project',
          };
        }
      } else if (link) {
        const rows: any[] = await this.siteDataSource.query(
          'SELECT id, title, property_code AS code, slug, price, property_type AS propertyType, status, city FROM properties WHERE id = ? LIMIT 1',
          [link.property_id],
        );
        let p = rows[0];
        if (!p && link.property_code) {
          const byCode: any[] = await this.siteDataSource.query(
            'SELECT id, title, property_code AS code, slug, price, property_type AS propertyType, status, city FROM properties WHERE property_code = ? LIMIT 1',
            [link.property_code],
          );
          p = byCode[0];
        }
        if (p) {
          interestedProperty = {
            id: p.id, title: p.title, code: p.code ?? null, slug: p.slug ?? null,
            price: p.price ?? null, propertyType: p.propertyType ?? null,
            status: p.status ?? null, city: p.city ?? null,
            url: p.slug ? `${WEBSITE}/property/${p.slug}` : null, kind: 'property',
          };
        }
      }
    } catch (err) {
      console.warn('[LeadsService] site-DB unavailable for lead detail; interestedProperty will be null:', (err as Error)?.message);
    }

    // The visit shown is the linked requirement's, or else the newest one with a visit date.
    const visitInquiry = link?.visit_date != null ? link
      : [...((lead.inquiries as any[]) ?? [])].filter((i) => i.visit_date != null).sort((a, b) => b.id - a.id)[0];
    const visit =
      visitInquiry?.visit_date != null
        // visit_slot is SQL TIME: mysql2 returns 'HH:MM:SS'; Task 12 (crm-fe) slices to 'HH:MM'
        ? { date: visitInquiry.visit_date, slot: visitInquiry.visit_slot ?? null, intent: visitInquiry.intent ?? 'enquiry' }
        : null;

    return { ...lead, is_converted: !!lead.converted_to, converted_record: await this.convertedRecord(lead), follow_ups: followUps, contact_logs: contactLogs, interestedProperty, visit };
  }

  // Acknowledge a lead's open website enquiries. Only the assigned staff
  // member can do this, so an admin browsing around cannot clear someone
  // else's Enquiry Queue item. Idempotent: acknowledging twice is a no-op.
  // Unassigned leads (assigned_staff_id NULL) can never satisfy the numeric
  // check below, so their rows stay until claimed/assigned — intended.
  /** The Agent or Inbound record a converted lead became, matched by mobile number. */
  private async convertedRecord(lead: Lead): Promise<{ type: 'agent' | 'inbound'; id: number; name: string | null } | null> {
    if (!lead.converted_to || !lead.mobile_number) return null;
    const table = lead.converted_to === 'agent' ? 'agents' : 'inbounds';
    const nameCol = lead.converted_to === 'agent' ? 'name' : 'owner_name';
    const rows = await this.dataSource.query(
      `SELECT id, ${nameCol} AS name FROM ${table} WHERE mobile_number = ? ORDER BY id DESC LIMIT 1`,
      [lead.mobile_number],
    );
    const row = rows?.[0];
    return row ? { type: lead.converted_to as 'agent' | 'inbound', id: Number(row.id), name: row.name ?? null } : null;
  }

  async acknowledgeEnquiry(leadId: number, requestingUserId: number) {
    const lead = await this.dataSource.getRepository(Lead).findOne({
      where: { id: leadId },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (Number(lead.assigned_staff_id) !== Number(requestingUserId)) {
      throw new ForbiddenException('Only the assigned staff member can acknowledge this lead');
    }
    const result = await this.dataSource.query(
      `UPDATE lead_inquiries SET acknowledged_at = NOW(6)
       WHERE lead_id = ? AND source = 'website' AND acknowledged_at IS NULL`,
      [leadId],
    );
    return { acknowledged: Number(result?.affectedRows || 0) };
  }

  // ── Contact Log ────────────────────────────────────────────────────────────
  async addContactLog(leadId: number, body: { contact_type: string; subject?: string; message?: string; sent_by_id?: number }) {
    const lead = await this.dataSource.getRepository(Lead).findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const repo = this.dataSource.getRepository(ContactLog);
    const log = new ContactLog();
    log.lead_id = leadId;
    log.contact_type = body.contact_type;
    log.subject = body.subject || null;
    log.message = body.message || null;
    log.sent_by_id = body.sent_by_id || null;
    return repo.save(log);
  }

  // ── Follow-Up CRUD ────────────────────────────────────────────────────────
  async addFollowUp(leadId: number, body: any, actorId: number | null = null) {
    const leadRepo = this.dataSource.getRepository(Lead);
    const lead = await leadRepo.findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const repo = this.dataSource.getRepository(LeadFollowUp);
    const followUp = new LeadFollowUp();
    followUp.lead_id = leadId;
    followUp.follow_up_date = body.followUpDate || null;
    followUp.follow_up_time = body.followUpTime || null;
    followUp.contacted_via = body.contactedVia || null;
    followUp.next_follow_up_date = body.nextFollowUpDate || null;
    followUp.next_follow_up_time = body.nextFollowUpTime || null;
    followUp.purpose = body.purpose || null;
    followUp.priority = body.priority || null;
    followUp.rnr = body.rnr || null;
    followUp.outcome = body.outcome || null;
    followUp.is_completed = body.isCompleted ?? false;
    followUp.notes = body.notes || null;
    followUp.created_by_id = actorId ?? (body.createdById || null);
    const saved = await repo.save(followUp);

    // Update rnr_consecutive_count on the lead based on the rnr field (e.g. 'rnr3' → count 3)
    if (body.rnr && typeof body.rnr === 'string') {
      const match = body.rnr.match(/rnr(\d+)/i);
      if (match) {
        lead.rnr_consecutive_count = parseInt(match[1], 10);
        await leadRepo.save(lead);
      }
    } else if (!body.rnr) {
      // Non-RNR follow-up resets the consecutive count
      if (lead.rnr_consecutive_count > 0) {
        lead.rnr_consecutive_count = 0;
        await leadRepo.save(lead);
      }
    }

    // Send followup_due notification to assigned staff when a next follow-up date is scheduled
    if (body.nextFollowUpDate && lead.assigned_staff_id) {
      const leadDisplayId = `L${String(leadId).padStart(5, '0')}`;
      await this.notificationsService.createNotification(
        lead.assigned_staff_id,
        'Follow-up Scheduled',
        `A follow-up for Lead ${leadDisplayId} is scheduled on ${body.nextFollowUpDate}`,
        'followup_due',
        leadId,
        'lead',
      );
    }

    return saved;
  }

  async updateFollowUp(leadId: number, followUpId: number, body: any) {
    const repo = this.dataSource.getRepository(LeadFollowUp);
    const followUp = await repo.findOne({ where: { id: followUpId, lead_id: leadId } });
    if (!followUp) throw new NotFoundException('Follow-up not found');

    followUp.follow_up_date = body.followUpDate ?? followUp.follow_up_date;
    followUp.follow_up_time = body.followUpTime ?? followUp.follow_up_time;
    followUp.contacted_via = body.contactedVia ?? followUp.contacted_via;
    // "" clears the next follow-up (the edit dialog's way of removing it).
    if (body.nextFollowUpDate !== undefined) followUp.next_follow_up_date = body.nextFollowUpDate || null;
    if (body.nextFollowUpTime !== undefined) followUp.next_follow_up_time = body.nextFollowUpTime || null;
    followUp.purpose = body.purpose ?? followUp.purpose;
    followUp.priority = body.priority ?? followUp.priority;
    followUp.rnr = body.rnr ?? followUp.rnr;
    followUp.notes = body.notes ?? followUp.notes;

    return repo.save(followUp);
  }

  async deleteFollowUp(leadId: number, followUpId: number) {
    const repo = this.dataSource.getRepository(LeadFollowUp);
    const followUp = await repo.findOne({ where: { id: followUpId, lead_id: leadId } });
    if (!followUp) throw new NotFoundException('Follow-up not found');
    await repo.remove(followUp);
    return { success: true };
  }

  // ── Existing methods ──────────────────────────────────────────────────────
  async deleteLead(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const docs = await manager.getRepository(LeadDocument).find({ where: { lead_id: id } });
      for (const doc of docs) {
        try {
          await this.s3Client.delete(doc.file_key);
        } catch (e) {
          console.error(`Failed to delete document from R2 for lead ${id}: ${e}`);
        }
      }
      await manager.getRepository(LeadDocument).delete({ lead_id: id });
      await manager.getRepository(LeadInquiry).delete({ lead_id: id });
      await manager.getRepository(LeadFollowUp).delete({ lead_id: id });
      await manager.getRepository(ContactLog).delete({ lead_id: id });
      await manager.getRepository(Lead).delete(id);
    });
  }

  async updateLeadStatus(
    id: number,
    body: { status_name?: string; is_unqualified?: boolean; drop_reason?: string },
    actionedById: number | null = null,
  ) {
    const leadRepo = this.dataSource.getRepository(Lead);
    const existingLead = await leadRepo.findOne({ where: { id } });
    if (!existingLead) throw new NotFoundException('Lead not found');
    const previousStatus = existingLead.status;
    if (existingLead.converted_to && body.status_name && body.status_name !== previousStatus) {
      throw new BadRequestException(`Lead was converted to ${existingLead.converted_to}; update it there instead`);
    }
    const wasUnqualified = !!existingLead.is_unqualified;

    if (body.status_name) {
      existingLead.status = body.status_name;
    }

    if (body.is_unqualified !== undefined) {
      existingLead.is_unqualified = body.is_unqualified;
    }

    if (body.drop_reason !== undefined) {
      existingLead.drop_reason = body.drop_reason || null;
    }

    // A telecalling lead at or past the site visit belongs to Sales, even when
    // the "Site Visit Completed" status itself was skipped.
    const entersSales =
      !!body.status_name &&
      existingLead.department !== 'sales' &&
      SALES_PIPELINE_STATUSES.includes(body.status_name);

    const saved = entersSales
      ? await transferLeadToSales(
          this.dataSource,
          this.notificationsService,
          existingLead,
          actionedById,
          `Auto-transferred: status set to ${body.status_name}`,
        )
      : await leadRepo.save(existingLead);

    if (body.status_name && body.status_name !== previousStatus) {
      await this.events?.emitAsync('leads.lead.status_changed', {
        entityId: id, actorId: actionedById, from: previousStatus, to: body.status_name,
        reason: body.drop_reason || null,
      });
    }

    if (body.is_unqualified !== undefined && body.is_unqualified !== wasUnqualified) {
      await this.leadEvents?.record({
        leadId: id, actorId: actionedById, type: 'qualification_changed', field: 'is_unqualified',
        from: wasUnqualified ? 'Unqualified' : 'Qualified', to: body.is_unqualified ? 'Unqualified' : 'Qualified',
      });
    }

    return { lead: saved, transferredToSales: entersSales };
  }

  /**
   * Staff schedule (or move) a site visit: the date, time, project and meeting
   * point go on the latest enquiry, like website bookings, plus a "Site Visit"
   * follow-up on the visit date. Drafts the visit confirmation email.
   */
  async scheduleVisit(
    leadId: number,
    body: { date: string; time: string; project?: string | null; location?: string | null },
    actorId: number | null,
  ) {
    const lead = await this.dataSource.getRepository(Lead).findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    const saved = await this.dataSource.transaction(async (manager) => {
      const inquiries = manager.getRepository(LeadInquiry);
      const inquiry = (await inquiries.findOne({ where: { lead_id: leadId }, order: { id: 'DESC' } })) ?? inquiries.create({ lead_id: leadId });
      inquiry.visit_date = body.date;
      inquiry.visit_slot = body.time;
      inquiry.visit_location = body.location?.trim() || null;
      if (body.project?.trim()) inquiry.project_list = body.project.trim();
      await manager.save(LeadInquiry, inquiry);

      const followUp = new LeadFollowUp();
      followUp.lead_id = leadId;
      followUp.purpose = 'Site Visit';
      followUp.next_follow_up_date = body.date as any;
      followUp.next_follow_up_time = body.time as any;
      followUp.notes = ['Site visit', inquiry.project_list, inquiry.visit_location && `at ${inquiry.visit_location}`].filter(Boolean).join(' – ');
      followUp.is_completed = false;
      followUp.created_by_id = actorId as any;
      await manager.save(LeadFollowUp, followUp);
      return inquiry;
    });
    await this.events?.emitAsync('leads.site_visit.scheduled', { entityId: leadId, actorId });
    return saved;
  }

  async updateLead(id: number, body: any, actorId: number | null = null) {
    const saved = await this.dataSource.transaction(async (manager) => {
      const leadRepo = manager.getRepository(Lead);
      const existingLead = await leadRepo.findOne({ where: { id } });
      if (!existingLead) throw new NotFoundException('Lead not found');
      const before = { ...existingLead };

      // Normalize like create/bulk so a "+91 …" edit matches stored numbers
      // instead of false-conflicting or storing a second unnormalized form.
      const normalizedMobile = body.mobile ? this.normalizeMobileForCheck(body.mobile) : undefined;
      if (normalizedMobile && normalizedMobile !== existingLead.mobile_number) {
        const conflict = await leadRepo.findOne({ where: { mobile_number: normalizedMobile } });
        if (conflict) throw new ConflictException('Mobile number already belongs to another lead');
      }

      // Absent keys leave stored values untouched (partial payloads must not blank fields).
      if (body.name !== undefined) existingLead.name = body.name;
      if (normalizedMobile) existingLead.mobile_number = normalizedMobile;
      if (body.email !== undefined) existingLead.email = body.email || null;
      if (body.whatsapp !== undefined) existingLead.whatsapp_number = body.whatsapp || null;
      if (body.city !== undefined) existingLead.city = body.city || null;
      if (body.address !== undefined) existingLead.address = body.address || null;
      if (body.source !== undefined) existingLead.lead_source = body.source || null;
      existingLead.commission = body.commission !== undefined ? body.commission : existingLead.commission;
      if (body.commissionRemarks !== undefined) existingLead.commission_remarks = body.commissionRemarks?.trim() || null;
      if (body.isReferral !== undefined) existingLead.is_referral = body.isReferral;
      if (body.referredByName !== undefined) existingLead.referred_by_name = body.referredByName;
      if (body.referredByContact !== undefined) existingLead.referred_by_contact = body.referredByContact;
      await manager.save(Lead, existingLead);

      if (body.purchaseType || body.propertyType || body.funder || body.project || body.propertyCategory) {
        const inquiryRepo = manager.getRepository(LeadInquiry);
        let inquiry = await inquiryRepo.findOne({ where: { lead_id: id } });
        if (!inquiry) inquiry = inquiryRepo.create({ lead_id: id });
        inquiry.project_list = body.project || null;
        inquiry.purchase_type = body.purchaseType || null;
        inquiry.property_type = body.propertyType || null;
        inquiry.property_category = body.propertyCategory || null;
        inquiry.funder = body.funder || null;
        inquiry.preferences = body.preferences || null;
        if (body.cityId !== undefined) inquiry.city_id = body.cityId || null;
        if (body.subLocations !== undefined) inquiry.sub_locations = body.subLocations || null;
        if (body.purchaseTimeline !== undefined) inquiry.purchase_timeline = body.purchaseTimeline || null;
        if (body.qualificationPurpose !== undefined) inquiry.qualification_purpose = body.qualificationPurpose || null;
        if (body.decisionMaker !== undefined) inquiry.decision_maker = body.decisionMaker || null;
        await manager.save(LeadInquiry, inquiry);
      }

      return { lead: existingLead, before };
    });
    await this.leadEvents?.recordChanges(id, actorId, 'field_changed', saved.before as any, saved.lead as any, LEAD_TRACKED_FIELDS);
    return saved.lead;
  }

  /** A requirement added by hand on the lead page (not a new enquiry from the lead). */
  async addInquiry(leadId: number, body: any, actorId: number | null = null) {
    const lead = await this.dataSource.getRepository(Lead).findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    const inquiryRepo = this.dataSource.getRepository(LeadInquiry);
    const saved = await inquiryRepo.save(inquiryRepo.create({
      lead_id: leadId,
      source: 'manual',
      project_list: body.project ?? null,
      purchase_type: body.purchaseType ?? null,
      property_category: body.propertyCategory ?? null,
      property_type: body.propertyType ?? null,
      funder: body.funder ?? null,
      purchase_timeline: body.purchaseTimeline ?? null,
      qualification_purpose: body.qualificationPurpose ?? null,
      decision_maker: body.decisionMaker ?? null,
    } as Partial<LeadInquiry>));
    await this.leadEvents?.record({ leadId, actorId, type: 'requirement_added', meta: { inquiryId: saved.id } });
    return saved;
  }

  async updateInquiry(leadId: number, inquiryId: number, body: any, actorId: number | null = null) {
    const inquiryRepo = this.dataSource.getRepository(LeadInquiry);
    const inquiry = await inquiryRepo.findOne({ where: { id: inquiryId, lead_id: leadId } });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    const before = { ...inquiry };

    if (body.project !== undefined) inquiry.project_list = body.project;
    if (body.purchaseType !== undefined) inquiry.purchase_type = body.purchaseType;
    if (body.propertyType !== undefined) inquiry.property_type = body.propertyType;
    if (body.propertyCategory !== undefined) inquiry.property_category = body.propertyCategory;
    if (body.funder !== undefined) inquiry.funder = body.funder;
    if (body.preferences !== undefined) inquiry.preferences = body.preferences;
    // A patch is merged by MySQL in one statement after the save, so two
    // preference fields saved at the same moment can't undo each other.
    // Left undefined here so the save below doesn't write a stale copy.
    const patch = body.preferencesPatch && body.preferences === undefined
      ? Object.fromEntries(Object.entries(body.preferencesPatch).map(([k, v]) => [k, v === '' ? null : v ?? null]))
      : null;
    if (patch) inquiry.preferences = undefined;
    if (body.cityId !== undefined) inquiry.city_id = body.cityId;
    if (body.subLocations !== undefined) inquiry.sub_locations = body.subLocations;
    if (body.purchaseTimeline !== undefined) inquiry.purchase_timeline = body.purchaseTimeline;
    if (body.qualificationPurpose !== undefined) inquiry.qualification_purpose = body.qualificationPurpose;
    if (body.decisionMaker !== undefined) inquiry.decision_maker = body.decisionMaker;

    const saved = await inquiryRepo.save(inquiry);
    if (patch) {
      await this.dataSource.query(
        'UPDATE lead_inquiries SET preferences = JSON_MERGE_PATCH(COALESCE(preferences, JSON_OBJECT()), CAST(? AS JSON)) WHERE id = ?',
        [JSON.stringify(patch), inquiryId],
      );
      const [row] = await this.dataSource.query('SELECT preferences FROM lead_inquiries WHERE id = ?', [inquiryId]);
      const merged = row?.preferences ?? null;
      saved.preferences = typeof merged === 'string' ? JSON.parse(merged) : merged;
    }
    await this.leadEvents?.recordChanges(leadId, actorId, 'requirement_changed', before as any, saved as any, INQUIRY_TRACKED_FIELDS, { inquiryId });
    return saved;
  }

  /** Removes one requirement; the timeline keeps a note of what it was. */
  async deleteInquiry(leadId: number, inquiryId: number, actorId: number | null = null) {
    const inquiryRepo = this.dataSource.getRepository(LeadInquiry);
    const inquiry = await inquiryRepo.findOne({ where: { id: inquiryId, lead_id: leadId } });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    const summary = [inquiry.property_type ?? inquiry.property_category, inquiry.project_list].filter(Boolean).join(' · ') || null;
    await this.dataSource.transaction(async (manager) => {
      // A website enquiry that became this requirement stops pointing at it.
      await manager.query('UPDATE website_enquiry_events SET migrated_inquiry_id = NULL WHERE migrated_inquiry_id = ?', [inquiryId]);
      await manager.delete(LeadInquiry, { id: inquiryId, lead_id: leadId });
    });
    await this.leadEvents?.record({ leadId, actorId, type: 'requirement_removed', from: summary, meta: { inquiryId } });
  }

  async bulkCreateLeads(leads: any[], actionedBy?: any) {
    if (!leads || leads.length === 0) return { count: 0, created: 0, existing: 0, assigned: 0 };

    // Resolve IDs server-side so a changed/deactivated master cannot import a stale name.
    for (const [index, row] of leads.entries()) {
      if (row.leadSourceId !== undefined && (!Number.isSafeInteger(Number(row.leadSourceId)) || Number(row.leadSourceId) <= 0)) {
        throw new BadRequestException(`Row ${index + 2}: Lead Source ID must match an active Lead Source master ID.`);
      }
    }
    const sourceIds = [...new Set(leads.filter(row => row.leadSourceId !== undefined).map(row => Number(row.leadSourceId)))];
    const sources = sourceIds.length ? await this.dataSource.getRepository(LeadSource).find({
      where: { id: In(sourceIds), is_active: true },
    }) : [];
    const sourceNames = new Map(sources.map(source => [source.id, source.name]));
    for (const [index, row] of leads.entries()) {
      if (row.leadSourceId !== undefined && !sourceNames.has(Number(row.leadSourceId))) {
        throw new BadRequestException(`Row ${index + 2}: Lead Source ID must match an active Lead Source master ID.`);
      }
    }

    // Strip +91 / 91 prefix so numbers are stored as consistent 10-digit strings.
    // India-only system — +91 is the only country code in use.
    const normalizeIndianMobile = (raw: string): string => {
      const digits = raw.replace(/\D/g, '');
      if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
      if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
      return digits;
    };

    // Normalize and drop rows without a usable mobile number
    const normalizedLeads = leads.map(body => ({
      ...body,
      mobile: body.mobile ?? body.mobile_number ?? null,
      source: body.leadSourceId !== undefined ? sourceNames.get(Number(body.leadSourceId))! : body.source ?? body.lead_source ?? null,
    }))
    .filter(l => l.mobile !== null && String(l.mobile).trim() !== '')
    .map(l => ({ ...l, mobile: normalizeIndianMobile(String(l.mobile).trim()) }))
    .filter(l => l.mobile !== '');

    // Pre-assignment is a non-Staff privilege (mirrors the frontend gate):
    // a Staff caller cannot skip the routing queue via direct API call.
    const requesterRole = actionedBy?.role?.name ?? actionedBy?.role;
    const canPreAssign = requesterRole !== 'Staff';
    if (!canPreAssign) {
      for (const l of normalizedLeads) delete l.assignedStaffId;
    }

    if (normalizedLeads.length === 0) return { count: 0, created: 0, existing: 0, assigned: 0 };

    const summary = await this.dataSource.transaction(async (manager: EntityManager) => {
      // Group rows by normalized mobile so duplicates within the same file
      // share a single lead instead of violating the unique constraint.
      const rowsByMobile = new Map<string, any[]>();
      for (const row of normalizedLeads) {
        const mobile = String(row.mobile).trim();
        row.mobile = mobile;
        const bucket = rowsByMobile.get(mobile);
        if (bucket) bucket.push(row);
        else rowsByMobile.set(mobile, [row]);
      }

      // Get existing leads in one go
      const mobiles = [...rowsByMobile.keys()];
      const existingLeads = await manager.getRepository(Lead)
        .createQueryBuilder('lead')
        .where('lead.mobile_number IN (:...mobiles)', { mobiles })
        .getMany();

      const existingMap = new Map<string, Lead>();
      existingLeads.forEach(l => existingMap.set(l.mobile_number, l));

      // Open Pipeline assign-on-insert: resolve the distinct staff ids chosen
      // during review in one go (with departments) so new leads land directly
      // owned + in the right pipeline instead of the routing queue.
      // Unknown ids — or staff with no department link — are ignored:
      // those rows import unassigned (routing queue) instead of guessing.
      const normalizeDeptName = (name: unknown): 'sales' | 'telecalling' | null => {
        if (name == null || String(name).trim() === '') return null;
        const n = String(name).toLowerCase().replace(' department', '').trim();
        return n === 'sales' ? 'sales' : 'telecalling';
      };
      const assigneeIds = [...new Set(
        [...rowsByMobile.values()]
          .map((rows) => rows[0]?.assignedStaffId)
          .filter((v): v is number => typeof v === 'number' && Number.isInteger(v)),
      )];
      const deptByUserId = new Map<number, 'sales' | 'telecalling'>();
      if (assigneeIds.length > 0) {
        const assignees = await manager.getRepository(User).find({
          where: { id: In(assigneeIds) },
          relations: { department: true },
        });
        for (const u of assignees) {
          const dept = normalizeDeptName((u as any).department?.name);
          if (dept) deptByUserId.set(u.id, dept);
        }
      }

      // Build one lead entity per new mobile (first row provides base data)
      const leadsToCreate: { mobile: string; lead: Lead; assigneeId: number | null }[] = [];
      for (const [mobile, rows] of rowsByMobile) {
        if (existingMap.has(mobile)) continue;
        const row = rows[0];
        // Duplicate-mobile rows never reach here (merged below), so a chosen
        // assignee on a dupe row is simply ignored.
        const assigneeId = typeof row.assignedStaffId === 'number' && deptByUserId.has(row.assignedStaffId)
          ? row.assignedStaffId
          : null;
        const lead = manager.getRepository(Lead).create({
          name: row.name,
          mobile_number: mobile,
          email: row.email || null,
          lead_source: row.source || null,
          status: 'New Lead',
          // Imported leads enter the unassigned telecalling routing queue unless
          // a staff member was chosen during review — then they land directly
          // assigned in that staff member's department pipeline.
          // NOTE: the bulk upload "Remarks" column is NOT a commission note — it is
          // recorded as a follow-up note below, so commission_remarks stays null.
          department: assigneeId != null ? (deptByUserId.get(assigneeId) as string) : 'telecalling',
          assigned_staff_id: assigneeId as unknown as number,
        });
        leadsToCreate.push({ mobile, lead, assigneeId });
      }

      // Batch insert new leads
      const savedByMobile = new Map<string, Lead>();
      if (leadsToCreate.length > 0) {
        const savedEntities = await manager.save(Lead, leadsToCreate.map(item => item.lead), { chunk: 1000 });
        leadsToCreate.forEach(({ mobile }, i) => savedByMobile.set(mobile, savedEntities[i]));
      }

      // Prepare child entities — every row gets its own inquiry/follow-up
      const inquiries = [];
      const followUps = [];
      let created = 0;
      let existing = 0;
      let assigned = 0;
      const assigneeByMobile = new Map(leadsToCreate.map((item) => [item.mobile, item.assigneeId] as const));

      for (const [mobile, rows] of rowsByMobile) {
        const lead = savedByMobile.get(mobile) ?? existingMap.get(mobile);
        if (!lead) continue;

        if (savedByMobile.has(mobile)) {
          created++;
          if (assigneeByMobile.get(mobile) != null) assigned++;
        }
        else existing++;

        for (const row of rows) {
          // The bulk upload "Remarks" column is an import note, not a commission
          // note: record it as a follow-up note on newly created leads. Existing
          // leads are left untouched so a note row can never bury a live schedule
          // in the Action Required views.
          const isNewLead = savedByMobile.has(mobile);
          const remarkNote = isNewLead ? row.commissionRemarks || null : null;
          if (row.purchaseType || row.propertyType || row.funder || row.project || row.propertyCategory) {
            inquiries.push(
              manager.getRepository(LeadInquiry).create({
                lead_id: lead.id,
                project_list: row.project || null,
                purchase_type: row.purchaseType || null,
                property_type: row.propertyType || null,
                property_category: row.propertyCategory || null,
                funder: row.funder || null,
                preferences: row.preferences || null,
                city_id: row.cityId || null,
                sub_locations: row.subLocations || null,
                purchase_timeline: row.purchaseTimeline || null,
                qualification_purpose: row.qualificationPurpose || null,
                decision_maker: row.decisionMaker || null,
              })
            );
          }

          if (row.followUpDate || row.purpose || row.priority || row.notes || row.rnr || remarkNote) {
            followUps.push(
              manager.getRepository(LeadFollowUp).create({
                lead_id: lead.id,
                follow_up_date: row.followUpDate || null,
                follow_up_time: row.followUpTime || null,
                purpose: row.purpose || null,
                priority: row.priority || null,
                rnr: row.rnr || null,
                notes: row.notes || remarkNote || null,
              })
            );
          }
        }
      }

      // Batch insert child records
      if (inquiries.length > 0) {
        await manager.save(LeadInquiry, inquiries, { chunk: 1000 });
      }
      if (followUps.length > 0) {
        await manager.save(LeadFollowUp, followUps, { chunk: 1000 });
      }

      return { count: created, created, existing, assigned };
    });

    return summary;
  }

  // ── Duplicate pre-checks (warn before submit / insert) ────────────────────
  // Same India-only +91 normalization used by bulkCreateLeads so a typed
  // "+91 98765 43210" matches the stored 10-digit number.
  private normalizeMobileForCheck(raw: unknown): string {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
    return digits;
  }

  private toDuplicateLeadInfo(lead: Lead): DuplicateLeadInfo {
    return {
      id: lead.id,
      displayId: `L${String(lead.id).padStart(5, '0')}`,
      name: lead.name,
      status: lead.status,
      staff: lead.assigned_staff?.name ?? 'Unassigned',
    };
  }

  async checkMobileExists(mobile: string, excludeId?: number) {
    const normalized = this.normalizeMobileForCheck(mobile);
    if (!normalized) return { exists: false, lead: null };
    const lead = await this.dataSource.getRepository(Lead).findOne({
      where: { mobile_number: normalized },
      relations: { assigned_staff: true },
    });
    if (!lead || (excludeId != null && lead.id === Number(excludeId))) {
      return { exists: false, lead: null };
    }
    return { exists: true, lead: this.toDuplicateLeadInfo(lead) };
  }

  async bulkCheckMobiles(mobiles: string[]) {
    const normalized = [...new Set(
      (mobiles ?? []).map((m) => this.normalizeMobileForCheck(m)).filter(Boolean),
    )];
    const existing: Record<string, DuplicateLeadInfo> = {};
    if (normalized.length === 0) return { existing };
    const rows = await this.dataSource.getRepository(Lead)
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.assigned_staff', 'staff')
      .where('lead.mobile_number IN (:...mobiles)', { mobiles: normalized })
      .getMany();
    for (const lead of rows) {
      existing[lead.mobile_number] = this.toDuplicateLeadInfo(lead);
    }
    return { existing };
  }

  /** Creates or merges a lead, then announces it (after commit) for emails. */
  async createLead(body: any): Promise<CreateLeadResult> {
    const result = await this.createLeadRecord(body);
    if (result.lead && this.events) {
      const withVisit = body.intent === 'site_visit' && Boolean(body.visitDate ?? body.visit_date);
      if (!result.isExistingCustomer) {
        await this.events.emitAsync('leads.lead.created', { entityId: result.lead.id, actorId: body.createdById ?? null, withVisit });
      }
      if (withVisit) await this.events.emitAsync('leads.site_visit.scheduled', { entityId: result.lead.id, actorId: null });
    }
    return result;
  }

  private async createLeadRecord(body: any): Promise<CreateLeadResult> {    // Normalise: frontend sends 'mobile', legacy DTO used 'mobile_number'
    const mobile = this.normalizeMobileForCheck(body.mobile ?? body.mobile_number ?? '');
    if (!mobile) {
      throw new BadRequestException('mobile is required');
    }
    const normalised = { ...body, mobile };

    return this.dataSource.transaction(async (manager: EntityManager) => {
      if (isQueuedWebsiteSource(normalised.source)) {
        // Decide-first intake: hold everything as a pending event. Nothing
        // auto-creates here; Convert/Attach/Acknowledge (lead-routing) resolve it.
        const eventRepo = manager.getRepository(WebsiteEnquiryEvent);
        let matchedLead = await manager.getRepository(Lead).findOne({
          where: { mobile_number: mobile },
          relations: { assigned_staff: true },
        });
        if (!matchedLead && normalised.email) {
          const byEmail = await manager.getRepository(Lead).findOne({
            where: { email: normalised.email },
          });
          // Mobile wins on conflict: only adopt the email match when mobile matched nothing.
          if (byEmail) matchedLead = byEmail;
        }
        if(normalised.analyticsSubmissionId){
          const prior=await eventRepo.findOne({where:{analyticsSubmissionId:normalised.analyticsSubmissionId}});
          if(prior)return {lead:matchedLead,isExistingCustomer:!!matchedLead,existingStaff:matchedLead?.assigned_staff?.name??'Unassigned'};
        }
        const event = eventRepo.create({
          analyticsSubmissionId:normalised.analyticsSubmissionId||null,analyticsSessionId:normalised.analyticsSessionId||null,analyticsPageId:normalised.analyticsPageId||null,
          name: normalised.name ?? null,
          mobile_number: mobile,
          email: normalised.email || null,
          city: normalised.city || null,
          whatsapp_number: normalised.whatsapp || null,
          source: normalised.source,
          message: typeof normalised.notes === 'string' && normalised.notes.trim() ? normalised.notes.trim() : null,
          property_id: normalised.propertyId ?? null,
          property_code: normalised.propertyCode ?? null,
          property_slug: normalised.propertySlug ?? null,
          property_type: normalised.propertyType ?? null,
          intent: normalised.intent ?? 'enquiry',
          visit_date: normalised.visitDate ?? null,
          visit_slot: normalised.visitSlot ?? null,
          preferences: normalised.projectId ? {
            ...normalised.preferences,
            projectId: normalised.projectId,
            projectCode: normalised.projectCode ?? null,
            projectSlug: normalised.projectSlug ?? null,
          } : normalised.preferences || null,
          matched_lead_id: matchedLead ? matchedLead.id : null,
          status: 'open',
        });
        let savedEvent: WebsiteEnquiryEvent;
        try{savedEvent=await manager.save(event);}catch(error){
          if(!normalised.analyticsSubmissionId||!error||typeof error!=='object'||!('code' in error)||error.code!=='ER_DUP_ENTRY')throw error;
          const prior=await eventRepo.findOne({where:{analyticsSubmissionId:normalised.analyticsSubmissionId}});if(!prior)throw error;savedEvent=prior;
        }
        return {
          lead: matchedLead,
          isExistingCustomer: !!matchedLead,
          existingStaff: (matchedLead as any)?.assigned_staff?.name ?? 'Unassigned',
          eventId: savedEvent.id,
        };
      }

      const existingLead = await manager.getRepository(Lead).findOne({
        where: { mobile_number: mobile },
        relations: { assigned_staff: true },
      });

      if (existingLead) {
        if (normalised.purchaseType || normalised.propertyType || normalised.funder || normalised.project || normalised.propertyCategory || normalised.propertyId) {
          const inquiryBase = {
            lead_id: existingLead.id,
            project_list: normalised.project || null,
            purchase_type: normalised.purchaseType || null,
            property_type: normalised.propertyType || null,
            property_category: normalised.propertyCategory || null,
            funder: normalised.funder || null,
            preferences: normalised.preferences || null,
            city_id: normalised.cityId || null,
            sub_locations: normalised.subLocations || null,
            purchase_timeline: normalised.purchaseTimeline || null,
            qualification_purpose: normalised.qualificationPurpose || null,
            decision_maker: normalised.decisionMaker || null,
            property_id: normalised.propertyId ?? null,
            property_code: normalised.propertyCode ?? null,
            property_slug: normalised.propertySlug ?? null,
            source: 'website',
            is_new_lead: false,
          };
          // A visit booking lays down its enquiry first, then the visit on
          // top of it — so the funnel always has the base enquiry record.
          const intents =
            normalised.intent === 'site_visit' ? ['enquiry', 'site_visit'] : [normalised.intent ?? 'enquiry'];
          for (const intent of intents) {
            const inquiry = manager.getRepository(LeadInquiry).create({
              ...inquiryBase,
              intent,
              visit_date: intent === 'site_visit' ? (normalised.visitDate ?? null) : null,
              visit_slot: intent === 'site_visit' ? (normalised.visitSlot ?? null) : null,
            });
            await manager.save(inquiry);
          }
        }

        if (normalised.followUpDate || normalised.purpose || normalised.priority || normalised.notes || normalised.rnr || normalised.visitDate) {
          const followUp = manager.getRepository(LeadFollowUp).create({
            lead_id: existingLead.id,
            next_follow_up_date: normalised.followUpDate || normalised.visitDate || null,
            next_follow_up_time: normalised.followUpTime || normalised.visitSlot || null,
            purpose: normalised.purpose || (normalised.intent === 'site_visit' ? 'Site Visit' : null),
            priority: normalised.priority || null,
            rnr: normalised.rnr || null,
            notes: normalised.notes || null,
          });
          await manager.save(followUp);
        }

        return {
          lead: existingLead,
          isExistingCustomer: true,
          existingStaff: existingLead.assigned_staff?.name ?? 'Unassigned',
        };
      }

      let assignedStaffId: number | undefined;
      if (normalised.userId) {
        const user = await manager.getRepository(User).findOne({ where: { id: normalised.userId } });
        if (user) assignedStaffId = user.id;
      }

      const leadRepo = manager.getRepository(Lead);
      const lead = leadRepo.create({
        name: normalised.name,
        mobile_number: mobile,
        email: normalised.email || null,
        whatsapp_number: normalised.whatsapp || null,
        city: normalised.city || null,
        address: normalised.address || null,
        lead_source: normalised.source || null,
        status: normalised.intent === 'site_visit' ? 'Site Visit Scheduled' : 'New Lead',
        assigned_staff_id: assignedStaffId,
        commission: normalised.commission || null,
        commission_remarks: normalised.commissionRemarks?.trim() || null,
        is_referral: normalised.isReferral || false,
        referred_by_name: normalised.referredByName || null,
        referred_by_contact: normalised.referredByContact || null,
      });
      const savedLead: Lead = await manager.save(lead);

      if (normalised.purchaseType || normalised.propertyType || normalised.funder || normalised.project || normalised.propertyCategory || normalised.propertyId) {
        const inquiryBase = {
          lead_id: savedLead.id,
          project_list: normalised.project || null,
          purchase_type: normalised.purchaseType || null,
          property_type: normalised.propertyType || null,
          property_category: normalised.propertyCategory || null,
          funder: normalised.funder || null,
          preferences: normalised.preferences || null,
          city_id: normalised.cityId || null,
          sub_locations: normalised.subLocations || null,
          purchase_timeline: normalised.purchaseTimeline || null,
          qualification_purpose: normalised.qualificationPurpose || null,
          decision_maker: normalised.decisionMaker || null,
          property_id: normalised.propertyId ?? null,
          property_code: normalised.propertyCode ?? null,
          property_slug: normalised.propertySlug ?? null,
          source: 'website',
          is_new_lead: true,
        };
        // A visit booking lays down its enquiry first, then the visit on
        // top of it — so the funnel always has the base enquiry record.
        const intents =
          normalised.intent === 'site_visit' ? ['enquiry', 'site_visit'] : [normalised.intent ?? 'enquiry'];
        for (const intent of intents) {
          const inquiry = manager.getRepository(LeadInquiry).create({
            ...inquiryBase,
            intent,
            visit_date: intent === 'site_visit' ? (normalised.visitDate ?? null) : null,
            visit_slot: intent === 'site_visit' ? (normalised.visitSlot ?? null) : null,
          });
          await manager.save(inquiry);
        }
      }

      if (normalised.followUpDate || normalised.purpose || normalised.priority || normalised.notes || normalised.rnr || normalised.visitDate) {
        const followUp = manager.getRepository(LeadFollowUp).create({
          lead_id: savedLead.id,
          next_follow_up_date: normalised.followUpDate || normalised.visitDate || null,
          next_follow_up_time: normalised.followUpTime || normalised.visitSlot || null,
          purpose: normalised.purpose || (normalised.intent === 'site_visit' ? 'Site Visit' : null),
          priority: normalised.priority || null,
          rnr: normalised.rnr || null,
          notes: normalised.notes || null,
        });
        await manager.save(followUp);
      }

      return { lead: savedLead, isExistingCustomer: false };
    });
  }

  async getLeads(user?: any, query?: any): Promise<{ data: any[], meta: any }> {
    const page = query?.page ? Number(query.page) : 1;
    const limit = query?.limit ? Number(query.limit) : 10;
    const offset = (page - 1) * limit;

    const roleFilter = leadScopeSql(user);

    // Scope (role/tab/pipeline) also drives the filter-dropdown option lists,
    // so it is kept apart from the user's own search/filter conditions.
    const scopeParams: any[] = [];
    let scopeConds = '';

    if (query?.dept) {
      scopeConds += ' AND l.department = ?';
      scopeParams.push(query.dept);
    }

    const params: any[] = [];
    let filterConds = '';

    if (query?.search) {
      const rawSearch = String(query.search).trim();
      const s = `%${rawSearch}%`;
      // Check if user entered an ID format like L00025, #25, 00025, or 25
      const parsedIdMatch = rawSearch.match(/^[Ll#]?0*(\d+)$/);
      const parsedId = parsedIdMatch ? Number(parsedIdMatch[1]) : null;

      const conds = ['l.name LIKE ?', 'l.mobile_number LIKE ?', 'l.whatsapp_number LIKE ?', 'l.email LIKE ?', "CONCAT('L', LPAD(l.id, 5, '0')) LIKE ?"];
      params.push(s, s, s, s, s);
      if (parsedId !== null && Number.isFinite(parsedId) && parsedId > 0) {
        conds.push('l.id = ?');
        params.push(parsedId);
      }
      // A typed number in any format (+91 98765 43210) against either phone.
      const phone = /^[+\d\s()-]+$/.test(rawSearch) ? phoneDigits(rawSearch) : null;
      if (phone) {
        conds.push("REGEXP_REPLACE(COALESCE(l.mobile_number, ''), '[^0-9]', '') LIKE ?", "REGEXP_REPLACE(COALESCE(l.whatsapp_number, ''), '[^0-9]', '') LIKE ?");
        params.push(`%${phone}%`, `%${phone}%`);
      }
      filterConds += ` AND (${conds.join(' OR ')})`;
    }

    if (query?.dateFrom) {
      filterConds += ' AND DATE(l.created_at) >= ?';
      params.push(query.dateFrom);
    }
    if (query?.dateTo) {
      filterConds += ' AND DATE(l.created_at) <= ?';
      params.push(query.dateTo);
    }
    if (query?.status) {
      filterConds += ' AND l.status = ?';
      params.push(query.status);
    }
    // A converted lead lives on as an Agent or Inbound record and is worked
    // there; it only lists here when staff ask for Converted leads on purpose.
    if (query?.status !== 'Converted') filterConds += ' AND l.converted_to IS NULL';
    if (query?.source) {
      filterConds += ' AND l.lead_source = ?';
      params.push(query.source);
    }
    if (query?.category) {
      filterConds += ' AND i.property_category = ?';
      params.push(query.category);
    }
    if (query?.type) {
      filterConds += ' AND i.property_type = ?';
      params.push(query.type);
    }
    if (query?.staff) {
      filterConds += ' AND s.name = ?';
      params.push(query.staff);
    }

    if (query?.priority) {
      filterConds += ' AND LOWER(latest_f.priority) = ?';
      params.push(String(query.priority).toLowerCase());
    }

    // Budget overlap against the latest inquiry preferences JSON
    // ({minBudget, maxBudget}). A lead matches when its budget range
    // intersects the requested range; open ends match anything. Leads
    // without any stored budget bound are excluded while filtering.
    const fMinBudget = query?.minBudget !== undefined && query.minBudget !== '' ? Number(query.minBudget) : undefined;
    const fMaxBudget = query?.maxBudget !== undefined && query.maxBudget !== '' ? Number(query.maxBudget) : undefined;
    if ((fMinBudget !== undefined && Number.isFinite(fMinBudget)) || (fMaxBudget !== undefined && Number.isFinite(fMaxBudget))) {
      filterConds += ` AND (
        NULLIF(TRIM(BOTH '"' FROM JSON_UNQUOTE(JSON_EXTRACT(i.preferences, '$.minBudget'))), '') IS NOT NULL
        OR NULLIF(TRIM(BOTH '"' FROM JSON_UNQUOTE(JSON_EXTRACT(i.preferences, '$.maxBudget'))), '') IS NOT NULL
      )`;
      if (fMinBudget !== undefined && Number.isFinite(fMinBudget)) {
        filterConds += ` AND (
          NULLIF(TRIM(BOTH '"' FROM JSON_UNQUOTE(JSON_EXTRACT(i.preferences, '$.maxBudget'))), '') IS NULL
          OR CAST(NULLIF(TRIM(BOTH '"' FROM JSON_UNQUOTE(JSON_EXTRACT(i.preferences, '$.maxBudget'))), '') AS DECIMAL(14,2)) >= ?
        )`;
        params.push(fMinBudget);
      }
      if (fMaxBudget !== undefined && Number.isFinite(fMaxBudget)) {
        filterConds += ` AND (
          NULLIF(TRIM(BOTH '"' FROM JSON_UNQUOTE(JSON_EXTRACT(i.preferences, '$.minBudget'))), '') IS NULL
          OR CAST(NULLIF(TRIM(BOTH '"' FROM JSON_UNQUOTE(JSON_EXTRACT(i.preferences, '$.minBudget'))), '') AS DECIMAL(14,2)) <= ?
        )`;
        params.push(fMaxBudget);
      }
    }

    if (query?.tab === 'Unqualified') {
      scopeConds += ' AND l.is_unqualified = 1';
    } else {
      scopeConds += ' AND l.is_unqualified = 0';
    }

    // Action required filters
    if (query?.tab === 'Action Required' && query?.actionFilter) {
       const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
       const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
       const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

       if (query.actionFilter === 'Overdue') {
         scopeConds += ` AND latest_f.next_follow_up_date < '${today}'`;
       } else if (query.actionFilter === 'Yesterday') {
         scopeConds += ` AND EXISTS (SELECT 1 FROM lead_follow_ups f WHERE f.lead_id = l.id AND DATE(f.follow_up_date) = '${yesterday}')`;
        } else if (query.actionFilter === 'Today') {
          if (query.todayViewMode === 'completed') {
            scopeConds += ` AND EXISTS (SELECT 1 FROM lead_follow_ups f WHERE f.lead_id = l.id AND DATE(f.follow_up_date) = '${today}')`;
            scopeConds += ` AND (latest_f.next_follow_up_date IS NULL OR DATE(latest_f.next_follow_up_date) != '${today}')`;
          } else {
            scopeConds += ` AND DATE(latest_f.next_follow_up_date) = '${today}'`;
          }
       } else if (query.actionFilter === 'Tomorrow') {
         scopeConds += ` AND DATE(latest_f.next_follow_up_date) = '${tomorrow}'`;
       } else if (query.actionFilter === 'All Scheduled') {
         scopeConds += ` AND DATE(latest_f.next_follow_up_date) > '${tomorrow}'`;
       }
    }

    // Closed leads never queue for action — but an explicit status filter
    // always wins, so staff can still list them on purpose.
    if (!query?.status && (query?.tab === 'Action Required' || query?.actionFilter)) {
      scopeConds += ` AND l.status NOT IN (${NON_QUEUEABLE_LEAD_STATUSES.map(() => '?').join(', ')})`;
      scopeParams.push(...NON_QUEUEABLE_LEAD_STATUSES);
    }

    // Because action required relies on follow_up subqueries, we need them in count query as well.
    const joinClauses = `
      LEFT JOIN users s ON l.assigned_staff_id = s.id
      LEFT JOIN (
        SELECT lead_id, property_type, property_category, preferences, purchase_type, purchase_timeline, sub_locations,
               ROW_NUMBER() OVER(PARTITION BY lead_id ORDER BY id DESC) as rn
        FROM lead_inquiries
      ) i ON i.lead_id = l.id AND i.rn = 1
      LEFT JOIN (
        SELECT lead_id, next_follow_up_date, next_follow_up_time, priority,
               ROW_NUMBER() OVER(PARTITION BY lead_id ORDER BY created_at DESC) as rn
        FROM lead_follow_ups
      ) latest_f ON latest_f.lead_id = l.id AND latest_f.rn = 1
      LEFT JOIN (
        SELECT lead_id, follow_up_date, follow_up_time, notes,
               ROW_NUMBER() OVER(PARTITION BY lead_id ORDER BY follow_up_date DESC, created_at DESC, id DESC) as rn
        FROM lead_follow_ups
        WHERE follow_up_date IS NOT NULL
      ) latest_actual_f ON latest_actual_f.lead_id = l.id AND latest_actual_f.rn = 1
    `;

    // Scope-only WHERE for the option lists: the user's own filters are
    // deliberately absent so the dropdowns stay stable while filtering.
    const scopeWhere = `WHERE 1=1 ${roleFilter} ${scopeConds}`;
    const listWhere = `WHERE 1=1 ${roleFilter} ${scopeConds} ${filterConds}`;
    const listParams = [...scopeParams, ...params];

    const countSql = `
      SELECT COUNT(*) as count 
      FROM leads l 
      ${joinClauses} 
      ${listWhere}
    `;

    // Distinct values for the filter dropdowns, scoped like the list (role,
    // tab, pipeline) so no offered value yields an empty result page.
    const optionsSql = `
      SELECT 'status' AS kind, l.status AS value FROM leads l ${joinClauses} ${scopeWhere} AND l.status IS NOT NULL AND l.status <> ''
      UNION ALL
      SELECT 'source' AS kind, l.lead_source AS value FROM leads l ${joinClauses} ${scopeWhere} AND l.lead_source IS NOT NULL AND l.lead_source <> ''
      UNION ALL
      SELECT 'category' AS kind, i.property_category AS value FROM leads l ${joinClauses} ${scopeWhere} AND i.property_category IS NOT NULL AND i.property_category <> ''
      UNION ALL
      SELECT 'type' AS kind, i.property_type AS value FROM leads l ${joinClauses} ${scopeWhere} AND i.property_type IS NOT NULL AND i.property_type <> ''
      UNION ALL
      SELECT 'staff' AS kind, s.name AS value FROM leads l ${joinClauses} ${scopeWhere} AND s.name IS NOT NULL AND s.name <> ''
    `;

    const [countResult, optionRows] = await Promise.all([
      this.dataSource.query(countSql, listParams),
      this.dataSource.query(optionsSql, [...scopeParams, ...scopeParams, ...scopeParams, ...scopeParams, ...scopeParams]),
    ]);
    const total = Number(countResult[0]?.count || 0);

    const dataSql = `
      SELECT 
        l.id as rawId, 
        l.assigned_staff_id as assignedStaffId,
        l.name, 
        l.mobile_number as mobile, 
        l.email, 
        l.whatsapp_number as whatsapp,
        l.city,
        l.updated_at as updatedAt,
        l.status, 
        l.department,
        l.lead_source as source, 
        l.is_unqualified as isUnqualified, 
        l.created_at as createdAt,
        s.name as staff,
        i.property_type as propertyType, 
        i.property_category as propertyCategory,
        i.purchase_type as purchaseType,
        i.purchase_timeline as purchaseTimeline,
        i.sub_locations as subLocations,
        i.preferences as preferences,
        latest_f.next_follow_up_date as nextFollowUpDate,
        latest_f.next_follow_up_time as nextFollowUpTime,
        latest_f.priority as priority,
        latest_actual_f.follow_up_date as lastFollowedUpDate,
        latest_actual_f.follow_up_time as lastFollowedUpTime,
        latest_actual_f.notes as lastFollowedUpNotes
      FROM leads l
      ${joinClauses}
      ${listWhere}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rawLeads = await this.dataSource.query(dataSql, [...listParams, limit, offset]);

    const data = rawLeads.map((row: any, index: number) => ({
      sno: offset + index + 1,
      id: 'L' + String(row.rawId).padStart(5, '0'),
      rawId: row.rawId,
      createdAt: row.createdAt,
      date: new Date(row.createdAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      name: row.name,
      email: row.email || '',
      mobile: row.mobile,
      propertyType: row.propertyType || '—',
      propertyCategory: row.propertyCategory || '—',
      staff: row.staff ?? 'Unassigned',
      assignedStaffId: row.assignedStaffId,
      source: row.source ?? '',
      status: row.status ?? 'New Lead',
      department: row.department ?? 'telecalling',
      notes: '',
      nextFollowUpDate: row.nextFollowUpDate || null,
      nextFollowUpTime: row.nextFollowUpTime || null,
      priority: row.priority ?? '',
      lastFollowedUpDate: row.lastFollowedUpDate || null,
      lastFollowedUpTime: row.lastFollowedUpTime || null,
      lastFollowedUpNotes: row.lastFollowedUpNotes || null,
      isUnqualified: Boolean(row.isUnqualified),
      // Optional list columns (hidden until picked in the Columns menu).
      whatsapp: row.whatsapp || null,
      city: row.city || null,
      updatedAt: row.updatedAt,
      purchaseType: row.purchaseType || null,
      purchaseTimeline: row.purchaseTimeline || null,
      locations: listOf(row.subLocations),
      ...budgetOf(row.preferences),
    }));

    const optionSets = {
      status: new Set<string>(),
      source: new Set<string>(),
      category: new Set<string>(),
      type: new Set<string>(),
      staff: new Set<string>(),
    };
    for (const row of optionRows) {
      if (row.value) optionSets[row.kind as keyof typeof optionSets].add(String(row.value));
    }

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        filterOptions: {
          statuses: [...optionSets.status].sort(),
          sources: [...optionSets.source].sort(),
          categories: [...optionSets.category].sort(),
          types: [...optionSets.type].sort(),
          staff: [...optionSets.staff].sort(),
        },
      }
    };
  }

  async getCities(): Promise<{ id: number; city_name: string }[]> {
    return this.siteDataSource.query(
      `SELECT id, city_name FROM cities WHERE is_active = 1 ORDER BY city_name ASC`
    );
  }

  async getSublocations(cityId: number): Promise<{ id: number; locality_name: string }[]> {
    return this.siteDataSource.query(
      `SELECT id, locality_name FROM sublocations WHERE city_id = ? AND is_active = 1 ORDER BY locality_name ASC`,
      [cityId]
    );
  }

  /**
   * Site properties and projects that fit a requirement: the one asked for,
   * else the lead's latest. Missing preferences only widen the search.
   */
  async autoMatchProperties(leadId: number, inquiryId?: number) {
    const inquiries = await this.dataSource.getRepository(LeadInquiry).find({
      where: { lead: { id: leadId } },
      order: { created_at: 'DESC', id: 'DESC' },
    });
    const inquiry = inquiryId ? inquiries.find((i) => i.id === inquiryId) : inquiries[0];
    if (!inquiry) throw new NotFoundException('Add a requirement to find matching properties.');

    const [city] = inquiry.city_id
      ? await this.siteDataSource.query('SELECT city_name FROM cities WHERE id = ?', [inquiry.city_id])
      : [];
    const criteria = matchCriteria(inquiry, city?.city_name ?? null);
    const wide = similarCriteria(criteria);
    const run = async (build: typeof propertyMatchQuery | typeof projectMatchQuery) => {
      const exactQuery = build(criteria);
      const exact: any[] = exactQuery ? await this.siteDataSource.query(exactQuery.sql, exactQuery.params) : [];
      // Few exact matches: add the closest listings from the wider search.
      // Nothing of that kind to rent (or buy) either: offer it the other way.
      let similar: any[] = [];
      if (exact.length < SIMILAR_WHEN) {
        const stages = criteria.listing ? [wide.criteria, { ...wide.criteria, listing: null }] : [wide.criteria];
        for (const stage of stages) {
          const query = build(stage, { target: wide.target, exclude: exact.map((r) => r.id) });
          similar = query ? await this.siteDataSource.query(query.sql, query.params) : [];
          if (similar.length) break;
        }
      }
      return [...exact.map((row) => ({ ...row, match: 'exact' })), ...similar.map((row) => ({ ...row, match: 'similar' }))].map((row) => ({
        ...row,
        photo: photoUrl(row.photo),
        ...(build === propertyMatchQuery ? { share_title: propertyShareName(row) } : {}),
      }));
    };
    const [properties, projects] = await Promise.all([run(propertyMatchQuery), run(projectMatchQuery)]);
    return { inquiryId: inquiry.id, properties, projects };
  }

  /**
   * Any available property or published project with an available unit whose
   * name, code, area or builder matches what staff typed. Booked and sold
   * listings never show, as in the matches.
   */
  async searchListings(search: string) {
    const term = search.trim().slice(0, 100);
    if (term.length < 2) return { properties: [], projects: [] };
    const criteria = { ...NO_CRITERIA, search: term };
    const run = async (build: typeof propertyMatchQuery | typeof projectMatchQuery) => {
      const query = build(criteria);
      const rows: any[] = query ? await this.siteDataSource.query(query.sql, query.params) : [];
      return rows.map((row) => ({
        ...row, match: 'search', photo: photoUrl(row.photo),
        ...(build === propertyMatchQuery ? { share_title: propertyShareName(row) } : {}),
      }));
    };
    const [properties, projects] = await Promise.all([run(propertyMatchQuery), run(projectMatchQuery)]);
    return { properties, projects };
  }

  async uploadDocument(leadId: number, file: Express.Multer.File, actorId: number | null = null) {
    const lead = await this.dataSource.getRepository(Lead).findOne({ where: { id: leadId }, relations: { documents: true } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.documents.length >= 2) {
      throw new BadRequestException('Maximum 2 documents allowed per lead');
    }
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    const has1 = lead.documents.some(d => d.file_name.includes('_attachment1'));
    const attachmentNum = has1 ? 2 : 1;
    const leadDisplayId = `L${String(leadId).padStart(5, '0')}`;
    const fileExt = extname(file.originalname);
    const fileName = `${leadDisplayId}_attachment${attachmentNum}${fileExt}`;
    const fileKey = `leads/${leadDisplayId}/attachments/${fileName}`;

    // Image attachments get the shared faint watermark baked in (temp →
    // process → final webp). Non-image documents are stored untouched.
    // Fail open: if imgproxy is unreachable, keep the original file.
    let finalKey = fileKey;
    let finalName = fileName;
    let finalBuffer: Buffer | Uint8Array = file.buffer;
    let finalType = file.mimetype;
    if (isImageMimetype(file.mimetype)) {
      const tempKey = `leads/${leadDisplayId}/attachments/temp_${Date.now()}${fileExt}`;
      await this.s3Client.write(tempKey, file.buffer, {
        type: file.mimetype,
      });
      try {
        finalBuffer = await fetchWatermarkedImage(
          `${process.env.R2_PUBLIC_URL}/${tempKey}`,
        );
        finalName = fileName.replace(/\.[^/.]+$/, '') + '.webp';
        finalKey = `leads/${leadDisplayId}/attachments/${finalName}`;
        finalType = 'image/webp';
      } catch (e) {
        console.error('Imgproxy watermark failed, using original:', e);
      } finally {
        this.s3Client.delete(tempKey).catch(() => {});
      }
    }

    await this.s3Client.write(finalKey, finalBuffer, {
      type: finalType,
    });

    const fileUrl = `${process.env.R2_PUBLIC_URL}/${finalKey}`;

    const repo = this.dataSource.getRepository(LeadDocument);
    const doc = repo.create({
      lead_id: leadId,
      file_name: finalName,
      file_url: fileUrl,
      file_key: finalKey,
    });
    const saved = await repo.save(doc);
    await this.leadEvents?.record({ leadId, actorId, type: 'document_added', to: finalName, meta: { url: fileUrl } });
    return saved;
  }

  async deleteDocument(leadId: number, docId: number, actorId: number | null = null) {
    const repo = this.dataSource.getRepository(LeadDocument);
    const doc = await repo.findOne({ where: { id: docId, lead_id: leadId } });
    if (!doc) throw new NotFoundException('Document not found');

    try {
      await this.s3Client.delete(doc.file_key);
    } catch (e) {
      console.error(`Failed to delete document from R2: ${e}`);
    }

    await repo.remove(doc);
    await this.leadEvents?.record({ leadId, actorId, type: 'document_removed', from: doc.file_name });
    return { id: docId };
  }
}
