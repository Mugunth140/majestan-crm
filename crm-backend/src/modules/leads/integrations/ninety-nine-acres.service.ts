import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LeadSource } from '../../../database/entities/lead-source.entity';
import { LeadsService } from '../leads.service';
import { NinetyNineAcresLeadsDto } from '../dto/ninety-nine-acres-leads.dto';

@Injectable()
export class NinetyNineAcresService {
  constructor(@InjectDataSource() private readonly db: DataSource, private readonly leads: LeadsService) {}

  async receive(body: NinetyNineAcresLeadsDto) {
    const source = await this.db.getRepository(LeadSource).findOne({ where: { name: '99acres', is_active: true } });
    if (!source) throw new ServiceUnavailableException('The 99acres Lead Source must be active');
    const rows = body.leads.map(row => ({
      name: row.name,
      mobile: row.mobile,
      email: row.email,
      commissionRemarks: row.remarks,
      leadSourceId: source.id,
    }));
    // Match bulk import's duplicate-mobile handling and keep portal input out of staff assignment.
    const result = await this.leads.bulkCreateLeads(rows, { role: 'Staff' });
    return { success: true, received: rows.length, created: result.created, existing: result.existing };
  }
}
