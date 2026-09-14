import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LeadSource } from '../../database/entities/lead-source.entity';
import { SiteApiService } from '../properties/site-api.service';

@Injectable()
export class MasterService {
  constructor(
    @InjectDataSource() private crmDataSource: DataSource,
    @InjectDataSource('site') private siteDataSource: DataSource,
    private readonly siteApi: SiteApiService,
  ) {}

  // ---- Cities (read via direct DB, CRUD via site admin API) ----

  async getCities() {
    try {
      const rows = await this.siteDataSource.query(
        'SELECT id, city_name FROM cities WHERE is_active = 1 ORDER BY city_name ASC',
      );
      return rows.map((r: { id: number; city_name: string }) => ({
        label: r.city_name,
        value: r.city_name,
      }));
    } catch (e) {
      throw new InternalServerErrorException('Failed to load cities');
    }
  }

  async getAllCities(search?: string) {
    try {
      let sql = 'SELECT id, city_name, state_name, country_name, country_code, is_active FROM cities';
      const params: any[] = [];
      if (search) {
        sql += ' WHERE city_name LIKE ? OR state_name LIKE ?';
        params.push(`%${search}%`, `%${search}%`);
      }
      sql += ' ORDER BY city_name ASC';
      return await this.siteDataSource.query(sql, params);
    } catch (e) {
      throw new InternalServerErrorException('Failed to load cities');
    }
  }

  async createCity(data: { city_name: string; state_name: string; country_name?: string; country_code?: string; is_active?: number }) {
    return this.siteApi.post('/admin/cities', { data });
  }

  async updateCity(id: number, data: { city_name?: string; state_name?: string; country_name?: string; country_code?: string; is_active?: number }) {
    return this.siteApi.patch(`/admin/cities/${id}`, { data });
  }

  async deleteCity(id: number) {
    return this.siteApi.del(`/admin/cities/${id}`);
  }

  // ---- Sublocations ----

  async getSublocations(cityName: string) {
    if (!cityName) return [];
    try {
      const rows = await this.siteDataSource.query(
        `SELECT s.id, s.locality_name
         FROM sublocations s
         JOIN cities c ON s.city_id = c.id
         WHERE c.city_name = ? AND s.is_active = 1
         ORDER BY s.locality_name ASC`,
        [cityName],
      );
      return rows.map((r: { id: number; locality_name: string }) => ({
        label: r.locality_name,
        value: r.locality_name,
      }));
    } catch (e) {
      throw new InternalServerErrorException('Failed to load sublocations');
    }
  }

  async getAllSublocations(search?: string) {
    try {
      let sql = `SELECT s.id, s.city_id, s.locality_name, s.postal_code, s.is_active,
                        c.city_name, c.state_name, c.country_name
                 FROM sublocations s
                 LEFT JOIN cities c ON c.id = s.city_id`;
      const params: any[] = [];
      if (search) {
        sql += ' WHERE s.locality_name LIKE ? OR c.city_name LIKE ?';
        params.push(`%${search}%`, `%${search}%`);
      }
      sql += ' ORDER BY c.city_name ASC, s.locality_name ASC';
      return await this.siteDataSource.query(sql, params);
    } catch (e) {
      throw new InternalServerErrorException('Failed to load sublocations');
    }
  }

  async createSublocation(data: { city_id: number; locality_name: string; postal_code?: string; is_active?: number }) {
    return this.siteApi.post('/admin/sublocations', { data });
  }

  async updateSublocation(id: number, data: { city_id?: number; locality_name?: string; postal_code?: string; is_active?: number }) {
    return this.siteApi.patch(`/admin/sublocations/${id}`, { data });
  }

  async deleteSublocation(id: number) {
    return this.siteApi.del(`/admin/sublocations/${id}`);
  }

  // ---- Projects ----

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

  // ---- Lead Sources ----

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
