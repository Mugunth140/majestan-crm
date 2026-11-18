import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LeadSource } from '../../../database/entities/lead-source.entity';
import { LeadsService } from '../leads.service';
import { PortalLeadsDto } from '../dto/portal-leads.dto';

/** Lead Source each portal's leads are filed under (names match case-insensitively). */
export const PORTAL_SOURCES = { ninetyNineAcres: '99acres', magicbricks: 'Magic Bricks' } as const;

@Injectable()
export class PortalLeadsService {
  constructor(@InjectDataSource() private readonly db: DataSource, private readonly leads: LeadsService) {}

  async receive(sourceName: string, body: PortalLeadsDto) {
    const source = await this.db.getRepository(LeadSource).findOne({ where: { name: sourceName, is_active: true } });
    if (!source) throw new ServiceUnavailableException(`The ${sourceName} Lead Source must be active`);
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
