import { apiJson } from "@/lib/api-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export interface Me {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  whatsapp_no: string | null;
  address: string | null;
  dob: string | null;
  qualification: string | null;
  join_date: string | null;
  avatar_url: string | null;
  role?: { name: string } | null;
  department?: { name: string } | null;
}

export type MeUpdate = Partial<Pick<Me, "name" | "phone" | "whatsapp_no" | "address" | "dob" | "qualification">>;

export interface Onboarding {
  welcomed_at?: string;
  checklist_dismissed_at?: string;
  last_seen_version?: string;
  tours?: Record<string, { done_at?: string; skipped_at?: string; step?: number }>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const meApi = {
  get: () => apiJson<{ data: Me }>(`${API_URL}/users/me`).then((r) => r.data),
  update: (body: MeUpdate) => apiJson<{ data: Me }>(`${API_URL}/users/me`, json("PATCH", body)).then((r) => r.data),
  changePassword: (current: string, next: string) => apiJson(`${API_URL}/users/me/password`, json("POST", { current, next })),
  onboarding: () => apiJson<{ data: Onboarding }>(`${API_URL}/users/me/onboarding`).then((r) => r.data),
  updateOnboarding: (patch: Onboarding | { reset: true }) =>
    apiJson<{ data: Onboarding }>(`${API_URL}/users/me/onboarding`, json("PATCH", patch)).then((r) => r.data),
};

/** Keeps the signed-in copy in localStorage in step after a profile edit (the sidebar reads it). */
export function syncStoredUser(patch: Partial<Me>) {
  try {
    const raw = localStorage.getItem("crm_user");
    if (!raw) return;
    localStorage.setItem("crm_user", JSON.stringify({ ...JSON.parse(raw), ...patch }));
    window.dispatchEvent(new StorageEvent("storage", { key: "crm_user" }));
  } catch {
    // Storage blocked: the next sign-in refreshes it.
  }
}
