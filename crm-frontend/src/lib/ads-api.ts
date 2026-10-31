// ads-api.ts
import { apiJson } from './api-fetch';

export interface Advertisement {
  id: number;
  title: string;
  desktopImage?: string | null;
  mobileImage?: string | null;
  placement?: string;
  audience?: string | null;
  linkType?: string;
  linkPreset?: string;
  linkCustom?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface AdSavePayload {
  title: string;
  placement: string;
  audience: string | null;
  linkType: 'custom' | 'preset';
  linkPreset: string;
  linkCustom?: string;
  desktopImageKey?: string;
  mobileImageKey?: string | null;
  isActive: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const BASE = `${API_URL}/ads`;

async function adRequest(...args: Parameters<typeof apiJson>) {
  const result = await apiJson(...args);
  if (result?.success === false) throw new Error(result.message || 'Advertisement request failed. Please try again.');
  return result;
}

export const adsApi = {
  list: (params: Record<string, string | number | boolean | null | undefined> = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([key, value]) => [key, String(value)])),
    );
    const suffix = q.toString() ? `?${q}` : '';
    return adRequest(`${BASE}${suffix}`);
  },
  getOne: (id: number) => adRequest(`${BASE}/${id}`),
  presignedUrl: (fileName: string, fileType: string) => {
    const q = new URLSearchParams({ fileName, fileType });
    return adRequest(`${BASE}/presigned-url?${q}`);
  },
  uploadTemp: async (file: File): Promise<string> => {
    const { data } = await adsApi.presignedUrl(file.name, file.type);
    const { url, key } = data ?? {};
    if (!url || !key) throw new Error(`Upload failed for ${file.name}: missing presigned url/key`);
    const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!put.ok) throw new Error(`Upload failed for ${file.name}`);
    return key as string;
  },
  create: (body: AdSavePayload) =>
    adRequest(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  update: (id: number, body: AdSavePayload) =>
    adRequest(`${BASE}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  setStatus: (id: number, isActive: boolean) =>
    adRequest(`${BASE}/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }) }),
  reorder: (ids: number[]) =>
    adRequest(`${BASE}/reorder`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }),
  remove: (id: number) => adRequest(`${BASE}/${id}`, { method: 'DELETE' }),
};
