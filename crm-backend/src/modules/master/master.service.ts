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
    return sources.map((s) => ({ id: s.id, label: s.name, value: s.name, is_active: s.is_active }));
  }

  async getAllLeadSources() {
    const repo = this.crmDataSource.getRepository(LeadSource);
    const sources = await repo.find({ order: { name: 'ASC' } });
    return sources.map((s) => ({ id: s.id, label: s.name, value: s.name, is_active: s.is_active, name: s.name }));
  }

  async createLeadSource(name: string) {
    const repo = this.crmDataSource.getRepository(LeadSource);
    const existing = await repo.findOne({ where: { name } });
    if (existing) {
      return { id: existing.id, label: existing.name, value: existing.name, is_active: existing.is_active };
    }
    const created = await repo.save(repo.create({ name }));
    return { id: created.id, label: created.name, value: created.name, is_active: created.is_active };
  }

  async updateLeadSource(id: number, data: { name: string; is_active: boolean }) {
    const repo = this.crmDataSource.getRepository(LeadSource);
    const source = await repo.findOne({ where: { id } });
    if (!source) throw new InternalServerErrorException('Source not found');
    source.name = data.name;
    source.is_active = data.is_active;
    const updated = await repo.save(source);
    return { id: updated.id, label: updated.name, value: updated.name, is_active: updated.is_active };
  }

  async deleteLeadSource(id: number) {
    const repo = this.crmDataSource.getRepository(LeadSource);
    const result = await repo.delete(id);
    if (result.affected === 0) {
      throw new InternalServerErrorException('Source not found or could not be deleted');
    }
    return { success: true };
  }
}
