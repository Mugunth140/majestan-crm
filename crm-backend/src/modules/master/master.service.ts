import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LeadSource } from '../../database/entities/lead-source.entity';

@Injectable()
export class MasterService {
  constructor(
    @InjectDataSource() private crmDataSource: DataSource,
    @InjectDataSource('siteConnection') private siteDataSource: DataSource,
  ) {}

  async getCities() {
    try {
      const rows = await this.siteDataSource.query(
        'SELECT id, city_name FROM cities WHERE is_active = 1 ORDER BY city_name ASC',
      );
      return rows.map((r: { id: number; city_name: string }) => ({
        label: r.city_name,
        value: r.city_name, // store city name in Lead.city column
      }));
    } catch (e) {
      throw new InternalServerErrorException('Failed to load cities');
    }
  }

  async getProjects() {
    try {
      const rows = await this.siteDataSource.query(
        "SELECT id, title FROM properties WHERE status = 'available' ORDER BY title ASC",
      );
      return rows.map((r: { id: number; title: string }) => ({
        label: r.title,
        value: String(r.id),
      }));
    } catch (e) {
      throw new InternalServerErrorException('Failed to load projects');
    }
  }

  async getLeadSources() {
    const repo = this.crmDataSource.getRepository(LeadSource);
    const sources = await repo.find({ where: { is_active: true }, order: { name: 'ASC' } });
    return sources.map((s) => ({ label: s.name, value: s.name })); // store source name in Lead.lead_source
  }

  async createLeadSource(name: string) {
    const repo = this.crmDataSource.getRepository(LeadSource);
    const existing = await repo.findOne({ where: { name } });
    if (existing) {
      return { label: existing.name, value: existing.name };
    }
    const created = await repo.save(repo.create({ name }));
    return { label: created.name, value: created.name };
  }
}
