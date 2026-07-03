import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Lead } from '../../database/entities/lead.entity';
import { LeadFollowUp } from '../../database/entities/lead-follow-up.entity';
import { LeadInquiry } from '../../database/entities/lead-inquiry.entity';
import { LeadStatus } from '../../database/entities/lead-status.entity';
import { ContactLog } from '../../database/entities/contact-log.entity';
import { User } from '../../database/entities/user.entity';

export interface CreateLeadResult {
  lead: Lead;
  isExistingCustomer: boolean;
  existingStaff?: string;
}

@Injectable()
export class LeadsService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async getLeadById(id: number) {
    const lead = await this.dataSource.getRepository(Lead).findOne({
      where: { id },
      relations: {
        inquiries: true,
        status: true,
        assigned_staff: true,
      }
    });
    if (!lead) throw new NotFoundException('Lead not found');

    // Load follow-ups with created_by relation ordered chronologically
    const followUps = await this.dataSource.getRepository(LeadFollowUp).find({
      where: { lead_id: id },
      relations: { created_by: true },
      order: { created_at: 'DESC' },
    });

    // Load contact logs with sent_by relation
    const contactLogs = await this.dataSource.getRepository(ContactLog).find({
      where: { lead_id: id },
      relations: { sent_by: true },
      order: { created_at: 'DESC' },
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
    const lead = await this.dataSource.getRepository(Lead).findOne({ where: { id: leadId } });
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
    followUp.notes = body.notes || null;
    followUp.created_by_id = body.createdById || null;
    return repo.save(followUp);
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
      await manager.getRepository(LeadInquiry).delete({ lead_id: id });
      await manager.getRepository(LeadFollowUp).delete({ lead_id: id });
      await manager.getRepository(ContactLog).delete({ lead_id: id });
      await manager.getRepository(Lead).delete(id);
    });
  }

  async updateLeadStatus(id: number, body: { status_name?: string; is_unqualified?: boolean }) {
    const leadRepo = this.dataSource.getRepository(Lead);
    const existingLead = await leadRepo.findOne({ where: { id } });
    if (!existingLead) throw new NotFoundException('Lead not found');

    if (body.status_name) {
      const statusRepo = this.dataSource.getRepository(LeadStatus);
      const newStatus = await statusRepo.findOne({ where: { name: body.status_name } });
      if (newStatus) {
        existingLead.status_id = newStatus.id;
      }
    }

    if (body.is_unqualified !== undefined) {
      existingLead.is_unqualified = body.is_unqualified;
    }

    return leadRepo.save(existingLead);
  }

  async updateLead(id: number, body: any) {
    return this.dataSource.transaction(async (manager) => {
      const leadRepo = manager.getRepository(Lead);
      const existingLead = await leadRepo.findOne({ where: { id } });
      if (!existingLead) throw new NotFoundException('Lead not found');

      if (body.mobile && body.mobile !== existingLead.mobile_number) {
        const conflict = await leadRepo.findOne({ where: { mobile_number: body.mobile } });
        if (conflict) throw new ConflictException('Mobile number already belongs to another lead');
      }

      existingLead.name = body.name;
      existingLead.mobile_number = body.mobile;
      existingLead.email = body.email || null;
      existingLead.whatsapp_number = body.whatsapp || null;
      existingLead.city = body.city || null;
      existingLead.address = body.address || null;
      existingLead.lead_source = body.source || null;
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
        await manager.save(LeadInquiry, inquiry);
      }

      return existingLead;
    });
  }

  async bulkCreateLeads(leads: any[]) {
    let count = 0;
    for (const body of leads) {
      // Normalize field names from bulk import payload to createLead's expected shape
      const normalized = {
        ...body,
        mobile: body.mobile ?? body.mobile_number ?? null,
        source: body.source ?? body.lead_source ?? null,
      };
      try {
        await this.createLead(normalized);
        count++;
      } catch (err) {
        console.error('Bulk import error for lead', normalized.mobile, err?.message ?? err);
      }
    }
    return { count };
  }

  async createLead(body: any): Promise<CreateLeadResult> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const existingLead = await manager.getRepository(Lead).findOne({
        where: { mobile_number: body.mobile },
        relations: { assigned_staff: true, status: true },
      });

      if (existingLead) {
        if (body.purchaseType || body.propertyType || body.funder || body.project || body.propertyCategory) {
          const inquiry = manager.getRepository(LeadInquiry).create({
            lead_id: existingLead.id,
            project_list: body.project || null,
            purchase_type: body.purchaseType || null,
            property_type: body.propertyType || null,
            property_category: body.propertyCategory || null,
            funder: body.funder || null,
          });
          await manager.save(inquiry);
        }

        if (body.followUpDate || body.purpose || body.priority || body.notes || body.rnr) {
          const followUp = manager.getRepository(LeadFollowUp).create({
            lead_id: existingLead.id,
            follow_up_date: body.followUpDate || null,
            follow_up_time: body.followUpTime || null,
            purpose: body.purpose || null,
            priority: body.priority || null,
            rnr: body.rnr || null,
            notes: body.notes || null,
          });
          await manager.save(followUp);
        }

        return {
          lead: existingLead,
          isExistingCustomer: true,
          existingStaff: existingLead.assigned_staff?.name ?? 'Unassigned',
        };
      }

      const statusRepo = manager.getRepository(LeadStatus);
      const incomingStatus = await statusRepo.findOne({ where: { name: 'INCOMING' } });

      let assignedStaffId: number | undefined;
      if (body.userId) {
        const user = await manager.getRepository(User).findOne({ where: { id: body.userId } });
        if (user) assignedStaffId = user.id;
      }

      const leadRepo = manager.getRepository(Lead);
      const lead = leadRepo.create({
        name: body.name,
        mobile_number: body.mobile,
        email: body.email || null,
        whatsapp_number: body.whatsapp || null,
        city: body.city || null,
        address: body.address || null,
        lead_source: body.source || null,
        status_id: incomingStatus ? incomingStatus.id : undefined,
        assigned_staff_id: assignedStaffId,
      });
      const savedLead: Lead = await manager.save(lead);

      if (body.purchaseType || body.propertyType || body.funder || body.project || body.propertyCategory) {
        const inquiry = manager.getRepository(LeadInquiry).create({
          lead_id: savedLead.id,
          project_list: body.project || null,
          purchase_type: body.purchaseType || null,
          property_type: body.propertyType || null,
          property_category: body.propertyCategory || null,
          funder: body.funder || null,
        });
        await manager.save(inquiry);
      }

      if (body.followUpDate || body.purpose || body.priority || body.notes || body.rnr) {
        const followUp = manager.getRepository(LeadFollowUp).create({
          lead_id: savedLead.id,
          follow_up_date: body.followUpDate || null,
          follow_up_time: body.followUpTime || null,
          purpose: body.purpose || null,
          priority: body.priority || null,
          rnr: body.rnr || null,
          notes: body.notes || null,
        });
        await manager.save(followUp);
      }

      return { lead: savedLead, isExistingCustomer: false };
    });
  }

  async getLeads(): Promise<any[]> {
    const leadRepo = this.dataSource.getRepository(Lead);
    const leads = await leadRepo.find({
      relations: { status: true, assigned_staff: true, inquiries: true, follow_ups: true },
      order: { created_at: 'DESC' },
    });

    return leads.map((lead: Lead, index: number) => {
      // Find the most recent follow-up that has a next_follow_up_date scheduled
      const sortedFollowUps = (lead.follow_ups || [])
        .filter(f => f.next_follow_up_date)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const latestNextFollowUp = sortedFollowUps[0]?.next_follow_up_date || null;

      // Find the most recent actual follow-up date
      const sortedActualFollowUps = (lead.follow_ups || [])
        .filter(f => f.follow_up_date)
        .sort((a, b) => new Date(b.follow_up_date as string).getTime() - new Date(a.follow_up_date as string).getTime());
        
      const lastFollowedUpDate = sortedActualFollowUps[0]?.follow_up_date || null;

      return {
        sno: index + 1,
        id: 'L' + String(lead.id).padStart(5, '0'),
        rawId: lead.id,
        date: new Date(lead.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        name: lead.name,
        mobile: lead.mobile_number,
        propertyType: lead.inquiries?.[0]?.property_type || '—',
        staff: lead.assigned_staff?.name ?? 'Unassigned',
        source: lead.lead_source ?? '',
        status: lead.status?.name ?? 'INCOMING',
        notes: '',
        nextFollowUpDate: latestNextFollowUp,
        lastFollowedUpDate: lastFollowedUpDate,
      };
    });
  }
}
