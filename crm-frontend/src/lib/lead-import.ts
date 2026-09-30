// lead-import.ts
export function getBulkImportDestination(): string {
  // Bulk-imported leads always enter the unassigned routing queue, so a
  // successful import lands on lead routing — never the leads dashboard.
  return '/lead-routing';
}

export interface DuplicateLeadInfo {
  id: number;
  displayId: string;
  name: string;
  status?: string;
  staff?: string;
}

export interface PendingDupeRow<T> {
  row: T;
  existing: DuplicateLeadInfo;
}

// Splits pending import rows into duplicates (mobile already in the CRM)
// and fresh rows, using the pre-insert bulk/check result keyed by the
// normalized 10-digit mobile number.
export function partitionPendingImports<T extends { mobile: string }>(
  pending: T[],
  existingByMobile: Record<string, DuplicateLeadInfo>,
): { dupes: PendingDupeRow<T>[]; fresh: T[] } {
  const dupes: PendingDupeRow<T>[] = [];
  const fresh: T[] = [];
  for (const row of pending) {
    const existing = existingByMobile[row.mobile];
    if (existing) dupes.push({ row, existing });
    else fresh.push(row);
  }
  return { dupes, fresh };
}

// ── Bulk import: optional "Staff ID" column ───────────────────────────
// The template's Staff ID cell holds a numeric users.id. Anything that is not
// a positive integer is treated as "no assignee" so a malformed cell never
// aborts an import.
export function normalizeStaffId(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  // Excel numeric cells arrive as numbers; non-numeric cells as strings.
  if (!/^\d+(\.0+)?$/.test(text)) return undefined;
  const parsed = Number.parseInt(text, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export interface StaffOption {
  id: number;
  name: string;
}

export interface StaffAssignmentSeedRow {
  rawId?: string;
  staffId?: number;
}

// Resolves sheet-supplied staff ids against the assignable staff directory.
// Unknown ids are returned separately so the UI can warn while still
// importing the row unassigned — the backend applies the same fallback.
export function resolveStaffAssignments(
  rows: StaffAssignmentSeedRow[],
  staffList: StaffOption[],
): { assignments: Record<string, { id: number; name: string }>; unresolved: number[] } {
  const byId = new Map(staffList.map((s) => [s.id, s.name]));
  const assignments: Record<string, { id: number; name: string }> = {};
  const unresolved: number[] = [];

  for (const row of rows) {
    if (!row.rawId || typeof row.staffId !== 'number') continue;
    // Test map presence, not truthiness: a staff record with a blank name is a
    // directory-data problem, and the row must still import assigned rather than
    // be reported as an unknown id.
    if (byId.has(row.staffId)) {
      assignments[row.rawId] = { id: row.staffId, name: byId.get(row.staffId)! };
    } else if (!unresolved.includes(row.staffId)) {
      unresolved.push(row.staffId);
    }
  }

  return { assignments, unresolved };
}
