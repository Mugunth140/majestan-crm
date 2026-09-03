import { apiFetch } from './api-fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const BASE = `${API_URL}/properties`;

export const propertiesApi = {
  list: (params: Record<string, any>) => {
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v != null && v !== '')
      )
    );
    return apiFetch(`${BASE}?${q}`).then(r => r.json());
  },
  formData: () => apiFetch(`${BASE}/form-data`).then(r => r.json()),
  presignedUrl: (fileName: string, fileType: string) => {
    const q = new URLSearchParams({ fileName, fileType });
    return apiFetch(`${BASE}/presigned-url?${q}`).then(r => r.json());
  },
  uploadImages: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    return apiFetch(`${BASE}/upload`, { method: 'POST', body: form }).then(r => r.json());
  },
  uploadDocs: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('documents', f));
    return apiFetch(`${BASE}/upload-docs`, { method: 'POST', body: form }).then(r => r.json());
  },
  getOne: (id: number) => apiFetch(`${BASE}/${id}`).then(r => r.json()),
  create: (body: any) =>
    apiFetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),
  update: (id: number, body: any) =>
    apiFetch(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),
  toggleVisibility: (id: number) =>
    apiFetch(`${BASE}/${id}/visibility`, { method: 'PATCH' }).then(r => r.json()),
  remove: (id: number) =>
    apiFetch(`${BASE}/${id}`, { method: 'DELETE' }).then(r => r.json()),
  bulk: (properties: any[]) =>
    apiFetch(`${BASE}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties }),
    }).then(r => r.json()),
};
