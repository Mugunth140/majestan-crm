import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { Lead } from '../../database/entities/lead.entity';
import { LeadFollowUp } from '../../database/entities/lead-follow-up.entity';
import { LeadInquiry } from '../../database/entities/lead-inquiry.entity';
import { ContactLog } from '../../database/entities/contact-log.entity';
import { User } from '../../database/entities/user.entity';
import { LeadDocument } from '../../database/entities/lead-document.entity';
import { NON_QUEUEABLE_LEAD_STATUSES } from './lead-statuses';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { S3Client } from 'bun';
import { extname } from 'path';
import { fetchWatermarkedImage, isImageMimetype } from '../../common/imgproxy-watermark';

export interface CreateLeadResult {
  lead: Lead;
  isExistingCustomer: boolean;
  existingStaff?: string;
}

export interface DuplicateLeadInfo {
  id: number;
  displayId: string;
  name: string;
  status: string;
  staff: string;
}

@Injectable()
export class LeadsService {
  private _s3Client: S3Client | null = null;

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectDataSource('site') private siteDataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly tasksService: TasksService,
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

    return { ...lead, follow_ups: followUps, contact_logs: contactLogs };
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
  async addFollowUp(leadId: number, body: any) {
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
    followUp.created_by_id = body.createdById || null;
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
    followUp.next_follow_up_date = body.nextFollowUpDate ?? followUp.next_follow_up_date;
    followUp.next_follow_up_time = body.nextFollowUpTime ?? followUp.next_follow_up_time;
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

  async updateLeadStatus(id: number, body: { status_name?: string; is_unqualified?: boolean; drop_reason?: string }) {
    const leadRepo = this.dataSource.getRepository(Lead);
    const existingLead = await leadRepo.findOne({ where: { id } });
    if (!existingLead) throw new NotFoundException('Lead not found');

    if (body.status_name) {
      existingLead.status = body.status_name;
    }

    if (body.is_unqualified !== undefined) {
      existingLead.is_unqualified = body.is_unqualified;
    }

    if (body.drop_reason !== undefined) {
      existingLead.drop_reason = body.drop_reason || null;
    }

    const saved = await leadRepo.save(existingLead);

    // Auto-increment task metrics based on new lead status
    if (body.status_name && existingLead.assigned_staff_id) {
      this.tasksService.autoIncrementFromLeadStatus(saved, body.status_name).catch(err => {
        console.error('Task auto-increment error (non-fatal):', err?.message);
      });
    }

    return saved;
  }

  async updateLead(id: number, body: any) {
    return this.dataSource.transaction(async (manager) => {
      const leadRepo = manager.getRepository(Lead);
      const existingLead = await leadRepo.findOne({ where: { id } });
      if (!existingLead) throw new NotFoundException('Lead not found');

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

      return existingLead;
    });
  }

  async updateInquiry(leadId: number, inquiryId: number, body: any) {
    const inquiryRepo = this.dataSource.getRepository(LeadInquiry);
    const inquiry = await inquiryRepo.findOne({ where: { id: inquiryId, lead_id: leadId } });
    if (!inquiry) throw new NotFoundException('Inquiry not found');

    if (body.project !== undefined) inquiry.project_list = body.project;
    if (body.purchaseType !== undefined) inquiry.purchase_type = body.purchaseType;
    if (body.propertyType !== undefined) inquiry.property_type = body.propertyType;
    if (body.propertyCategory !== undefined) inquiry.property_category = body.propertyCategory;
    if (body.funder !== undefined) inquiry.funder = body.funder;
    if (body.preferences !== undefined) inquiry.preferences = body.preferences;
    if (body.cityId !== undefined) inquiry.city_id = body.cityId;
    if (body.subLocations !== undefined) inquiry.sub_locations = body.subLocations;
    if (body.purchaseTimeline !== undefined) inquiry.purchase_timeline = body.purchaseTimeline;
    if (body.qualificationPurpose !== undefined) inquiry.qualification_purpose = body.qualificationPurpose;
    if (body.decisionMaker !== undefined) inquiry.decision_maker = body.decisionMaker;

    return inquiryRepo.save(inquiry);
  }

  async bulkCreateLeads(leads: any[], actionedBy?: any) {
    if (!leads || leads.length === 0) return { count: 0, created: 0, existing: 0, assigned: 0 };

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
      source: body.source ?? body.lead_source ?? null,
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

  async createLead(body: any): Promise<CreateLeadResult> {    // Normalise: frontend sends 'mobile', legacy DTO used 'mobile_number'
    const mobile = (body.mobile ?? body.mobile_number ?? '').toString().trim();
    if (!mobile) {
      throw new BadRequestException('mobile is required');
    }
    const normalised = { ...body, mobile };

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const existingLead = await manager.getRepository(Lead).findOne({
        where: { mobile_number: mobile },
        relations: { assigned_staff: true },
      });

      if (existingLead) {
        if (normalised.purchaseType || normalised.propertyType || normalised.funder || normalised.project || normalised.propertyCategory) {
          const inquiry = manager.getRepository(LeadInquiry).create({
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
          });
          await manager.save(inquiry);
        }

        if (normalised.followUpDate || normalised.purpose || normalised.priority || normalised.notes || normalised.rnr) {
        const followUp = manager.getRepository(LeadFollowUp).create({
          lead_id: existingLead.id,
          next_follow_up_date: normalised.followUpDate || null,
          next_follow_up_time: normalised.followUpTime || null,
          purpose: normalised.purpose || null,
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
        status: 'New Lead',
        assigned_staff_id: assignedStaffId,
        commission: normalised.commission || null,
        is_referral: normalised.isReferral || false,
        referred_by_name: normalised.referredByName || null,
        referred_by_contact: normalised.referredByContact || null,
      });
      const savedLead: Lead = await manager.save(lead);

      // Auto-increment sourcing metric if assigned to sales staff
      if (savedLead.department === 'sales' && savedLead.assigned_staff_id) {
        this.tasksService.autoIncrementSourcing(savedLead.assigned_staff_id).catch(err => {
          console.error('Task sourcing auto-increment error (non-fatal):', err?.message);
        });
      }

      if (normalised.purchaseType || normalised.propertyType || normalised.funder || normalised.project || normalised.propertyCategory) {
        const inquiry = manager.getRepository(LeadInquiry).create({
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
        });
        await manager.save(inquiry);
      }

      if (normalised.followUpDate || normalised.purpose || normalised.priority || normalised.notes || normalised.rnr) {
        const followUp = manager.getRepository(LeadFollowUp).create({
          lead_id: savedLead.id,
          next_follow_up_date: normalised.followUpDate || null,
          next_follow_up_time: normalised.followUpTime || null,
          purpose: normalised.purpose || null,
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

    let roleFilter = '';
    if (user && user.role === 'Staff') {
      roleFilter = `AND l.assigned_staff_id = ${Number(user.id)}`;
    } else if (user && user.role === 'Team Lead') {
      roleFilter = `AND l.assigned_staff_id IN (SELECT id FROM users WHERE department_id = ${Number(user.department_id)})`;
    } else {
      roleFilter = `AND l.assigned_staff_id IS NOT NULL`;
    }

    const params: any[] = [];
    let filterConds = '';

    if (query?.dept) {
      filterConds += ' AND l.department = ?';
      params.push(query.dept);
    }

    if (query?.search) {
      const s = `%${query.search}%`;
      filterConds += ' AND (l.name LIKE ? OR l.mobile_number LIKE ? OR l.email LIKE ? OR l.id LIKE ?)';
      params.push(s, s, s, s);
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
      filterConds += ' AND l.is_unqualified = 1';
    } else {
      filterConds += ' AND l.is_unqualified = 0';
    }

    // Action required filters
    if (query?.tab === 'Action Required' && query?.actionFilter) {
       const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
       const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
       const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

       if (query.actionFilter === 'Overdue') {
         filterConds += ` AND latest_f.next_follow_up_date < '${today}'`;
       } else if (query.actionFilter === 'Yesterday') {
         filterConds += ` AND EXISTS (SELECT 1 FROM lead_follow_ups f WHERE f.lead_id = l.id AND DATE(f.follow_up_date) = '${yesterday}')`;
        } else if (query.actionFilter === 'Today') {
          if (query.todayViewMode === 'completed') {
            filterConds += ` AND EXISTS (SELECT 1 FROM lead_follow_ups f WHERE f.lead_id = l.id AND DATE(f.follow_up_date) = '${today}')`;
            filterConds += ` AND (latest_f.next_follow_up_date IS NULL OR DATE(latest_f.next_follow_up_date) != '${today}')`;
          } else {
            filterConds += ` AND DATE(latest_f.next_follow_up_date) = '${today}'`;
          }
       } else if (query.actionFilter === 'Tomorrow') {
         filterConds += ` AND DATE(latest_f.next_follow_up_date) = '${tomorrow}'`;
       } else if (query.actionFilter === 'All Scheduled') {
         filterConds += ` AND DATE(latest_f.next_follow_up_date) > '${tomorrow}'`;
       }
    }

    // Closed leads never queue for action — but an explicit status filter
    // always wins, so staff can still list them on purpose.
    if (!query?.status && (query?.tab === 'Action Required' || query?.actionFilter)) {
      filterConds += ` AND l.status NOT IN (${NON_QUEUEABLE_LEAD_STATUSES.map(() => '?').join(', ')})`;
      params.push(...NON_QUEUEABLE_LEAD_STATUSES);
    }

    // Because action required relies on follow_up subqueries, we need them in count query as well.
    const joinClauses = `
      LEFT JOIN users s ON l.assigned_staff_id = s.id
      LEFT JOIN (
        SELECT lead_id, property_type, property_category, preferences,
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

    const countSql = `
      SELECT COUNT(*) as count 
      FROM leads l 
      ${joinClauses} 
      WHERE 1=1 ${roleFilter} ${filterConds}
    `;

    const countResult = await this.dataSource.query(countSql, params);
    const total = Number(countResult[0]?.count || 0);

    const dataSql = `
      SELECT 
        l.id as rawId, 
        l.assigned_staff_id as assignedStaffId,
        l.name, 
        l.mobile_number as mobile, 
        l.email, 
        l.status, 
        l.department,
        l.lead_source as source, 
        l.is_unqualified as isUnqualified, 
        l.created_at as createdAt,
        s.name as staff,
        i.property_type as propertyType, 
        i.property_category as propertyCategory,
        latest_f.next_follow_up_date as nextFollowUpDate,
        latest_f.next_follow_up_time as nextFollowUpTime,
        latest_f.priority as priority,
        latest_actual_f.follow_up_date as lastFollowedUpDate,
        latest_actual_f.follow_up_time as lastFollowedUpTime,
        latest_actual_f.notes as lastFollowedUpNotes
      FROM leads l
      ${joinClauses}
      WHERE 1=1 ${roleFilter} ${filterConds}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rawLeads = await this.dataSource.query(dataSql, [...params, limit, offset]);

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
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
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

  async autoMatchProperties(leadId: number) {
    const lead = await this.dataSource.getRepository(Lead).findOne({
      where: { id: leadId },
      relations: { inquiries: true },
    });
    if (!lead || !lead.inquiries?.length) throw new NotFoundException('Lead or inquiry not found');

    const inquiry = lead.inquiries[0];
    const prefs = inquiry.preferences;
    if (!prefs || Object.keys(prefs).length === 0) {
      throw new ConflictException('Please define customer preferences (like budget or area) to auto-match properties.');
    }

    let query = `
      SELECT p.id, p.title, p.price, p.property_type, p.status, p.slug, p.city, p.listing_type, 
             pd.bedrooms, pd.bathrooms, pd.area_sqft, pd.furnished
      FROM properties p
      LEFT JOIN property_details pd ON p.id = pd.property_id
      WHERE p.status = 'available'
    `;
    const params: any[] = [];

    // Basic map for property type if there is a match in enum
    // property_type enum: 'apartment','villa','plot','commercial','coworking','farmland','industrial','other','individual_portion'
    if (inquiry.property_type) {
      let mappedType = inquiry.property_type.toLowerCase();
      const validTypes = ['apartment', 'villa', 'plot', 'commercial', 'coworking', 'farmland', 'industrial', 'other', 'individual_portion'];
      if (validTypes.includes(mappedType)) {
        query += ` AND p.property_type = ?`;
        params.push(mappedType);
      }
    }

    if (prefs.minBudget) {
      query += ` AND p.price >= ?`;
      params.push(Number(prefs.minBudget));
    }
    if (prefs.maxBudget) {
      query += ` AND p.price <= ?`;
      params.push(Number(prefs.maxBudget));
    }
    if (prefs.bhk) {
      query += ` AND pd.bedrooms = ?`;
      params.push(Number(prefs.bhk));
    }
    if (prefs.minArea) {
      query += ` AND pd.area_sqft >= ?`;
      params.push(Number(prefs.minArea));
    }
    if (prefs.maxArea) {
      query += ` AND pd.area_sqft <= ?`;
      params.push(Number(prefs.maxArea));
    }

    query += ` ORDER BY p.created_at DESC LIMIT 20`;

    return this.siteDataSource.query(query, params);
  }

  async uploadDocument(leadId: number, file: Express.Multer.File) {
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
    return repo.save(doc);
  }

  async deleteDocument(leadId: number, docId: number) {
    const repo = this.dataSource.getRepository(LeadDocument);
    const doc = await repo.findOne({ where: { id: docId, lead_id: leadId } });
    if (!doc) throw new NotFoundException('Document not found');

    try {
      await this.s3Client.delete(doc.file_key);
    } catch (e) {
      console.error(`Failed to delete document from R2: ${e}`);
    }

    await repo.remove(doc);
    return { id: docId };
  }
}
