import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Lead } from '../../database/entities/lead.entity';
import { LeadFollowUp } from '../../database/entities/lead-follow-up.entity';
import { LeadInquiry } from '../../database/entities/lead-inquiry.entity';
import { LeadStatus } from '../../database/entities/lead-status.entity';

@Injectable()
export class LeadsService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async createLead(body: any): Promise<Lead> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const statusRepo = manager.getRepository(LeadStatus);
      const incomingStatus = await statusRepo.findOne({ where: { name: 'INCOMING' } });

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
      });
      const savedLead: Lead = await manager.save(lead);

      // Save inquiry (requirement info)
      if (body.purchaseType || body.propertyType || body.funder) {
        const inquiryRepo = manager.getRepository(LeadInquiry);
        const inquiry = inquiryRepo.create({
          lead_id: savedLead.id,
          project_list: body.project || null,
          purchase_type: body.purchaseType || null,
          property_type: body.propertyType || null,
          funder: body.funder || null,
        });
        await manager.save(inquiry);
      }

      // Save follow-up if any follow-up data is provided
      if (body.followUpDate || body.purpose || body.priority || body.notes) {
        const followUpRepo = manager.getRepository(LeadFollowUp);
        const followUp = followUpRepo.create({
          lead_id: savedLead.id,
          follow_up_date: body.followUpDate || null,
          follow_up_time: body.followUpTime || null,
          purpose: body.purpose || null,
          priority: body.priority || null,
          notes: body.notes || null,
        });
        await manager.save(followUp);
      }

      return savedLead;
    });
  }

  async getLeads(): Promise<any[]> {
    const leadRepo = this.dataSource.getRepository(Lead);
    const leads = await leadRepo.find({
      relations: { status: true, assigned_staff: true },
      order: { created_at: 'DESC' },
    });

    return leads.map((lead: Lead, index: number) => ({
      sno: index + 1,
      id: 'L' + String(lead.id).padStart(5, '0'),
      date: new Date(lead.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      name: lead.name,
      mobile: lead.mobile_number,
      propertyType: '',
      staff: lead.assigned_staff?.name ?? 'Unassigned',
      source: lead.lead_source ?? '',
      status: lead.status?.name ?? 'INCOMING',
      notes: '',
    }));
  }
}
