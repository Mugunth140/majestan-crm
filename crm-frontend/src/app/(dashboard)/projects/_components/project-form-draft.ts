export const PROJECT_DRAFT_VERSION = 2;

export type ProjectDraft = {
  v: number;
  baseRevision?: number;
  data: Record<string, unknown>;
};

export function projectDraftKey(mode: "create" | "edit", id: unknown, userId: unknown): string {
  return `project-form-draft:user:${userId}:${mode === "edit" ? `edit:${id}` : "new"}`;
}

export function canRestoreProjectDraft(draft: ProjectDraft, mode: "create" | "edit", revision?: number): boolean {
  // v3 drafts are v2 drafts plus their starting point, so either restores.
  return (draft.v === PROJECT_DRAFT_VERSION || draft.v === 3) &&
    (mode === "create" || (Number.isInteger(revision) && Number(revision) > 0 && draft.baseRevision === revision));
}

export function readProjectDraft(raw: string | null): ProjectDraft | null {
  try {
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value.v !== "number" || !value.data || typeof value.data !== "object" || Array.isArray(value.data)) return null;
    return value;
  } catch { return null; }
}

/** Remove the active stale draft only AFTER its recovery copy is durable. */
export function archiveProjectDraft(storage: Pick<Storage, "setItem" | "removeItem">, key: string, draft: ProjectDraft): string | null {
  const backupKey = `${key}:recovery:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  try {
    storage.setItem(backupKey, JSON.stringify(draft));
    storage.removeItem(key);
    return backupKey;
  } catch { return null; }
}

// ---- Change tracking and merging -------------------------------------------
//
// Several staff edit the same project at once. Instead of every save
// replacing the whole project (and the second save being refused), the form
// sends only the fields it changed, units identified by code, and drafts are
// three-way merged onto newer server data instead of being thrown away.

/** Drafts from v3 carry the server state they started from, so they can be rebased. */
export const PROJECT_DRAFT_VERSION_REBASABLE = 3;

export type RebasableDraft = ProjectDraft & { base: Record<string, unknown> };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value ?? null));

function codeOf(unit: unknown): string {
  const code = (unit as { unitCode?: unknown } | null)?.unitCode;
  return typeof code === "string" ? code.trim() : "";
}

/** Units keyed by code, or null when a code repeats (then units are merged as one field). */
function byCode(units: unknown): Map<string, unknown> | null {
  const map = new Map<string, unknown>();
  for (const unit of Array.isArray(units) ? units : []) {
    const code = codeOf(unit);
    if (!code) continue;
    if (map.has(code)) return null;
    map.set(code, unit);
  }
  return map;
}

/** Codes of units added, edited or removed between two unit lists, or undefined when codes repeat. */
export function changedUnitCodes(base: unknown, mine: unknown): string[] | undefined {
  const before = byCode(base);
  const after = byCode(mine);
  if (!before || !after) return undefined;
  const codes = new Set([...before.keys(), ...after.keys()]);
  return [...codes].filter((code) => !same(before.get(code), after.get(code)));
}

/**
 * The PATCH body for an edit: only the fields that differ from `base`, a
 * cleared field as null (or [] for lists), plus the field list and, when the
 * units changed, the codes of the units touched.
 */
export function editRequestBody(
  base: Record<string, unknown>,
  mine: Record<string, unknown>,
  alwaysSend: string[] = ["projectType"],
): Record<string, unknown> & { changedFields: string[] } {
  const b = plain(base) ?? {};
  const m = plain(mine) ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(m)]);
  const changedFields = [...keys].filter((key) => !same(b[key], m[key]));
  const body: Record<string, unknown> & { changedFields: string[] } = { changedFields };
  for (const key of changedFields) body[key] = key in m ? m[key] : Array.isArray(b[key]) ? [] : null;
  for (const key of alwaysSend) if (key in m) body[key] = m[key];
  if (changedFields.includes("units")) {
    const codes = changedUnitCodes(b.units, m.units);
    if (codes) body.changedUnitCodes = codes;
  }
  return body;
}

/** True when a draft holds no edits beyond the server state it started from. */
export function draftIsPristine(draft: RebasableDraft): boolean {
  return same(draft.data, draft.base);
}

/**
 * Three-way merge of a draft onto the latest server state. For each field:
 * the draft's edit wins where the server hasn't changed it since; the server
 * wins where only it changed; where both changed differently it's a conflict
 * and the server's value is kept. Units merge one by one by unit code; draft
 * units still without a code are kept.
 */
export function rebaseDraft(
  draft: RebasableDraft,
  latest: Record<string, unknown>,
): { merged: Record<string, unknown>; conflicts: string[] } {
  const base = draft.base;
  const mine = draft.data;
  const merged: Record<string, unknown> = { ...latest };
  const conflicts: string[] = [];
  const keys = new Set([...Object.keys(mine), ...Object.keys(base)]);
  for (const key of keys) {
    const mineChanged = !same(mine[key], base[key]);
    if (!mineChanged) continue;
    const theirsChanged = !same(latest[key], base[key]);
    if (!theirsChanged || same(latest[key], mine[key])) {
      merged[key] = mine[key];
      continue;
    }
    if (key === "units") {
      const result = mergeUnits(base.units, mine.units, latest.units);
      if (result) {
        merged.units = result.units;
        conflicts.push(...result.conflicts.map((code) => `unit ${code}`));
        continue;
      }
    }
    conflicts.push(key);
  }
  return { merged, conflicts };
}

function mergeUnits(base: unknown, mine: unknown, latest: unknown): { units: unknown[]; conflicts: string[] } | null {
  const b = byCode(base);
  const m = byCode(mine);
  const l = byCode(latest);
  if (!b || !m || !l) return null;
  const conflicts: string[] = [];
  const result = new Map(l);
  for (const code of new Set([...b.keys(), ...m.keys()])) {
    const mineUnit = m.get(code);
    if (same(mineUnit, b.get(code))) continue; // untouched here
    if (!same(l.get(code), b.get(code)) && !same(l.get(code), mineUnit)) {
      conflicts.push(code);
      continue;
    }
    if (mineUnit === undefined) result.delete(code);
    else result.set(code, mineUnit);
  }
  const uncoded = (Array.isArray(mine) ? mine : []).filter((unit) => !codeOf(unit));
  return { units: [...result.values(), ...uncoded], conflicts };
}

/** Keeps the newest `keep` recovery copies of one draft and deletes the rest. */
export function pruneRecoveryCopies(storage: Storage, key: string, keep = 3) {
  try {
    const prefix = `${key}:recovery:`;
    const copies: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const name = storage.key(i);
      if (name?.startsWith(prefix)) copies.push(name);
    }
    copies
      .sort((a, b) => Number(b.slice(prefix.length).split(":")[0]) - Number(a.slice(prefix.length).split(":")[0]))
      .slice(keep)
      .forEach((name) => storage.removeItem(name));
  } catch { /* storage unavailable */ }
}
