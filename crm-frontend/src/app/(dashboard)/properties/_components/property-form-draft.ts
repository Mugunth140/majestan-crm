// property-form-draft.ts
// Unsaved property edits are kept in localStorage so a refresh or an
// accidental navigation loses nothing. Several staff edit the same property,
// so a draft also records the saved version it started from (`base`): that
// tells us whether it holds real edits, and whether someone else has saved
// since — in which case restoring it would overwrite their changes.

export const PROPERTY_DRAFT_VERSION = 2;
export const PROPERTY_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type FormSnapshot = Record<string, unknown>;

export interface PropertyDraft {
  v: number;
  savedAt?: number;
  /** v2+: the saved form state this draft started from. */
  base?: FormSnapshot;
  /** The record version (updatedAt) the draft started from. */
  baseVersion?: string | null;
  data: FormSnapshot;
}

export function propertyDraftKey(mode: "create" | "edit", id: unknown, userId: unknown): string {
  return `majestan:property-form:user:${userId ?? "anon"}:${mode}:${mode === "edit" ? (id ?? "unknown") : "new"}`;
}

/** Pre-v2 key (no user) — read once for migration, then removed. */
export function legacyPropertyDraftKey(mode: "create" | "edit", id: unknown): string {
  return `majestan:property-form:${mode}:${mode === "edit" ? (id ?? "unknown") : "new"}`;
}

export function readPropertyDraft(raw: string | null, now = Date.now()): PropertyDraft | null {
  try {
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || (value.v !== 1 && value.v !== PROPERTY_DRAFT_VERSION)) return null;
    if (!value.data || typeof value.data !== "object" || Array.isArray(value.data)) return null;
    if (typeof value.savedAt === "number" && now - value.savedAt > PROPERTY_DRAFT_TTL_MS) return null;
    return value as PropertyDraft;
  } catch {
    return null;
  }
}

/**
 * True when the database holds a newer version than the one this draft was
 * made from — someone else saved since, so the draft must not be applied.
 * Drafts without a recorded version fall back to "saved after the draft".
 */
export function isDraftOutdated(draft: PropertyDraft, currentVersion: string | null | undefined): boolean {
  if (!currentVersion) return false; // new record, or version unknown
  const current = new Date(currentVersion).getTime();
  if (!Number.isFinite(current)) return false;
  if (draft.baseVersion) return new Date(draft.baseVersion).getTime() !== current;
  return typeof draft.savedAt !== "number" || draft.savedAt < current;
}

export const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export interface DraftReview {
  /** What the form becomes if the draft is restored. */
  merged: FormSnapshot;
  /** Fields the draft changes compared with what is saved now. */
  changed: string[];
  /** Someone saved this property after the draft was started. */
  serverChanged: boolean;
  /** Fields both the draft and that newer save changed — the saved value is kept. */
  conflicts: string[];
}

/**
 * Compare a draft with the currently saved form state. Saved data always
 * wins: restoring applies only the draft's edits to fields nobody has saved
 * since; where someone else saved a field after the draft started, their
 * saved value is kept and the field is reported as a conflict. Returns null
 * when there is nothing to offer (no edits, or none that can still apply).
 */
export function reviewDraft(draft: PropertyDraft, current: FormSnapshot): DraftReview | null {
  const base = draft.base;
  const mine = draft.data;
  const merged: FormSnapshot = { ...current };
  const conflicts: string[] = [];
  const keys = new Set([...Object.keys(mine), ...Object.keys(base ?? {})]);
  for (const key of keys) {
    if (!(key in mine)) continue;
    // A v1 draft has no starting point: every value it holds counts as an edit.
    const mineChanged = base ? !sameValue(mine[key], base[key]) : true;
    if (!mineChanged) continue;
    if (base && !sameValue(current[key], base[key]) && !sameValue(current[key], mine[key])) {
      conflicts.push(key);
      continue;
    }
    merged[key] = mine[key];
  }
  const changed = Object.keys(merged).filter((key) => !sameValue(merged[key], current[key]));
  if (changed.length === 0 && conflicts.length === 0) return null;
  return { merged, changed, serverChanged: !!base && !sameValue(base, current), conflicts };
}

const FIELD_LABELS: Record<string, string> = {
  existingImages: "Photos",
  uploadedImages: "New photos",
  floorPlans: "Floor plans",
  documents: "Documents",
  amenityIds: "Amenities",
  furnishingItemIds: "Furnishing items",
  cityId: "City",
  sublocationId: "Locality",
  areaSqft: "Area",
  reraNumber: "RERA number",
};

/** "monthlyRent" → "Monthly rent". */
export function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function fieldList(keys: string[], max = 6): string {
  const labels = keys.map(fieldLabel);
  return labels.length > max ? `${labels.slice(0, max).join(", ")} and ${labels.length - max} more` : labels.join(", ");
}
