import { Injectable } from '@nestjs/common';
import { SiteApiService } from '../properties/site-api.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

@Injectable()
export class AdsService {
  constructor(private readonly siteApi: SiteApiService) {}

  list(query: { placement?: string } = {}) {
    const q = query.placement ? `?placement=${encodeURIComponent(query.placement)}` : '';
    return this.siteApi.get(`/admin/ads${q}`);
  }

  getOne(id: number) {
    return this.siteApi.get(`/admin/ads/${id}`);
  }

  create(body: CreateAdDto) {
    return this.siteApi.post('/admin/ads', body);
  }

  update(id: number, body: UpdateAdDto) {
    return this.siteApi.patch(`/admin/ads/${id}`, body);
  }

  setStatus(id: number, isActive: boolean) {
    return this.siteApi.patch(`/admin/ads/${id}/status`, { isActive });
  }

  reorder(ids: number[]) {
    return this.siteApi.patch('/admin/ads/reorder', { ids });
  }

  presignedUrl(fileName: string, fileType: string) {
    const q = new URLSearchParams({ fileName, fileType }).toString();
    return this.siteApi.get(`/admin/ads/presigned-url?${q}`);
  }
}
