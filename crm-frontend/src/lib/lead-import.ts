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
