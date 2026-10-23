// Departments are seeded as "Sales Department" / "Telecalling Department",
// but the app keys pipelines by the bare "sales" / "telecalling".
export type Department = "sales" | "telecalling";

export function normalizeDepartment(name?: string | null): Department {
  return /sales/i.test(name ?? "") ? "sales" : "telecalling";
}
