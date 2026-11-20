import { apiFetch } from "@/lib/api-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export type RoadNameOption = { label: string; value: string };

// The active road names from Master Registry (the same list the property form
// uses). One request per page load, shared by every form that asks for a road.
let roadNamesRequest: Promise<RoadNameOption[]> | null = null;
export const loadRoadNames = () =>
  (roadNamesRequest ??= apiFetch(`${API_URL}/master/road-names`)
    .then((r) => r.json())
    .then((d) => (d.success ? (d.data as RoadNameOption[]).map((n) => ({ label: n.label, value: n.value })) : []))
    .catch(() => { roadNamesRequest = null; return []; }));

/** Forgets the cached list (tests, or after Master Registry changes in this tab). */
export const resetRoadNames = () => { roadNamesRequest = null; };
