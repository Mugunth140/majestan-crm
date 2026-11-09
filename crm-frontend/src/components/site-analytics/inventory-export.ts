"use client";
import { apiJson } from "@/lib/api-fetch";
import {
  inventoryQuery,
  type InventoryFilters,
  type InventoryReport,
} from "./inventory-data";
export async function exportInventory(filters: InventoryFilters) {
  const { data } = await apiJson<{
    data: {
      records: Record<string, unknown>[];
      report: InventoryReport;
      filters: InventoryFilters;
      snapshotAt: string;
    };
  }>(
    "/api/v1/site-analytics/property-insights/v2/export?" +
      inventoryQuery(filters),
  );
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(
      data.records.map((r) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.join(", ") : v,
          ]),
        ),
      ),
    ),
    "Matching records",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(
      data.report.metrics.map((m) => ({
        metric: m.label,
        value: m.value,
        unit: m.unit || "count",
      })),
    ),
    "Metrics",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(
      data.report.charts.flatMap((c) =>
        c.rows.map((r) => ({
          chart: c.title,
          ...r,
          match: JSON.stringify(r.match || {}),
        })),
      ),
    ),
    "Chart values",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(
      Object.entries({ ...data.filters, snapshotAt: data.snapshotAt }).map(
        ([filter, value]) => ({ filter, value }),
      ),
    ),
    "Filters and freshness",
  );
  XLSX.writeFile(
    book,
    "property-insights-" + filters.from + "-" + filters.to + ".xlsx",
  );
}
