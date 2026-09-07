import { apiFetch } from './api-fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const BASE = `${API_URL}/projects`;

export const projectsApi = {
  list: (params: Record<string, any>) => {
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v != null && v !== '')
      )
    );
    return apiFetch(`${BASE}?${q}`).then(r => r.json());
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
  updateStatus: (id: number, status: string) =>
    apiFetch(`${BASE}/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(r => r.json()),
  remove: (id: number) =>
    apiFetch(`${BASE}/${id}`, { method: 'DELETE' }).then(r => r.json()),
};
