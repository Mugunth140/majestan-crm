// ads-api.ts
import { apiJson } from './api-fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const BASE = `${API_URL}/ads`;

export const adsApi = {
  list: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
    );
    const suffix = q.toString() ? `?${q}` : '';
    return apiJson(`${BASE}${suffix}`);
  },
  getOne: (id: number) => apiJson(`${BASE}/${id}`),
  presignedUrl: (fileName: string, fileType: string) => {
    const q = new URLSearchParams({ fileName, fileType });
    return apiJson(`${BASE}/presigned-url?${q}`);
  },
  uploadTemp: async (file: File): Promise<string> => {
    const { url, key } = await adsApi.presignedUrl(file.name, file.type);
    const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!put.ok) throw new Error(`Upload failed for ${file.name}`);
    return key as string;
  },
  create: (body: any) =>
    apiJson(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  update: (id: number, body: any) =>
    apiJson(`${BASE}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  setStatus: (id: number, isActive: boolean) =>
    apiJson(`${BASE}/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }) }),
  reorder: (ids: number[]) =>
    apiJson(`${BASE}/reorder`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }),
  remove: (id: number) => apiJson(`${BASE}/${id}`, { method: 'DELETE' }),
};
