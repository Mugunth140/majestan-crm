import { apiJson } from './api-fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const BASE = `${API_URL}/properties`;

export const propertiesApi = {
  list: (params: Record<string, any>) => {
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v != null && v !== '')
      )
    );
    return apiJson(`${BASE}?${q}`);
  },
  formData: () => apiJson(`${BASE}/form-data`),
  presignedUrl: (fileName: string, fileType: string) => {
    const q = new URLSearchParams({ fileName, fileType });
    return apiJson(`${BASE}/presigned-url?${q}`);
  },
  uploadImages: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    return apiJson(`${BASE}/upload`, { method: 'POST', body: form });
  },
  uploadDocs: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('documents', f));
    return apiJson(`${BASE}/upload-docs`, { method: 'POST', body: form });
  },
  getOne: (id: number) => apiJson(`${BASE}/${id}`),
  create: (body: any) =>
    apiJson(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  update: (id: number, body: any) =>
    apiJson(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  toggleVisibility: (id: number) =>
    apiJson(`${BASE}/${id}/visibility`, { method: 'PATCH' }),
  approve: (id: number) =>
    apiJson(`${BASE}/${id}/approve`, { method: 'PATCH' }),
  revokeApproval: (id: number) =>
    apiJson(`${BASE}/${id}/revoke-approval`, { method: 'PATCH' }),
  remove: (id: number) =>
    apiJson(`${BASE}/${id}`, { method: 'DELETE' }),
  bulk: (properties: any[]) =>
    apiJson(`${BASE}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties }),
    }),
};
