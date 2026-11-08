"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import { apiJson } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { SearchableFormSelect } from "@/components/shared/form-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toolbarFilterButton, segmentClass } from "@/components/layout/list-page";
import { DashContext, STATUS } from "@/components/dashboard/chart-kit";
import { BarList, Donut, Heatmap, Scatter, StackedBars, TrendChart } from "@/components/dashboard/charts";
import { Kpis } from "@/components/dashboard/lists";
import type { Block, Span } from "@/components/dashboard/types";
import { InventoryRecordsDialog, ListingInsightsDialog, ListingCompareDialog } from "./inventory-records";
import { inventoryCount, inventoryQuery, type InventoryFilters, type InventoryMatch, type InventoryOptions, type InventoryRecord, type InventoryReport, type InventorySection } from "./inventory-data";
import { INSIGHT_SECTIONS, nice, toBlocks } from "./inventory-blocks";

const API = "/api/v1/site-analytics/property-insights/v2";
const QUEUE_SECTIONS: InventorySection[] = ["overview", "properties", "projects"];
const SPAN: Record<Span, string> = {
  full: "md:col-span-2 lg:col-span-12",
  twoThirds: "md:col-span-2 lg:col-span-8",
  half: "md:col-span-2 lg:col-span-6",
  third: "md:col-span-1 lg:col-span-4",
};

