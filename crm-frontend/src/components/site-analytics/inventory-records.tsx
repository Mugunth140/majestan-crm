"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiJson } from "@/lib/api-fetch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  inventoryQuery,
  inventoryCount,
  inventoryMoney,
  type InventoryRecord,
  type InventoryFilters,
  type ListingDetail,
} from "./inventory-data";
import { exportInventory } from "./inventory-export";
import { InventoryChart } from "./inventory-chart";
const API = "/api/v1/site-analytics/property-insights/v2";
export function InventoryRecordTable({
  rows,
  onInspect,
  onCompare,
  selected = [],
}: {
  rows: InventoryRecord[];
  onInspect: (key: string) => void;
  onCompare?: (record: InventoryRecord) => void;
  selected?: string[];
}) {
  return (
    <div className="table-scroll overflow-x-auto pb-1">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            {[
              ...(onCompare ? ["Compare"] : []),
              "Listing",
              "Type / configuration coverage",
              "Location",
              "Status / approval",
              "Public",
              "Asking / rent",
              "Issues",
              "Views",
              "Enquiries",
            ].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t">
              {onCompare && (
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={"Compare " + r.title}
                    checked={selected.includes(r.key)}
                    onChange={() => onCompare(r)}
                  />
                </td>
              )}
              <td className="max-w-64 px-3 py-3">
                <button
                  className="text-left font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => onInspect(r.key)}
                >
                  {r.title}
                </button>
                <Link
                  href={r.href}
                  className="mt-1 block text-xs text-muted-foreground hover:underline"
                >
                  Open {r.code || r.key}
                </Link>
              </td>
              <td className="px-3 py-3 capitalize">
                {r.kind} · {r.type.replaceAll("_", " ")}
                {r.kind === "project" && (
                  <span className="block text-xs text-muted-foreground">
                    {r.declaredUnits ?? "Unknown"} declared units ·{" "}
                    {r.configurations.length} configurations
                  </span>
                )}
              </td>
              <td className="px-3 py-3">
                {r.city || "Unknown"}
                <span className="block text-xs text-muted-foreground">
                  {r.localities.join(", ")}
                </span>
              </td>
              <td className="px-3 py-3 capitalize">
                {r.status}
                <span className="block text-xs text-muted-foreground">
                  {r.approval || "Project publication"}
                  <span className="block">
                    {r.kind === "project"
                      ? [r.possession, r.possessionDate?.slice(0, 10)]
                          .filter(Boolean)
                          .join(" · ")
                      : r.verification || "Verification not recorded"}
                  </span>
                </span>
              </td>
              <td className="px-3 py-3">{r.visible ? "Yes" : "Hidden"}</td>
              <td className="whitespace-nowrap px-3 py-3">
                {r.mode !== "rent" && r.price
                  ? inventoryMoney(Number(r.price))
                  : r.rent
                    ? inventoryMoney(Number(r.rent)) + " / month"
                    : "—"}
              </td>
              <td className="px-3 py-3 tabular-nums">{r.issues.length}</td>
              <td className="px-3 py-3 tabular-nums">
                {inventoryCount(r.traffic?.views ?? null)}
              </td>
              <td className="px-3 py-3 tabular-nums">
                {inventoryCount(r.traffic?.enquiries ?? null)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No matching records
        </p>
      )}
    </div>
  );
}
export function InventoryRecordsDialog({
  filters,
  label,
  onClose,
  onInspect,
  onCompare,
  selected,
}: {
  filters: InventoryFilters | null;
  label: string;
  onClose: () => void;
  onInspect: (key: string) => void;
  onCompare: (r: InventoryRecord) => void;
  selected: string[];
}) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [page, setPage] = useState(1);
  const query = filters
    ? inventoryQuery({ ...filters, page: String(page), limit: "20" })
    : "";
  const [result, setResult] = useState<{
    key: string;
    items: InventoryRecord[];
    total: number;
    configurations?: {
      configuration: InventoryRecord["configurations"][number];
      listing: InventoryRecord;
    }[];
    error?: string;
  }>();
  useEffect(() => {
    if (!query) return;
    const c = new AbortController();
    apiJson<{
      data: {
        items: InventoryRecord[];
        total: number;
        configurations?: {
          configuration: InventoryRecord["configurations"][number];
          listing: InventoryRecord;
        }[];
      };
    }>(API + "/records?" + query, { signal: c.signal }).then(
      (r) => {
        if (!c.signal.aborted) setResult({ key: query, ...r.data });
      },
      () => {
        if (!c.signal.aborted)
          setResult({
            key: query,
            items: [],
            total: 0,
            error: "Records could not load",
          });
      },
    );
    return () => c.abort();
  }, [query]);
  return (
    <Dialog
      open={!!filters}
      onOpenChange={(open) => {
        if (!open) {
          setPage(1);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Records matching this report and its selected filters.
          </DialogDescription>
        </DialogHeader>
        {result?.key !== query ? (
          <p role="status">Loading records…</p>
        ) : result.error ? (
          <p role="alert">{result.error}</p>
        ) : (
          <>
            {result.configurations ? (
              <div className="table-scroll overflow-x-auto pb-1">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Project",
                        "Configuration",
                        "Type / BHK",
                        "Status",
                        "Asking / monthly rent",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-xs font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.configurations.map(
                      ({ configuration: c, listing: r }) => (
                        <tr key={r.key + ":" + c.id} className="border-t">
                          <td className="px-3 py-3">
                            <button
                              onClick={() => onInspect(r.key)}
                              className="underline"
                            >
                              {r.title}
                            </button>
                          </td>
                          <td className="px-3 py-3">{c.code || "#" + c.id}</td>
                          <td className="px-3 py-3">
                            {c.type} · {c.bedrooms ?? "Unknown"} BHK
                          </td>
                          <td className="px-3 py-3">{c.status}</td>
                          <td className="px-3 py-3">
                            {c.mode === "rent"
                              ? inventoryMoney(c.rent ? Number(c.rent) : null) +
                                " / month"
                              : inventoryMoney(
                                  c.price ? Number(c.price) : null,
                                )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <InventoryRecordTable
                rows={result.items}
                onInspect={onInspect}
                onCompare={onCompare}
                selected={selected}
              />
            )}
            {exportError && <p role="alert">{exportError}</p>}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {result.total.toLocaleString("en-IN")}{" "}
                {result.configurations ? "configurations" : "records"} · Page{" "}
                {page}
              </span>
              <div className="flex gap-3">
                <button
                  disabled={exporting}
                  onClick={async () => {
                    if (!filters) return;
                    setExporting(true);
                    setExportError("");
                    try {
                      await exportInventory(filters);
                    } catch {
                      setExportError("Export could not complete");
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  {exporting ? "Exporting…" : "Export matching records"}
                </button>
                <button
                  className="rounded border px-3 py-2 disabled:opacity-40"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  className="rounded border px-3 py-2 disabled:opacity-40"
                  disabled={page * 20 >= result.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
function jsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
export function ListingInsightsDialog({
  listing,
  filters,
  onClose,
}: {
  listing: string | null;
  filters: InventoryFilters;
  onClose: () => void;
}) {
  const query = listing ? inventoryQuery({ ...filters, listing }) : "";
  const [result, setResult] = useState<{
    key: string;
    data?: ListingDetail;
    error?: string;
  }>();
  useEffect(() => {
    if (!query) return;
    const c = new AbortController();
    apiJson<{ data: ListingDetail }>(API + "/listing?" + query, {
      signal: c.signal,
    }).then(
      (r) => {
        if (!c.signal.aborted) setResult({ key: query, data: r.data });
      },
      () => {
        if (!c.signal.aborted)
          setResult({ key: query, error: "Listing insights could not load" });
      },
    );
    return () => c.abort();
  }, [query]);
  const data = result?.key === query ? result.data : undefined;
  const priceField =
    filters.mode === "seat"
      ? "rent_per_seat"
      : filters.mode === "rent" || data?.record.mode === "rent"
        ? "monthly_rent"
        : "price";
  const prices =
    data?.history.events
      .filter(
        (e) =>
          jsonObject(e.before_json)[priceField] !==
          jsonObject(e.after_json)[priceField],
      )
      .map((e) => ({
        label: e.at.replace(" ", "T"),
        value: Number(jsonObject(e.after_json)[priceField] || 0),
        series:
          e.subject === "configuration"
            ? "Configuration " +
              (jsonObject(e.after_json).unit_code ||
                jsonObject(e.after_json).id)
            : "Listing",
      }))
      .filter((r) => r.value > 0)
      .reverse() || [];
  return (
    <Dialog
      open={!!listing}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{data?.record.title || "Listing insights"}</DialogTitle>
          <DialogDescription>
            UTC activity, current listing information and recorded history.
          </DialogDescription>
        </DialogHeader>
        {result?.key !== query ? (
          <p role="status">Loading listing…</p>
        ) : result.error ? (
          <p role="alert">{result.error}</p>
        ) : (
          data && (
            <div className="space-y-5">
              <Link href={data.record.href} className="text-sm underline">
                Open listing record
              </Link>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Visibility", data.record.visible ? "Public" : "Hidden"],
                  ["Status", data.record.status],
                  ["Area basis", data.record.areaBasis || "Unknown"],
                  [
                    "Area",
                    [data.record.area, data.record.areaUnit]
                      .filter(Boolean)
                      .join(" ") || "Unknown",
                  ],
                  [
                    "Monthly rent",
                    data.record.rent
                      ? inventoryMoney(Number(data.record.rent))
                      : "—",
                  ],
                  ...(data.record.type === "coworking"
                    ? [
                        ["Seats", String(data.record.seats ?? "Unknown")],
                        [
                          "Monthly rent per seat",
                          data.record.seatRent
                            ? inventoryMoney(Number(data.record.seatRent))
                            : "—",
                        ],
                      ]
                    : []),
                  ...(data.record.furnishing || data.record.floor
                    ? [
                        [
                          "Floor / furnishing",
                          [data.record.floor, data.record.furnishing]
                            .filter(Boolean)
                            .join(" · "),
                        ],
                      ]
                    : []),
                  [
                    "Asking price",
                    data.record.price
                      ? inventoryMoney(Number(data.record.price))
                      : "—",
                  ],
                  ["Views", inventoryCount(data.record.traffic?.views ?? null)],
                  [
                    "Sessions",
                    inventoryCount(data.record.traffic?.sessions ?? null),
                  ],
                  [
                    "Enquiries",
                    inventoryCount(data.record.traffic?.enquiries ?? null),
                  ],
                  [
                    "Visit requests",
                    inventoryCount(data.record.traffic?.visits ?? null),
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <InventoryChart
                spec={{
                  key: "listing-views",
                  title: "Daily detail-page views",
                  type: "line",
                  rows: data.daily.map((r) => ({
                    label: r.day,
                    value: r.views,
                  })),
                }}
                onDrill={() => {}}
              />
              {prices.length > 0 && (
                <InventoryChart
                  spec={{
                    key: "price-changes",
                    title:
                      priceField === "monthly_rent"
                        ? "Recorded monthly-rent history"
                        : priceField === "rent_per_seat"
                          ? "Recorded rent-per-seat history"
                          : "Recorded asking-price history",
                    type: "line",
                    unit: "INR",
                    rows: prices,
                  }}
                  onDrill={() => {}}
                />
              )}
              <section>
                <h3 className="text-sm font-medium">Quality checks</h3>
                {data.record.issues.length ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {data.record.issues.map((issue) => (
                      <li
                        key={issue}
                        className="rounded-md bg-muted px-2 py-1 text-xs"
                      >
                        {issue.replaceAll("_", " ")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No issues found in the implemented checks.
                  </p>
                )}
              </section>
              {data.record.kind === "project" && (
                <section>
                  <h3 className="text-sm font-medium">
                    Declared units and configurations
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.record.declaredUnits ?? "Unknown"} declared units ·{" "}
                    {data.record.configurations.length} configurations
                  </p>
                  <div className="mt-2 divide-y">
                    {data.record.configurations.map((c) => (
                      <div
                        key={c.id}
                        className="flex justify-between gap-3 py-2 text-sm"
                      >
                        <span>
                          {c.code || "#" + c.id} · {c.type} ·{" "}
                          {c.bedrooms ?? "Unknown"} BHK
                        </span>
                        <span>
                          {c.status} ·{" "}
                          {c.price
                            ? inventoryMoney(Number(c.price))
                            : "Price unknown"}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <details className="rounded-lg border p-3 text-sm">
                <summary className="cursor-pointer">
                  Recorded verification and document information
                </summary>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <dt>Verification state</dt>
                  <dd>{data.record.verification || "Not recorded"}</dd>
                  <dt>Document references</dt>
                  <dd>{data.record.documents ?? 0}</dd>
                  {Object.entries(data.record.legalFlags || {}).map(
                    ([key, value]) => (
                      <div key={key} className="contents">
                        <dt>{key.replaceAll("_", " ")}</dt>
                        <dd>{value || "Not recorded"}</dd>
                      </div>
                    ),
                  )}
                  <dt>Indexing</dt>
                  <dd>{data.record.indexing || "Not recorded"}</dd>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  Recorded information does not establish legal validity.
                </p>
              </details>
              <section>
                <h3 className="text-sm font-medium">Recorded changes</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.history.coverageFrom
                    ? "History collected from " + data.history.coverageFrom
                    : "History coverage unavailable"}
                </p>
                <div className="mt-2 max-h-64 divide-y overflow-y-auto">
                  {data.history.events.map((e) => (
                    <div key={e.id} className="py-2 text-xs">
                      <strong className="capitalize">
                        {e.subject} · {e.action}
                      </strong>
                      <span className="ml-3 text-muted-foreground">
                        {e.at} UTC
                      </span>
                      <p className="mt-1">
                        {changedFields(e.before_json, e.after_json)}
                      </p>
                    </div>
                  ))}
                  {!data.history.events.length && (
                    <p className="py-4 text-sm text-muted-foreground">
                      No changes recorded since tracking began.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
function changedFields(before: unknown, after: unknown) {
  const a = jsonObject(before),
    b = jsonObject(after);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map(
      (k) =>
        k.replaceAll("_", " ") +
        ": " +
        String(a[k] ?? "—") +
        " → " +
        String(b[k] ?? "—"),
    )
    .join(" · ");
}
export function ListingCompareDialog({
  keys,
  filters,
  onClose,
}: {
  keys: string[];
  filters: InventoryFilters;
  onClose: () => void;
}) {
  const query =
    keys.length >= 2
      ? inventoryQuery({ ...filters, keys: keys.join(",") })
      : "";
  const [result, setResult] = useState<{
    key: string;
    rows: ListingDetail[];
    error?: string;
  }>();
  useEffect(() => {
    if (!query) return;
    const c = new AbortController();
    apiJson<{ data: { listings: ListingDetail[] } }>(
      API + "/compare?" + query,
      { signal: c.signal },
    ).then(
      (r) => {
        if (!c.signal.aborted) setResult({ key: query, rows: r.data.listings });
      },
      () => {
        if (!c.signal.aborted)
          setResult({
            key: query,
            rows: [],
            error: "Comparison could not load",
          });
      },
    );
    return () => c.abort();
  }, [query]);
  const rows = result?.key === query ? result.rows : [];
  const fields: { label: string; value: (r: InventoryRecord) => string }[] = [
    {
      label: "Location",
      value: (r) => [r.city, ...r.localities].filter(Boolean).join(", "),
    },
    {
      label: "Asking price",
      value: (r) => (r.price ? inventoryMoney(Number(r.price)) : "—"),
    },
    {
      label: "Monthly rent",
      value: (r) => (r.rent ? inventoryMoney(Number(r.rent)) : "—"),
    },
    {
      label: "Area / basis",
      value: (r) =>
        [r.area, r.areaUnit, r.areaBasis].filter(Boolean).join(" ") || "—",
    },
    { label: "Public", value: (r) => (r.visible ? "Yes" : "Hidden") },
    { label: "Status", value: (r) => r.status },
    { label: "Views", value: (r) => inventoryCount(r.traffic?.views ?? null) },
    {
      label: "Average active time",
      value: (r) =>
        r.traffic?.engagement != null
          ? Math.round(r.traffic.engagement / 1000) + " seconds"
          : "—",
    },
    {
      label: "Enquiries",
      value: (r) => inventoryCount(r.traffic?.enquiries ?? null),
    },
    { label: "Quality issues", value: (r) => String(r.issues.length) },
  ];
  return (
    <Dialog
      open={keys.length >= 2}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Compare listings</DialogTitle>
          <DialogDescription>
            Comparisons use the same selected period and inventory snapshot.
          </DialogDescription>
        </DialogHeader>
        {result?.key !== query ? (
          <p role="status">Loading comparison…</p>
        ) : result.error ? (
          <p role="alert">{result.error}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Measure</th>
                {rows.map((r) => (
                  <th key={r.record.key} className="p-3">
                    <Link href={r.record.href} className="hover:underline">
                      {r.record.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.label} className="border-t">
                  <th className="p-3 text-xs font-medium text-muted-foreground">
                    {f.label}
                  </th>
                  {rows.map((r) => (
                    <td key={r.record.key} className="p-3">
                      {f.value(r.record)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
  );
}
