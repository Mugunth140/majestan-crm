import { Injectable, NotFoundException } from '@nestjs/common';
import { SiteApiService } from '../properties/site-api.service';

@Injectable()
export class BuildersService {
  constructor(private readonly siteApi: SiteApiService) {}

  async findAll(query: any) {
    const params = new URLSearchParams();
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      }
    }
    const queryString = params.toString();
    return this.siteApi.get(`/admin/builders${queryString ? `?${queryString}` : ''}`);
  }

  async findDropdown() {
    return this.siteApi.get('/admin/builders/dropdown');
  }

  async findOne(id: number) {
    try {
      const record = await this.siteApi.get(`/admin/builders/${id}`);
      if (!record) throw new NotFoundException(`Builder #${id} not found`);
      return record;
    } catch (e: any) {
      if (e?.status === 404 || e?.getStatus?.() === 404) {
        throw new NotFoundException(`Builder #${id} not found`);
      }
      throw e;
    }
  }

  async create(dto: any) {
    return this.siteApi.post('/admin/builders', dto);
  }

  async update(id: number, dto: any) {
    try {
      return await this.siteApi.put(`/admin/builders/${id}`, dto);
    } catch (e: any) {
      if (e?.status === 404 || e?.getStatus?.() === 404) {
        throw new NotFoundException(`Builder #${id} not found`);
      }
      throw e;
    }
  }

  async remove(id: number) {
    try {
      return await this.siteApi.del(`/admin/builders/${id}`);
    } catch (e: any) {
      if (e?.status === 404 || e?.getStatus?.() === 404) {
        throw new NotFoundException(`Builder #${id} not found`);
      }
      throw e;
    }
  }
}
