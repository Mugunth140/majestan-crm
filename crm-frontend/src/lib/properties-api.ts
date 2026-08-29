import { apiFetch } from './api-fetch';

const BASE = '/api/v1/properties';

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
