import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Lead } from '../../database/entities/lead.entity';
import { LeadFollowUp } from '../../database/entities/lead-follow-up.entity';
import { LeadInquiry } from '../../database/entities/lead-inquiry.entity';
import { LeadStatus } from '../../database/entities/lead-status.entity';
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
      relations: { inquiries: true, follow_ups: true, status: true, assigned_staff: true }
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async deleteLead(id: number) {
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(LeadInquiry).delete({ lead_id: id });
      await manager.getRepository(LeadFollowUp).delete({ lead_id: id });
      await manager.getRepository(Lead).delete(id);
    });
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

      if (body.followUpDate || body.purpose || body.priority || body.notes || body.rnr) {
        const followUpRepo = manager.getRepository(LeadFollowUp);
        let followUp = await followUpRepo.findOne({ where: { lead_id: id } });
        if (!followUp) followUp = followUpRepo.create({ lead_id: id });
        followUp.follow_up_date = body.followUpDate || null;
        followUp.follow_up_time = body.followUpTime || null;
        followUp.purpose = body.purpose || null;
        followUp.priority = body.priority || null;
        followUp.rnr = body.rnr || null;
        followUp.notes = body.notes || null;
        await manager.save(LeadFollowUp, followUp);
      }

      return existingLead;
    });
  }

  async bulkCreateLeads(leads: any[]) {
    let count = 0;
    for (const body of leads) {
      try {
        await this.createLead(body);
        count++;
      } catch (err) {
        // Skip existing/failed leads in bulk import
        console.error("Bulk import error for lead", body.mobile, err);
      }
    }
    return { count };
  }

  async createLead(body: any): Promise<CreateLeadResult> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      // ── Check for existing customer by mobile number ──────────────────────
      const existingLead = await manager.getRepository(Lead).findOne({
        where: { mobile_number: body.mobile },
        relations: { assigned_staff: true, status: true },
      });

      if (existingLead) {
        // Same customer, new requirement → add a new inquiry to the existing lead
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

        // Also log a new follow-up if one was provided
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

      // ── New customer ──────────────────────────────────────────────────────
      const statusRepo = manager.getRepository(LeadStatus);
      const incomingStatus = await statusRepo.findOne({ where: { name: 'INCOMING' } });

      // Resolve the creating staff from userId sent in payload
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

      // Save inquiry
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

      // Save follow-up
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
      relations: { status: true, assigned_staff: true, inquiries: true },
      order: { created_at: 'DESC' },
    });

    return leads.map((lead: Lead, index: number) => ({
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
    }));
  }
}
