"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatIndianCurrencyShort } from "@/lib/indian-currency";

/**
 * Optional list columns: they start hidden and are turned on from the
 * Columns menu. Each reads one value off the row and formats it by kind.
 */
export type ExtraColumn<T> = {
  id: string;
  label: string;
  value: (row: T) => unknown;
  /** text (default) · label (snake_case → words) · date · datetime · money · number · yesno */
  kind?: "text" | "label" | "date" | "datetime" | "money" | "number" | "yesno";
};

const EMPTY = new Set(["", "—", "-", "null", "undefined"]);

function isEmpty(v: unknown) {
  return v == null || (typeof v === "string" && EMPTY.has(v.trim())) || (Array.isArray(v) && v.length === 0);
}

function asDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v !== "string" && typeof v !== "number") return null;
  // A bare YYYY-MM-DD is a calendar day: read it locally, not as UTC midnight.
  const d = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The cell text for a value, or null when there is nothing to show. */
export function formatExtra(v: unknown, kind: ExtraColumn<unknown>["kind"] = "text"): string | null {
  if (isEmpty(v)) return null;
  switch (kind) {
    case "date":
    case "datetime": {
      const d = asDate(v);
      if (!d) return String(v);
      return kind === "date"
        ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
    }
    case "money": {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? formatIndianCurrencyShort(n) : null;
    }
    case "number": {
      const n = Number(v);
      return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(v);
    }
    case "yesno":
      return v === true || v === 1 || v === "1" || v === "true" || v === "yes" ? "Yes" : "No";
    case "label": {
      const s = Array.isArray(v) ? v.join(", ") : String(v);
      return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    default:
      return Array.isArray(v) ? v.join(", ") : String(v);
  }
}

/** `T` is the table's row type; values read the row loosely, since API rows carry more than their types say. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extraColumns<T = any>(extras: ExtraColumn<any>[]): ColumnDef<T>[] {
  return extras.map(({ id, label, value, kind = "text" }): ColumnDef<T> => ({
    id,
    header: label,
    accessorFn: (row: T) => value(row),
    // Lists are paged on the server: sorting one page of an optional column would mislead.
    enableSorting: false,
    meta: { label, defaultHidden: true },
    cell: ({ row }) => {
      const text = formatExtra(value(row.original), kind);
      if (text == null) return <span className="text-muted-foreground">—</span>;
      const numeric = kind === "money" || kind === "number" || kind === "date" || kind === "datetime";
      return <span className={numeric ? "whitespace-nowrap tabular-nums" : "block max-w-[260px] truncate"} title={text}>{text}</span>;
    },
  }));
}
