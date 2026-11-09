// builders-api.ts
import { apiJson } from "./api-fetch";

export interface BuilderRecord {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string;
  rawLogoKey?: string;
  phone?: string;
  email?: string;
  website?: string;
  experienceYears?: number;
  completedProjects?: number;
  ongoingProjects?: number;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const BASE = `${API_URL}/builders`;

export const buildersApi = {
  list: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))
    );
    const suffix = q.toString() ? `?${q}` : "";
    return apiJson(`${BASE}${suffix}`);
  },
  dropdown: () => apiJson(`${BASE}/dropdown`),
  getOne: (id: number) => apiJson(`${BASE}/${id}`),
  create: (body: any) =>
    apiJson(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  update: (id: number, body: any) =>
    apiJson(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  remove: (id: number) => apiJson(`${BASE}/${id}`, { method: "DELETE" }),
};
