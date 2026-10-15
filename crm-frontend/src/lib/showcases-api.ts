// showcases-api.ts
import { apiJson } from './api-fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const BASE = `${API_URL}/showcases`;

export type ShowcaseSection = 'handpicked_properties' | 'featured_projects';

/** One record as the picker shows it (from the site backend). */
export interface ShowcaseSummary {
  id: number;
  title: string;
  location: string | null;
  imageUrl: string | null;
  meta: string | null;
  /** False when the record is no longer shown on the site. */
  isLive: boolean;
}

/** Most picks one section can hold (mirrors the site backend). */
export const SHOWCASE_MAX_ITEMS = 20;

type Envelope = { data?: unknown } | unknown[];

const unwrap = (res: Envelope): ShowcaseSummary[] => {
  const data = Array.isArray(res) ? res : res?.data ?? res;
  if (Array.isArray(data)) return data as ShowcaseSummary[];
  const items = (data as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as ShowcaseSummary[]) : [];
};

export const showcasesApi = {
  list: async (section: ShowcaseSection) => unwrap(await apiJson(`${BASE}/${section}`)),
  candidates: async (section: ShowcaseSection, q: string) => {
    const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return unwrap(await apiJson(`${BASE}/${section}/candidates${query}`));
  },
  save: async (section: ShowcaseSection, ids: number[]) =>
    unwrap(
      await apiJson(`${BASE}/${section}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }),
    ),
};
