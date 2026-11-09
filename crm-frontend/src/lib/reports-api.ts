import { apiJson } from "./api-fetch";

const API = `${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}/reports`;

export type FieldType = "text" | "number" | "money" | "date" | "datetime" | "bool";
export type ReportField = { key: string; label: string; type: FieldType; group: string; default: boolean };
export type FilterOption = { value: string; label: string; count?: number };
export type ReportFilter = { key: string; label: string; options: FilterOption[] };
export type ReportModule = { key: string; label: string; description: string; dateLabel: string; fields: ReportField[]; filters: ReportFilter[] };
export type ReportRequest = { module: string; fields: string[]; from?: string; to?: string; filters?: Record<string, string[]>; limit?: number };
export type ReportResult = {
  module: string;
  label: string;
  columns: { key: string; label: string; type: FieldType }[];
  rows: (string | number | null)[][];
  total: number;
  truncated: boolean;
};

export const reportsApi = {
  modules: () => apiJson<{ data: ReportModule[] }>(`${API}/modules`).then((r) => r.data),
  preview: (body: ReportRequest, signal?: AbortSignal) =>
    apiJson<{ data: ReportResult }>(`${API}/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }).then((r) => r.data),
  export: (body: ReportRequest) =>
    apiJson<{ data: ReportResult }>(`${API}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.data),
};

const IST = "Asia/Kolkata";
/** Dates come back as UTC; people read them in India time. */
function istParts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute };
}

/** A cell as people expect it in the preview table. */
export function displayCell(type: FieldType, v: string | number | null): string {
  if (v === null || v === "") return "";
  if ((type === "date" || type === "datetime") && typeof v === "string") {
    const p = istParts(v);
    if (!p) return v;
    const date = `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`;
    return type === "date" ? date : `${date} ${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`;
  }
  if (type === "money" && typeof v === "number") return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return String(v);
}

/** Writes the report to an .xlsx file: typed cells, a header row with filters, and a sheet saying what was exported. */
export async function downloadWorkbook(result: ReportResult, about: [string, string][]) {
  const XLSX = await import("xlsx");
  const head = result.columns.map((c) => c.label);
  const body = result.rows.map((row) => row.map((v, i) => {
    const type = result.columns[i].type;
    if (v === null || v === "") return null;
    if ((type === "date" || type === "datetime") && typeof v === "string") {
      const p = istParts(v);
      // Excel has no time zone: write the India wall-clock time as an Excel serial day number.
      return p ? Date.UTC(p.y, p.m - 1, p.d, type === "date" ? 0 : p.h, type === "date" ? 0 : p.min) / 86_400_000 + 25_569 : v;
    }
    return v;
  }));
  const sheet = XLSX.utils.aoa_to_sheet([head, ...body]);
  result.columns.forEach((c, i) => {
    const fmt = c.type === "date" ? "dd/mm/yyyy" : c.type === "datetime" ? "dd/mm/yyyy hh:mm" : c.type === "money" ? "#,##,##0.00" : null;
    if (!fmt) return;
    for (let r = 1; r <= body.length; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c: i })];
      if (cell && cell.t === "n") cell.z = fmt;
    }
  });
  sheet["!cols"] = result.columns.map((c, i) => {
    const longest = Math.max(c.label.length, ...result.rows.slice(0, 500).map((r) => String(r[i] ?? "").length));
    return { wch: Math.min(48, Math.max(c.type === "datetime" ? 17 : 8, longest + 2)) };
  });
  sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length, c: result.columns.length - 1 } }) };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, result.label.slice(0, 31));
  const info = XLSX.utils.aoa_to_sheet([["Report", result.label], ...about, ["Rows", String(result.rows.length)], ...(result.truncated ? [["Note", `Only the first ${result.rows.length.toLocaleString("en-IN")} of ${result.total.toLocaleString("en-IN")} rows. Narrow the filters to export the rest.`]] : [])]);
  info["!cols"] = [{ wch: 16 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(book, info, "About this report");
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date());
  XLSX.writeFile(book, `${result.label} report ${stamp}.xlsx`, { compression: true });
}
