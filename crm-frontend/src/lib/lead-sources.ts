import { apiFetch } from "@/lib/api-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export type SourceOption = { label: string; value: string };

// The active lead sources from Master Registry (99acres, Magic Bricks, Website...).
// One request per page load, shared by every form that asks for a source.
let sourcesRequest: Promise<SourceOption[]> | null = null;
export const loadLeadSources = () =>
  (sourcesRequest ??= apiFetch(`${API_URL}/master/lead-sources`)
    .then((r) => r.json())
    .then((d) => (d.success ? (d.data as SourceOption[]).map((s) => ({ label: s.label, value: s.value })) : []))
    .catch(() => { sourcesRequest = null; return []; }));

/** Forgets the cached list (tests, or after Master Registry changes in this tab). */
export const resetLeadSources = () => { sourcesRequest = null; };
