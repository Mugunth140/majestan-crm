import { BadRequestException, Injectable } from '@nestjs/common';
import { SiteApiService } from '../properties/site-api.service';

export const SHOWCASE_SECTIONS = ['handpicked_properties', 'featured_projects'] as const;
export type ShowcaseSection = (typeof SHOWCASE_SECTIONS)[number];

/**
 * Showcases: the CRM-curated home-page sections. The picks live in the site
 * database; this proxies the site backend's /admin/showcases, like AdsService.
 */
@Injectable()
export class ShowcasesService {
  constructor(private readonly siteApi: SiteApiService) {}

  static section(value: string): ShowcaseSection {
    if (!(SHOWCASE_SECTIONS as readonly string[]).includes(value)) {
      throw new BadRequestException(`Unknown showcase section "${value}"`);
    }
    return value as ShowcaseSection;
  }

  list(section: ShowcaseSection) {
    return this.siteApi.get(`/admin/showcases/${section}`);
  }

  candidates(section: ShowcaseSection, q = '') {
    const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return this.siteApi.get(`/admin/showcases/${section}/candidates${query}`);
  }

  replace(section: ShowcaseSection, ids: number[]) {
    return this.siteApi.put(`/admin/showcases/${section}`, { ids });
  }
}
