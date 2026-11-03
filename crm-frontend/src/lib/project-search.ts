import { apiFetch } from "@/lib/api-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export type SearchOption = { label: string; value: string; hint?: string };

/** Projects from the site (via the CRM backend), matched by name, builder or city. */
export const searchProjects = async (query: string): Promise<SearchOption[]> => {
  const params = new URLSearchParams({ limit: "20", status: "published" });
  if (query) params.set("search", query);
  const res = await apiFetch(`${API_URL}/projects?${params}`);
  const data = await res.json();
  return (data.data ?? []).map((p: { id: number; name: string; builderName?: string | null; city?: string | null }) => ({
    label: p.name,
    value: String(p.id),
    hint: [p.builderName, p.city].filter(Boolean).join(" · ") || undefined,
  }));
};
