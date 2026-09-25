// lead-import.ts
export function getBulkImportDestination(): string {
  // Bulk-imported leads always enter the unassigned routing queue, so a
  // successful import lands on lead routing — never the leads dashboard.
  return '/lead-routing';
}
