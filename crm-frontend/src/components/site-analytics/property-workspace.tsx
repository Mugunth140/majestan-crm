"use client";
import { useEffect, useState, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Download, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { exportInventory } from "./inventory-export";
import { apiFetch, apiJson } from "@/lib/api-fetch";
import { SearchableFormSelect } from "@/components/shared/form-select";
import { DashboardPanel } from "@/components/metrics/DashboardPanels";
import { InventoryChart } from "./inventory-chart";
import {
  InventoryRecordsDialog,
  InventoryRecordTable,
  ListingInsightsDialog,
  ListingCompareDialog,
} from "./inventory-records";
import {
  SECTIONS,
  inventoryQuery,
  inventoryCount,
  inventoryMoney,
  type InventoryFilters,
  type InventoryOptions,
  type InventoryReport,
  type InventoryMatch,
  type InventoryRecord,
  type InventorySection,
} from "./inventory-data";
const API = "/api/v1/site-analytics/property-insights/v2";
const control =
  "h-8 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function PropertyWorkspace({ from, to }: { from: string; to: string }) {
  const visitedSections = useRef(new Set<string>());
  const [filters, setFilters] = useState<InventoryFilters>({
    section: "overview",
    kind: "all",
  });
  const [revision, setRevision] = useState(0);
  const query = inventoryQuery({ ...filters, from, to });
  const key = query + ":" + revision;
  const [result, setResult] = useState<{
    key: string;
    data?: InventoryReport;
    error?: string;
    animate?: boolean;
  }>();
  const [options, setOptions] = useState<InventoryOptions>();
  const [advanced, setAdvanced] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [exporting, setExporting] = useState(false);
  const [drill, setDrill] = useState<{
    filters: InventoryFilters;
    label: string;
  } | null>(null);
  const [listing, setListing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [actionError, setActionError] = useState("");
  const reduced = useReducedMotion();
  const report = result?.key === key ? result.data : undefined;
  const section = (filters.section || "overview") as InventorySection;
  useEffect(() => {
    const c = new AbortController();
    apiJson<{ data: InventoryReport }>(API + "/report?" + query, {
      signal: c.signal,
    }).then(
      (r) => {
        if (!c.signal.aborted) {
          const animate = !visitedSections.current.has(section);
          visitedSections.current.add(section);
          setResult({ key, data: r.data, animate });
        }
      },
      (err) => {
        if (!c.signal.aborted)
          setResult({
            key,
            error:
              err instanceof Error ? err.message : "Insights could not load",
          });
      },
    );
    return () => c.abort();
  }, [query, key, section]);
  const optionQuery = inventoryQuery({
    from,
    to,
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.asOf ? { asOf: filters.asOf } : {}),
  });
  useEffect(() => {
    const c = new AbortController();
    apiJson<{ data: InventoryOptions }>(API + "/options?" + optionQuery, {
      signal: c.signal,
    }).then(
      (r) => {
        if (!c.signal.aborted) setOptions(r.data);
      },
      () => {},
    );
    return () => c.abort();
  }, [optionQuery, revision]);
  const change = (field: string, value: string) => {
    setFilters((f) => ({
      ...f,
      [field]: value,
      ...(field === "city" ? { locality: "" } : {}),
    }));
    setSelected([]);
    setActionError("");
  };
  const selectSection = (next: InventorySection) => {
    setFilters((f) => ({
      ...f,
      section: next,
      kind:
        next === "properties"
          ? "property"
          : next === "projects"
            ? "project"
            : f.kind,
      ...(next === "properties"
        ? { status: "", approval: "" }
        : next === "projects"
          ? { status: "", approval: "", uploader: "" }
          : {}),
    }));
    setSelected([]);
    setActionError("");
  };
  const baseFilters = { ...filters, from, to };
  const onDrill = (match: InventoryMatch, label: string) =>
    setDrill({ filters: { ...baseFilters, ...match }, label });
  const compare = (record: InventoryRecord) => {
    if (selected.includes(record.key)) {
      setSelected((s) => s.filter((k) => k !== record.key));
      return;
    }
    if (selected.length >= 4) {
      setActionError("Compare up to four listings at a time.");
      return;
    }
    if (selected.length && selected[0].split(":")[0] !== record.kind) {
      setActionError(
        "Choose properties together or projects together for a comparable view.",
      );
      return;
    }
    setSelected((s) => [...s, record.key]);
    setActionError("");
  };
  async function refresh() {
    setRefreshing(true);
    setActionError("");
    try {
      const response = await apiFetch(API + "/refresh", { method: "POST" });
      if (!response.ok) throw new Error("Inventory could not refresh");
      setRevision((n) => n + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }
  async function exportReport() {
    setExporting(true);
    setActionError("");
    try {
      await exportInventory(baseFilters);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }
  const select = (
    name: string,
    label: string,
    choices: { label: string; value: string }[],
    disabled = false,
  ) => (
    <label
      className="flex min-w-36 flex-col gap-1 text-xs text-muted-foreground"
      key={name}
    >
      <span>{label}</span>
      <SearchableFormSelect
        name={"inventory-" + name}
        value={filters[name] || ""}
        options={[{ label: "All", value: "" }, ...choices]}
        placeholder={"All " + label.toLowerCase()}
        disabled={disabled}
        onValueChange={(value: unknown) => {
          if (typeof value === "string") change(name, value);
        }}
        className="h-8! max-w-52 text-sm"
      />
    </label>
  );
  const stringOptions = (values: string[] | undefined) =>
    values?.map((value) => ({ value, label: value.replaceAll("_", " ") })) ||
    [];

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Property Insights sections"
          className="flex max-w-full gap-1 overflow-x-auto"
        >
          {SECTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-current={section === s.value ? "page" : undefined}
              onClick={() => selectSection(s.value)}
              className={
                "shrink-0 rounded-md px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                (section === s.value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50")
              }
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="flex gap-2">
          <button
            onClick={() => setAdvanced((v) => !v)}
            aria-expanded={advanced}
            className={control + " flex items-center gap-2"}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
          </button>
          <button
            aria-label="Refresh inventory"
            disabled={refreshing}
            onClick={() => void refresh()}
            className={control + " grid place-items-center disabled:opacity-40"}
          >
            <RefreshCw
              className={
                "size-3.5 " + (refreshing ? "motion-safe:animate-spin" : "")
              }
            />
          </button>
          <button
            disabled={!report || exporting}
            onClick={() => void exportReport()}
            className={control + " flex items-center gap-2 disabled:opacity-40"}
          >
            <Download className="size-3.5" />
            {exporting ? "Exporting…" : "Excel"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        {select(
          "kind",
          "Listings",
          [
            { value: "all", label: "All listings" },
            { value: "property", label: "Properties" },
            { value: "project", label: "Projects" },
          ],
          section === "properties" || section === "projects",
        )}
        {select("city", "City", stringOptions(options?.city))}
        {select("type", "Type", stringOptions(options?.type))}
        {select("mode", "Price basis", [
          { value: "sale", label: "Sale asking price" },
          { value: "rent", label: "Monthly rent" },
          { value: "seat", label: "Rent per seat" },
        ])}
        {select("sort", "Order by", [
          { value: "title", label: "Title A–Z" },
          { value: "views", label: "Most views" },
          { value: "enquiries", label: "Most enquiries" },
          { value: "engagement", label: "Highest engagement" },
          { value: "price", label: "Highest asking price" },
          { value: "updated", label: "Recently edited" },
          { value: "created", label: "Recently added" },
          { value: "possession", label: "Upcoming possession" },
        ])}
        {advanced && (
          <>
            {select("locality", "Locality", stringOptions(options?.locality))}
            {select(
              "status",
              filters.kind === "project"
                ? "Publication status"
                : filters.kind === "property"
                  ? "Availability"
                  : "Listing status",
              stringOptions(options?.status),
            )}
            {select(
              "approval",
              "Approval",
              stringOptions(options?.approval),
              filters.kind === "project",
            )}
            {select("visible", "Public visibility", [
              { value: "true", label: "Public" },
              { value: "false", label: "Hidden" },
            ])}
            {select("builder", "Builder", stringOptions(options?.builder))}
            {select("project", "Project", options?.project || [])}
            {select(
              "bedrooms",
              "BHK",
              [1, 2, 3, 4, 5, 6].map((n) => ({
                value: String(n),
                label: n + " BHK",
              })),
            )}
            {select(
              "uploader",
              "Uploaded by",
              (options?.uploader || []).map((id) => ({
                value: id,
                label: options?.uploaderNames?.[id] || "Staff #" + id,
              })),
              filters.kind === "project",
            )}
            {select("provenance", "Provenance", [
              { value: "import", label: "Legacy imports" },
              { value: "new", label: "New source records" },
              { value: "unattributed", label: "Uploader unattributed" },
            ])}
            {select(
              "areaBasis",
              "Area basis",
              stringOptions(options?.areaBasis),
            )}
            {["minPrice", "maxPrice"].map((field) => (
              <label
                key={field}
                className="flex flex-col gap-1 text-xs text-muted-foreground"
              >
                {field === "minPrice"
                  ? "Minimum price · INR"
                  : "Maximum price · INR"}
                <input
                  className={control + " w-36"}
                  type="number"
                  min="0"
                  step=".01"
                  value={filters[field] || ""}
                  onChange={(e) => change(field, e.target.value)}
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Historical snapshot · UTC
              <input
                type="date"
                className={control}
                min={report?.coverage.historyFrom?.slice(0, 10)}
                max={new Date().toISOString().slice(0, 10)}
                value={filters.asOf || ""}
                onChange={(e) => change("asOf", e.target.value)}
              />
            </label>
          </>
        )}
        <button
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            setFilters({
              section,
              kind:
                section === "properties"
                  ? "property"
                  : section === "projects"
                    ? "project"
                    : "all",
            });
            setSelected([]);
          }}
        >
          Reset
        </button>
      </div>
      {Object.entries(filters).some(
        ([k, v]) => v && !["section", "kind"].includes(k),
      ) && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(filters)
            .filter(([k, v]) => v && !["section", "kind"].includes(k))
            .map(([k, v]) => (
              <button
                key={k}
                className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs"
                onClick={() => change(k, "")}
              >
                {k}: {v}
                <X className="size-3" />
              </button>
            ))}
        </div>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      {result?.key !== key ? (
        <div
          role="status"
          aria-label="Loading Property Insights"
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : result.error ? (
        <div role="alert" className="rounded-lg border p-6 text-sm">
          {result.error}
          <button
            className="ml-3 underline"
            onClick={() => setRevision((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      ) : (
        report && (
          <motion.div
            key={section}
            initial={
              reduced || !result?.animate
                ? false
                : { opacity: 0, transform: "translateY(6px)" }
            }
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{
              duration: reduced ? 0 : 0.2,
              ease: [0.23, 1, 0.32, 1],
            }}
            className="space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {filters.asOf
                  ? "Snapshot · " + filters.asOf
                  : "Current inventory"}{" "}
                ·{" "}
                {new Date(report.snapshotAt).toLocaleString("en-IN", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </span>
              <span>
                {from} to {to} · activity end exclusive
              </span>
            </div>
            {Object.values(report.sources).some((s) => s !== "available") && (
              <p
                role="status"
                className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
              >
                {Object.entries(report.sources)
                  .filter(([, v]) => v !== "available")
                  .map(([k, v]) => k + ": " + v)
                  .join(" · ")}
                {report.freshnessMessage ? " · " + report.freshnessMessage : ""}
              </p>
            )}
            {report.metrics.length > 0 && (
              <div
                className={
                  "grid grid-cols-2 gap-3 " +
                  (report.metrics.length === 6
                    ? "lg:grid-cols-3 xl:grid-cols-6"
                    : "lg:grid-cols-4")
                }
              >
                {report.metrics.map((m) => (
                  <div
                    key={m.key}
                    className="min-w-0 rounded-lg border bg-card p-4"
                  >
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    {m.match ? (
                      <button
                        className="mt-2 text-left text-2xl font-semibold tabular-nums hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        onClick={() => onDrill(m.match!, m.label)}
                      >
                        {m.unit === "INR"
                          ? inventoryMoney(m.value)
                          : inventoryCount(m.value)}
                        {m.unit === "%" && m.value !== null ? "%" : ""}
                      </button>
                    ) : (
                      <strong
                        className="mt-2 block truncate text-2xl tabular-nums"
                        title={inventoryCount(m.value)}
                      >
                        {m.unit === "INR"
                          ? inventoryMoney(m.value)
                          : inventoryCount(m.value)}
                        {m.unit === "%" && m.value !== null ? "%" : ""}
                      </strong>
                    )}
                  </div>
                ))}
              </div>
            )}
            {report.selectionRequired ? (
              <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
                {report.selectionRequired}
              </p>
            ) : (
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                {report.charts.map((chart) => (
                  <InventoryChart
                    key={chart.key}
                    spec={
                      chart.key === "uploaders"
                        ? {
                            ...chart,
                            rows: chart.rows.map((r) => ({
                              ...r,
                              label: r.match?.uploader
                                ? options?.uploaderNames?.[r.match.uploader] ||
                                  r.label
                                : r.label,
                            })),
                          }
                        : chart
                    }
                    onDrill={onDrill}
                  />
                ))}
              </div>
            )}
            {(section === "overview" ||
              section === "quality" ||
              section === "properties" ||
              section === "projects") &&
              report.issues.length > 0 && (
                <DashboardPanel title="Attention queue">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {report.issues.map((issue) => (
                      <button
                        key={issue.key}
                        onClick={() => onDrill(issue.match, issue.label)}
                        className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span>{issue.label}</span>
                        <strong className="tabular-nums">
                          {inventoryCount(issue.value)}
                        </strong>
                      </button>
                    ))}
                  </div>
                </DashboardPanel>
              )}
            <DashboardPanel
              title={
                section === "projects"
                  ? "Projects and configuration coverage"
                  : section === "demand"
                    ? "Listing performance"
                    : "Matching inventory"
              }
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {inventoryCount(report.records.total)} matching records
                </span>
                <div className="flex items-center gap-3">
                  <button
                    className="underline"
                    onClick={() => onDrill({}, "Matching inventory")}
                  >
                    View all records
                  </button>
                  {selected.length > 0 && (
                    <>
                      <button
                        className="underline disabled:opacity-40"
                        disabled={selected.length < 2}
                        onClick={() => setComparing(true)}
                      >
                        Compare {selected.length}
                      </button>
                      <button onClick={() => setSelected([])}>Clear</button>
                    </>
                  )}
                </div>
              </div>
              <InventoryRecordTable
                rows={report.records.items}
                onInspect={setListing}
                onCompare={compare}
                selected={selected}
              />
            </DashboardPanel>
            {section === "demand" && (
              <p className="text-xs text-muted-foreground">
                Traffic collected from{" "}
                {report.coverage.trafficFrom || "no recorded activity"} UTC ·{" "}
                {report.coverage.unmatchedViews} unmatched inventory-page views.
                {report.coverage.acceptedSubmissions != null
                  ? ` ${report.coverage.linkedSubmissions ?? 0} of ${report.coverage.acceptedSubmissions} accepted submissions include session attribution.`
                  : ""}{" "}
                Project wishlist tracking is unavailable. Unlinked enquiries are
                included in enquiry counts and excluded from session conversion
                rates.
              </p>
            )}
            <details className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                Metric definitions and coverage
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>
                  Inventory counts exclude the unmapped placeholder. Approval,
                  availability and public visibility are separate.
                </li>
                <li>
                  Imports use verified legacy provenance. Creation dates
                  describe source-record ingestion.
                </li>
                <li>
                  Project unit configurations are separate from declared
                  physical-unit totals.
                </li>
                <li>
                  Prices are asking prices; rental amounts use their selected
                  billing basis. Document flags describe recorded information.
                </li>
                <li>
                  Visitor-days use daily privacy-preserving visitor identifiers.
                  Contacts are click intent and visits are requests.
                </li>
                <li>
                  Current inventory refreshes every five minutes. Daily
                  snapshots and transactional history begin at the recorded
                  baseline.
                </li>
                {report.coverage.historyMessage && (
                  <li>{report.coverage.historyMessage}</li>
                )}
              </ul>
            </details>
          </motion.div>
        )
      )}
      <InventoryRecordsDialog
        filters={drill?.filters || null}
        label={drill?.label || "Matching inventory"}
        onClose={() => setDrill(null)}
        onInspect={setListing}
        onCompare={compare}
        selected={selected}
      />
      <ListingInsightsDialog
        listing={listing}
        filters={baseFilters}
        onClose={() => setListing(null)}
      />
      <ListingCompareDialog
        keys={comparing ? selected : []}
        filters={baseFilters}
        onClose={() => setComparing(false)}
      />
    </div>
  );
}
