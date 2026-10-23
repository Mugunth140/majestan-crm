// Departments are seeded as "Sales Department" / "Telecalling Department",
// but the app keys pipelines by the bare "sales" / "telecalling".
export type Department = "sales" | "telecalling";

export function normalizeDepartment(name?: string | null): Department {
  return /sales/i.test(name ?? "") ? "sales" : "telecalling";
}

// Like normalizeDepartment, but null for departments with no lead pipeline,
// so an HR/Management lead never looks like a telecalling lead.
export function pipelineOf(name?: string | null): Department | null {
  const n = name ?? "";
  return /sales/i.test(n) ? "sales" : /telecalling/i.test(n) ? "telecalling" : null;
}