/** What each filter is called, for the popover and for the chips under the toolbar. */
const LABELS: Record<string, string> = {
  kind: "Listings", city: "City", locality: "Locality", type: "Type", mode: "Price basis", status: "Status", approval: "Approval",
  visible: "Visibility", builder: "Builder", project: "Project", bedrooms: "BHK", uploader: "Uploaded by", provenance: "Provenance",
  areaBasis: "Area basis", minPrice: "Min price", maxPrice: "Max price", asOf: "Snapshot", issue: "Issue",
};
const FIXED: Record<string, { value: string; label: string }[]> = {
  kind: [{ value: "all", label: "All listings" }, { value: "property", label: "Properties" }, { value: "project", label: "Projects" }],
  mode: [{ value: "sale", label: "Sale asking price" }, { value: "rent", label: "Monthly rent" }, { value: "seat", label: "Rent per seat" }],
  visible: [{ value: "true", label: "Public" }, { value: "false", label: "Hidden" }],
  bedrooms: [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} BHK` })),
  provenance: [{ value: "import", label: "Legacy imports" }, { value: "new", label: "New source records" }, { value: "unattributed", label: "Uploader unattributed" }],
};
const kindFor = (s: InventorySection) => (s === "properties" ? "property" : s === "projects" ? "project" : "all");

export function PropertyWorkspace({ from, to }: { from: string; to: string }) {
  const [filters, setFilters] = useState<InventoryFilters>({ section: "overview", kind: "all" });
  const [revision, setRevision] = useState(0);
  const query = inventoryQuery({ ...filters, from, to });
  const key = `${query}:${revision}`;
  const [result, setResult] = useState<{ key: string; section: string; data?: InventoryReport; error?: string }>();
  const [options, setOptions] = useState<InventoryOptions>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drill, setDrill] = useState<{ filters: InventoryFilters; label: string } | null>(null);
  const [listing, setListing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [notice, setNotice] = useState("");
  const section = (filters.section || "overview") as InventorySection;
  // The last report of this section stays on screen while a filter change loads, so the page does not jump.
  const shown = result?.section === section ? result.data : undefined;
  const loading = result?.key !== key;

  useEffect(() => {
    const c = new AbortController();
    apiJson<{ data: InventoryReport }>(`${API}/report?${query}`, { signal: c.signal }).then(
      (r) => { if (!c.signal.aborted) setResult({ key, section, data: r.data }); },
      (err) => { if (!c.signal.aborted) setResult({ key, section, error: err instanceof Error ? err.message : "Insights could not load" }); },
    );
    return () => c.abort();
  }, [query, key, section]);

  const optionQuery = inventoryQuery({ from, to, ...(filters.city ? { city: filters.city } : {}), ...(filters.asOf ? { asOf: filters.asOf } : {}) });
  useEffect(() => {
    const c = new AbortController();
    apiJson<{ data: InventoryOptions }>(`${API}/options?${optionQuery}`, { signal: c.signal }).then(
      (r) => { if (!c.signal.aborted) setOptions(r.data); },
      () => {},
    );
    return () => c.abort();
  }, [optionQuery]);

  const change = (field: string, value: string) => {
    setFilters((f) => ({ ...f, [field]: value, ...(field === "city" ? { locality: "" } : {}) }));
    setSelected([]);
    setNotice("");
  };
  const selectSection = (next: InventorySection) => {
    setFilters((f) => ({
      ...f, section: next, kind: kindFor(next),
      ...(next === "properties" ? { status: "", approval: "" } : next === "projects" ? { status: "", approval: "", uploader: "" } : {}),
    }));
    setSelected([]);
    setNotice("");
  };
  const reset = () => { setFilters({ section, kind: kindFor(section) }); setSelected([]); };
  const baseFilters = useMemo(() => ({ ...filters, from, to }), [filters, from, to]);
  const onDrill = (match: InventoryMatch, label: string) => setDrill({ filters: { ...baseFilters, ...match } as InventoryFilters, label });

  const compare = (record: InventoryRecord) => {
    if (selected.includes(record.key)) return setSelected((s) => s.filter((k) => k !== record.key));
    if (selected.length >= 4) return setNotice("Compare up to four listings at a time.");
    if (selected.length && selected[0].split(":")[0] !== record.kind) return setNotice("Compare properties with properties, or projects with projects.");
    setSelected((s) => [...s, record.key]);
    setNotice("");
  };

  const names = shown?.uploaderNames ?? options?.uploaderNames;
  const built = useMemo(() => (shown ? toBlocks(shown, section, names) : null), [shown, section, names]);
  // Charts drill by "person id": here that number points at the records a mark stands for.
  const ctx = useMemo(() => ({
    openPerson: (id: number) => { const t = built?.drills[id - 1]; if (t) setDrill({ filters: { ...baseFilters, ...t.match } as InventoryFilters, label: t.label }); },
    canOpen: (id: number | undefined) => id !== undefined && !!built?.drills[id - 1],
    focus: null, setFocus: () => {}, trendKeys: new Set<string>(), intro: false,
  }), [built, baseFilters]);

  const active = Object.entries(filters).filter(([k, v]) => v && k !== "section" && !(k === "kind" && v === kindFor(section)));
  const optionList = (values?: string[]) => values?.map((value) => ({ value, label: nice(value) })) ?? [];
  const choices: Record<string, { value: string; label: string }[]> = {
    ...FIXED,
    city: optionList(options?.city), locality: optionList(options?.locality), type: optionList(options?.type),
    status: optionList(options?.status), approval: optionList(options?.approval), builder: optionList(options?.builder),
    project: options?.project ?? [], areaBasis: optionList(options?.areaBasis),
    uploader: (options?.uploader ?? []).map((id) => ({ value: id, label: options?.uploaderNames?.[id] ?? `Staff #${id}` })),
  };
  const display = (k: string, v: string) => choices[k]?.find((o) => o.value === v)?.label ?? (k === "minPrice" || k === "maxPrice" ? `₹${Number(v).toLocaleString("en-IN")}` : nice(v));
  const disabled = (k: string) => (k === "kind" && section !== "overview" && section !== "pricing" && section !== "demand") || ((k === "approval" || k === "uploader") && filters.kind === "project");

  return (
    <DashContext.Provider value={ctx}>
      <div className="dash-palette min-w-0 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Property Insights sections" className="flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-muted/70 p-0.5">
            {INSIGHT_SECTIONS.map((s) => (
              <button key={s.value} type="button" aria-current={section === s.value ? "page" : undefined} onClick={() => selectSection(s.value)} className={segmentClass(section === s.value)}>
                {s.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger render={toolbarFilterButton(active.length, "Filters")} />
              <PopoverContent align="end" className="w-[min(92vw,560px)] gap-0 p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <p className="text-[14px] font-semibold">Filters</p>
                  {active.length > 0 && <button type="button" onClick={reset} className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground">Reset all</button>}
                </div>
                <div className="grid max-h-[min(70vh,560px)] grid-cols-1 gap-x-3 gap-y-3 overflow-y-auto p-4 sm:grid-cols-2">
                  {(["kind", "city", "locality", "type", "mode", "status", "approval", "visible", "builder", "project", "bedrooms", "uploader", "provenance", "areaBasis"] as const).map((k) => (
                    <label key={k} className="flex min-w-0 flex-col gap-1 text-[12px] text-muted-foreground">
                      {k === "status" ? (filters.kind === "project" ? "Publication status" : filters.kind === "property" ? "Availability" : "Listing status") : LABELS[k]}
                      <SearchableFormSelect
                        name={`inventory-${k}`}
                        value={filters[k] || ""}
                        options={[{ label: "All", value: "" }, ...(choices[k] ?? [])]}
                        placeholder="All"
                        disabled={disabled(k)}
                        onValueChange={(value: unknown) => { if (typeof value === "string") change(k, value); }}
                        className="h-8! text-sm"
                      />
                    </label>
                  ))}
                  {(["minPrice", "maxPrice"] as const).map((k) => (
                    <label key={k} className="flex flex-col gap-1 text-[12px] text-muted-foreground">
                      {k === "minPrice" ? "Minimum price (₹)" : "Maximum price (₹)"}
                      <input type="number" min="0" inputMode="numeric" value={filters[k] || ""} onChange={(e) => change(k, e.target.value)}
                        className="h-8 rounded-md border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    </label>
                  ))}
                  <label className="flex flex-col gap-1 text-[12px] text-muted-foreground sm:col-span-2">
                    Inventory as it was on
                    <input type="date" min={shown?.coverage.historyFrom?.slice(0, 10)} max={new Date().toISOString().slice(0, 10)} value={filters.asOf || ""}
                      onChange={(e) => change("asOf", e.target.value)}
                      className="h-8 rounded-md border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-1/2" />
                  </label>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {active.length > 0 && (
          <div className="-mt-3 flex flex-wrap items-center gap-1.5">
            {active.map(([k, v]) => (
              <button key={k} type="button" onClick={() => change(k, k === "kind" ? kindFor(section) : "")}
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-muted/70 px-2 text-[12.5px] text-foreground hover:bg-muted">
                <span className="text-muted-foreground">{LABELS[k] ?? k}</span>{display(k, v)}
                <X className="size-3 text-muted-foreground" aria-label={`Remove ${LABELS[k] ?? k}`} />
              </button>
            ))}
            <button type="button" onClick={reset} className="h-7 rounded-md px-2 text-[12.5px] text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}
        {notice && <p role="alert" className="text-[13px] text-destructive">{notice}</p>}

        {!shown && !result?.error ? (
          <Skeleton />
        ) : !shown ? (
          <div role="alert" className="mx-auto mt-10 max-w-md rounded-xl border bg-card p-6 text-center">
            <p className="text-[14px] font-medium">Property insights could not load</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{result?.error}</p>
            <button type="button" onClick={() => setRevision((n) => n + 1)} className="mt-4 h-8 rounded-md bg-foreground px-3 text-[13px] font-medium text-background">Try again</button>
          </div>
        ) : (
          <div className={cn("relative space-y-8 transition-opacity duration-200", loading && "pointer-events-none opacity-60")} aria-busy={loading}>
            {Object.values(shown.sources).some((s) => s !== "available") && (
              <p role="status" className="text-[12.5px] text-muted-foreground">
                Some data is missing: {Object.entries(shown.sources).filter(([, v]) => v !== "available").map(([k, v]) => `${k}: ${v}`).join(" · ")}
              </p>
            )}
            {shown.selectionRequired ? (
              <div className="rounded-xl border border-dashed bg-card px-5 py-8 text-center">
                <p className="text-[14px] font-medium">Pick what to compare</p>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">Prices only compare like with like. Choose a price basis and a type.</p>
                <div className="mx-auto mt-4 flex max-w-sm flex-wrap justify-center gap-1.5">
                  {FIXED.mode.map((m) => (
                    <button key={m.value} type="button" onClick={() => change("mode", m.value)} className={cn("h-8 rounded-md px-3 text-[13px]", filters.mode === m.value ? "bg-foreground text-background" : "bg-muted/70 hover:bg-muted")}>{m.label}</button>
                  ))}
                </div>
                <div className="mx-auto mt-2 flex max-w-lg flex-wrap justify-center gap-1.5">
                  {choices.type.map((t) => (
                    <button key={t.value} type="button" onClick={() => change("type", t.value)} className={cn("h-8 rounded-md px-3 text-[13px]", filters.type === t.value ? "bg-foreground text-background" : "bg-muted/70 hover:bg-muted")}>{t.label}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
                {built?.blocks.map((b, i) => (
                  <div key={b.id} className={cn("min-w-0", b.kind !== "kpis" && "dash-rise", SPAN[b.span ?? "full"])} style={{ "--i": i } as CSSProperties}>
                    {b.kind === "kpis" ? <Kpis block={b} /> : <Card block={b} />}
                  </div>
                ))}
              </div>
            )}
            {QUEUE_SECTIONS.includes(section) && shown.issues.length > 0 && (
              <AttentionQueue issues={shown.issues} onOpen={onDrill} />
            )}
          </div>
        )}
      </div>
      <InventoryRecordsDialog filters={drill?.filters ?? null} label={drill?.label ?? "Listings"} onClose={() => setDrill(null)} onInspect={setListing} onCompare={compare} selected={selected} />
      <ListingInsightsDialog listing={listing} filters={baseFilters} onClose={() => setListing(null)} />
      <ListingCompareDialog keys={comparing ? selected : []} filters={baseFilters} onClose={() => setComparing(false)} />
      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-[13px] shadow-lg">
            <span>{selected.length} selected</span>
            <button type="button" disabled={selected.length < 2} onClick={() => setComparing(true)} className="h-7 rounded-md bg-foreground px-2.5 font-medium text-background disabled:opacity-40">Compare</button>
            <button type="button" onClick={() => setSelected([])} className="h-7 rounded-md px-2 text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        </div>
      )}
    </DashContext.Provider>
  );
}

function Card({ block }: { block: Exclude<Block, { kind: "kpis" }> }) {
  return (
    <article className="h-full rounded-xl border bg-card p-4 sm:p-5">
      <header className="mb-4">
        <h3 className="text-[14px] font-semibold text-foreground">{block.title}</h3>
        {block.subtitle && <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{block.subtitle}</p>}
      </header>
      {block.kind === "trend" ? <TrendChart block={block} />
        : block.kind === "bars" ? <BarList block={block} />
        : block.kind === "stacked" ? <StackedBars block={block} />
        : block.kind === "donut" ? <Donut block={block} />
        : block.kind === "heatmap" ? <Heatmap block={block} />
        : block.kind === "scatter" ? <Scatter block={block} />
        : null}
    </article>
  );
}

/** Listings that need someone to fix them, biggest problem first. Each row opens the listings behind it. */
function AttentionQueue({ issues, onOpen }: { issues: InventoryReport["issues"]; onOpen: (m: InventoryMatch, label: string) => void }) {
  const [all, setAll] = useState(false);
  const sorted = [...issues].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const list = all ? sorted : sorted.slice(0, 9);
  if (!sorted.length) return null;
  return (
    <section aria-labelledby="attention-queue" className="dash-rise">
      <div className="mb-4">
        <h2 id="attention-queue" className="text-[15px] font-semibold text-foreground">Attention queue</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Listings with something to fix. Open a row to see them.</p>
      </div>
      <div className="grid gap-x-4 rounded-xl border bg-card p-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((issue) => (
          <button key={issue.key} type="button" onClick={() => onOpen(issue.match, issue.label)}
            className="group flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60">
            <AlertTriangle aria-hidden className="size-3.5 shrink-0" style={{ color: STATUS.warn }} />
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-foreground/90">{issue.label}</span>
            <span className="text-[13px] font-medium tabular-nums text-foreground">{inventoryCount(issue.value)}</span>
            <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
      {sorted.length > 9 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          {all ? "Show fewer" : `Show all ${sorted.length}`}
        </button>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading Property Insights" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[104px] animate-pulse rounded-xl bg-muted" />)}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
