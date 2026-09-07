import { Injectable, NotFoundException } from '@nestjs/common';
import { SiteApiService } from '../properties/site-api.service';
import { ProjectQueryDto } from './dto/project-query.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly siteApi: SiteApiService) {}

  async findAll(query: ProjectQueryDto) {
    const rawPage = Number(query.page) || 1;
    const rawLimit = Number(query.limit) || 10;
    const page = Math.max(1, rawPage);
    const limit = Math.min(200, Math.max(1, rawLimit));
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    const search = [query.search, query.city].filter(Boolean).join(' ');
    if (search) params.append('search', search);
    if (query.status) params.append('status', query.status);
    if (query.projectType) params.append('projectType', query.projectType);
    const res = await this.siteApi.get(`/admin/projects?${params.toString()}`);
    const items = res?.items ?? [];
    const total = Number(res?.total) || 0;
    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    let record: any;
    try {
      record = await this.siteApi.get(`/admin/projects/${id}`);
    } catch (e: any) {
      if (e?.status === 404 || e?.getStatus?.() === 404) throw new NotFoundException(`Project #${id} not found`);
      throw e;
    }
    if (!record) throw new NotFoundException(`Project #${id} not found`);
    return record;
  }

  async create(dto: Record<string, any>) {
    return this.siteApi.post('/admin/projects', dto);
  }

  async update(id: number, dto: Record<string, any>) {
    try {
      return await this.siteApi.patch(`/admin/projects/${id}`, dto);
    } catch (e: any) {
      if (e?.status === 404 || e?.getStatus?.() === 404) throw new NotFoundException(`Project #${id} not found`);
      throw e;
    }
  }

  async updateStatus(id: number, status: string) {
    try {
      return await this.siteApi.patch(`/admin/projects/${id}/status`, { status });
    } catch (e: any) {
      if (e?.status === 404 || e?.getStatus?.() === 404) throw new NotFoundException(`Project #${id} not found`);
      throw e;
    }
  }

  async remove(id: number) {
    try {
      return await this.siteApi.del(`/admin/projects/${id}`);
    } catch (e: any) {
      if (e?.status === 404 || e?.getStatus?.() === 404) throw new NotFoundException(`Project #${id} not found`);
      throw e;
    }
  }
}
