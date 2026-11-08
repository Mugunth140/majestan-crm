"use client";
import { useEffect, useMemo, useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { Check, ChevronDown, Download, GripVertical, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageActions } from "@/components/layout/page-actions";
import { segmentClass, toolbarFilterButton } from "@/components/layout/list-page";
import { NAVIGATION } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";
import "./reports.css";
import { displayCell, downloadWorkbook, reportsApi, type ReportField, type ReportModule, type ReportRequest, type ReportResult } from "@/lib/reports-api";

/** The sidebar entry each report comes from, for its icon and colour. */
const HREF: Record<string, string> = {
  leads: "/leads", inbound: "/inbound", agents: "/agent-network", assets: "/asset-inventory", hr: "/hr", projects: "/projects", properties: "/properties", blog: "/blog",
};
const navFor = (key: string) => NAVIGATION.find((n) => n.href === HREF[key]);

type Period = "all" | "month" | "30d" | "year" | "custom";
const PERIODS: { value: Period; label: string }[] = [
  { value: "all", label: "All time" }, { value: "month", label: "This month" }, { value: "30d", label: "Last 30 days" }, { value: "year", label: "This year" }, { value: "custom", label: "Custom" },
];
const ROW_COUNTS = [20, 50, 100] as const;
type RowCount = (typeof ROW_COUNTS)[number];
type Draft = { fields: string[]; period: Period; from: string; to: string; filters: Record<string, string[]> };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
function rangeOf(d: Draft): { from?: string; to?: string } {
  const t = today();
  if (d.period === "month") return { from: `${t.slice(0, 7)}-01`, to: t };
  if (d.period === "30d") return { from: shift(t, -29), to: t };
  if (d.period === "year") return { from: `${t.slice(0, 4)}-01-01`, to: t };
  if (d.period === "custom") return { from: d.from || undefined, to: d.to || undefined };
  return {};
}

// The admin's last choice per report is kept on this device, so a weekly export is one click.
const STORE = "crm_reports:";
function loadDraft(mod: ReportModule): Draft {
  const fresh: Draft = { fields: mod.fields.filter((f) => f.default).map((f) => f.key), period: "all", from: "", to: "", filters: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE + mod.key) ?? "null") as Draft | null;
    if (!saved) return fresh;
    const known = new Set(mod.fields.map((f) => f.key));
    const fields = saved.fields.filter((k) => known.has(k));
    return { ...fresh, ...saved, fields: fields.length ? fields : fresh.fields, filters: Object.fromEntries(Object.entries(saved.filters ?? {}).filter(([k]) => mod.filters.some((x) => x.key === k))) };
  } catch {
    return fresh;
  }
}
function saveDraft(key: string, d: Draft) {
  try { localStorage.setItem(STORE + key, JSON.stringify(d)); } catch { /* private mode: nothing to keep */ }
}

export function ReportBuilder() {
  const [modules, setModules] = useState<ReportModule[] | null>(null);
  const [error, setError] = useState("");
  // Every visit starts on the picker; the columns chosen for each report are still remembered.
  const [active, setActive] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    reportsApi.modules().then(setModules, (e: Error) => setError(e.message || "Reports could not load"));
  }, []);

  const mod = modules?.find((m) => m.key === active);
  const draft = mod ? drafts[mod.key] ?? loadDraft(mod) : null;
  const update = (patch: Partial<Draft>) => {
    if (!mod || !draft) return;
    const next = { ...draft, ...patch };
    setDrafts((d) => ({ ...d, [mod.key]: next }));
    saveDraft(mod.key, next);
  };
  const pick = (key: string) => setActive(key);

  if (error) return <p role="alert" className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-6 text-center text-[14px]">{error}</p>;
  if (!modules) return <BuilderSkeleton />;

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col px-4 pb-16 pt-4 lg:px-0 lg:pt-0">
      {mod && draft ? <Workbench key={mod.key} mod={mod} modules={modules} onPick={pick} draft={draft} update={update} /> : <PickReport modules={modules} onPick={pick} />}
    </div>
  );
}

/** The report being built, and a quick way to switch to another one. */
function ModuleSwitch({ modules, active, onPick }: { modules: ReportModule[]; active: ReportModule; onPick: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const nav = navFor(active.key);
  const Icon = nav?.icon;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={
        <button type="button" aria-label={`Report: ${active.label}. Switch report`}
          className="flex h-8 items-center gap-2 rounded-md border bg-background pl-2.5 pr-2 text-[13px] font-medium shadow-xs transition-colors hover:bg-muted/60 data-[popup-open]:bg-muted/60">
          {Icon && <Icon className={cn("size-4", nav?.color)} strokeWidth={1.75} />}
          {active.label}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      } />
      <PopoverContent align="start" className="w-56 gap-0 p-1">
        {modules.map((m) => {
          const n = navFor(m.key);
          const I = n?.icon;
          const on = m.key === active.key;
          return (
            <button key={m.key} type="button" onClick={() => { setOpen(false); onPick(m.key); }} aria-current={on ? "true" : undefined}
              className={cn("flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] hover:bg-muted/70", on && "bg-muted font-medium")}>
              {I && <I className={cn("size-4 shrink-0", n?.color)} strokeWidth={1.75} />}
              <span className="flex-1 truncate">{m.label}</span>
              <span className="text-[11.5px] tabular-nums text-muted-foreground">{m.fields.length}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function Workbench({ mod, modules, onPick, draft, update }: { mod: ReportModule; modules: ReportModule[]; onPick: (k: string) => void; draft: Draft; update: (p: Partial<Draft>) => void }) {
  const [preview, setPreview] = useState<{ key: string; data?: ReportResult; error?: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [rows, setRows] = useState<RowCount>(20);
  const range = rangeOf(draft);
  const reqKey = JSON.stringify({ module: mod.key, fields: draft.fields, ...range, filters: draft.filters, limit: rows });
  const request = useMemo(() => JSON.parse(reqKey) as ReportRequest, [reqKey]);

  useEffect(() => {
    if (!request.fields.length) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      reportsApi.preview(request, ctrl.signal).then(
        (data) => { if (!ctrl.signal.aborted) setPreview({ key: reqKey, data }); },
        (e: Error) => { if (!ctrl.signal.aborted) setPreview({ key: reqKey, error: e.message || "Preview failed" }); },
      );
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [request, reqKey]);

  const loading = preview?.key !== reqKey && draft.fields.length > 0;
  const data = preview?.data;
  const total = data?.total ?? null;
  const filterCount = Object.values(draft.filters).filter((v) => v.length).length;

  const exportNow = async () => {
    setExporting(true);
    try {
      // The export takes every row; the row count only sizes the preview.
      const result = await reportsApi.export({ ...request, limit: undefined });
      const filters = mod.filters.flatMap((f) => (draft.filters[f.key]?.length ? [[f.label, draft.filters[f.key].map((v) => f.options.find((o) => o.value === v)?.label ?? v).join(", ")] as [string, string]] : []));
      await downloadWorkbook(result, [
        ["Exported", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
        [`${mod.dateLabel} between`, range.from || range.to ? `${range.from ?? "the start"} and ${range.to ?? "today"}` : "All time"],
        ...filters,
      ]);
      toast.success(`Exported ${result.rows.length.toLocaleString("en-IN")} rows`, { description: result.truncated ? `The first ${result.rows.length.toLocaleString("en-IN")} of ${result.total.toLocaleString("en-IN")}. Narrow the filters for the rest.` : undefined });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const exportButton = (
    <button type="button" onClick={() => void exportNow()} disabled={exporting || !draft.fields.length || total === 0}
      className="flex h-8 items-center gap-1.5 rounded-md bg-[#017D58] px-3 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(1,125,88,0.3),inset_0_1px_0_rgba(255,255,255,0.12)] transition-[background-color,transform] hover:bg-[#016347] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#0B8F66] dark:hover:bg-[#017D58]">
      {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {exporting ? "Preparing…" : "Export to Excel"}
    </button>
  );

  return (
    <div className="min-w-0 flex-1 space-y-4">
      <PageActions>{exportButton}</PageActions>
      <div className="flex flex-wrap items-center gap-2">
        <ModuleSwitch modules={modules} active={mod} onPick={onPick} />
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <span className="text-[13px] text-muted-foreground">{mod.dateLabel}</span>
        <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-muted/70 p-0.5" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.value} type="button" aria-pressed={draft.period === p.value} onClick={() => update({ period: p.value, ...(p.value === "custom" && !draft.from ? { from: shift(today(), -29), to: today() } : {}) })} className={segmentClass(draft.period === p.value)}>{p.label}</button>
          ))}
        </div>
        {draft.period === "custom" && (
          <div className="flex items-center gap-1.5 text-[13px]">
            <input type="date" aria-label="From" value={draft.from} max={draft.to || undefined} onChange={(e) => update({ from: e.target.value })} className="h-8 rounded-md border bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <span className="text-muted-foreground">to</span>
            <input type="date" aria-label="To" value={draft.to} min={draft.from || undefined} onChange={(e) => update({ to: e.target.value })} className="h-8 rounded-md border bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        )}
        <FiltersPopover mod={mod} value={draft.filters} count={filterCount} onChange={(filters) => update({ filters })} />
        <div className="ml-auto md:hidden">{exportButton}</div>
      </div>

      <div className="space-y-4">
        <ColumnPicker fields={mod.fields} selected={draft.fields} onChange={(fields) => update({ fields })} />
        <section aria-label="Preview" className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="text-[14px] font-semibold">Preview</h2>
              <p className="text-[12.5px] text-muted-foreground">
                {!draft.fields.length ? "Choose columns to see rows" : total === null ? "Counting rows…" : total === 0 ? "No rows match" : `${total.toLocaleString("en-IN")} row${total === 1 ? "" : "s"} · ${draft.fields.length} column${draft.fields.length === 1 ? "" : "s"}`}
                {total !== null && total > 50000 && " · the export takes the first 50,000"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {loading && <Loader2 aria-label="Loading preview" className="size-4 animate-spin text-muted-foreground" />}
              <div role="group" aria-label="Rows to show" className="flex items-center gap-0.5 rounded-md bg-muted/70 p-0.5">
                <span className="px-1.5 text-[12px] text-muted-foreground">Rows</span>
                {ROW_COUNTS.map((n) => (
                  <button key={n} type="button" aria-pressed={rows === n} onClick={() => setRows(n)} className={segmentClass(rows === n)}>{n}</button>
                ))}
              </div>
            </div>
          </div>
          {preview?.error && preview.key === reqKey ? (
            <p role="alert" className="px-4 py-10 text-center text-[13px] text-muted-foreground">{preview.error}</p>
          ) : !draft.fields.length ? (
            <p className="px-4 py-16 text-center text-[13px] text-muted-foreground">Tick the columns you want in the file.</p>
          ) : data ? (
            <PreviewTable data={data} dim={loading} />
          ) : (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-7 animate-pulse rounded bg-muted" />)}</div>
          )}
        </section>
      </div>
    </div>
  );
}

function PreviewTable({ data, dim }: { data: ReportResult; dim: boolean }) {
  if (!data.rows.length) return <p className="px-4 py-16 text-center text-[13px] text-muted-foreground">Nothing matches these filters.</p>;
  return (
    <div className={cn("max-h-[min(68vh,720px)] overflow-auto transition-opacity", dim && "opacity-60")}>
      <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            {data.columns.map((c) => (
              <th key={c.key} scope="col" className={cn("sticky top-0 z-10 whitespace-nowrap border-b bg-card px-3 py-2 text-left text-[12px] font-medium text-muted-foreground", (c.type === "number" || c.type === "money") && "text-right")}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, r) => (
            <tr key={r} className="hover:bg-muted/40">
              {row.map((v, i) => {
                const c = data.columns[i];
                const text = displayCell(c.type, v);
                return (
                  <td key={c.key} title={text.length > 40 ? text : undefined}
                    className={cn("max-w-[280px] truncate whitespace-nowrap border-b border-border/60 px-3 py-2 text-foreground/90", (c.type === "number" || c.type === "money") && "text-right tabular-nums", !text && "text-muted-foreground/50")}>
                    {text || "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {data.total > data.rows.length && (
        <p className="sticky left-0 px-4 py-3 text-[12.5px] text-muted-foreground">Showing {data.rows.length} of {data.total.toLocaleString("en-IN")} rows. The export has all {Math.min(data.total, 50000).toLocaleString("en-IN")}.</p>
      )}
    </div>
  );
}

/** Full width: the ticked columns line up on top in export order (drag to reorder); every column sits below, grouped. */
function ColumnPicker({ fields, selected, onChange }: { fields: ReportField[]; selected: string[]; onChange: (keys: string[]) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const groups = useMemo(() => {
    const out = new Map<string, ReportField[]>();
    for (const f of fields) {
      if (q && !`${f.label} ${f.group}`.toLowerCase().includes(q)) continue;
      out.set(f.group, [...(out.get(f.group) ?? []), f]);
    }
    return [...out];
  }, [fields, q]);
  const toggle = (key: string) => onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  return (
    <section aria-label="Columns" className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
        <h2 className="text-[14px] font-semibold">Columns <span className="font-normal text-muted-foreground">{selected.length} of {fields.length}</span></h2>
        <label className="order-last flex h-8 w-full items-center gap-2 rounded-md bg-muted/70 px-2.5 text-[13px] focus-within:ring-2 focus-within:ring-ring sm:order-none sm:ml-auto sm:w-60">
          <Search className="size-3.5 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a column" aria-label="Find a column" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear"><X className="size-3.5 text-muted-foreground" /></button>}
        </label>
        <div className="ml-auto flex gap-0.5 text-[12.5px] sm:ml-0">
          <button type="button" onClick={() => onChange(fields.filter((f) => f.default).map((f) => f.key))} className="h-7 rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-foreground">Defaults</button>
          <button type="button" onClick={() => onChange(fields.map((f) => f.key))} className="h-7 rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-foreground">All</button>
          <button type="button" onClick={() => onChange([])} className="h-7 rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-foreground">None</button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="border-b bg-muted/25 px-4 py-2.5">
          <p className="pb-1.5 text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Order in the file <span className="normal-case tracking-normal">· drag to move</span></p>
          <Reorder.Group axis="x" values={selected} onReorder={onChange} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {selected.map((key, i) => byKey.get(key) && <SelectedChip key={key} index={i + 1} field={byKey.get(key)!} onRemove={() => toggle(key)} />)}
          </Reorder.Group>
        </div>
      )}

      <div className="max-h-[360px] overflow-y-auto px-2 pb-3">
        <div>
          {groups.map(([group, list]) => {
            const on = list.filter((f) => selected.includes(f.key)).length;
            return (
              <div key={group} className="pt-3">
                <div className="flex items-center gap-3 px-2 pb-0.5">
                  <p className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{group} <span className="tabular-nums normal-case tracking-normal">{on}/{list.length}</span></p>
                  <button type="button" onClick={() => onChange(on === list.length ? selected.filter((k) => !list.some((f) => f.key === k)) : [...selected, ...list.map((f) => f.key).filter((k) => !selected.includes(k))])}
                    className="text-[11.5px] text-muted-foreground hover:text-foreground">{on === list.length ? "Clear" : "Add all"}</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {list.map((f) => {
                  const checked = selected.includes(f.key);
                  return (
                    <button key={f.key} type="button" role="checkbox" aria-checked={checked} onClick={() => toggle(f.key)}
                      className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] text-foreground/90 hover:bg-muted/60">
                      <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors", checked ? "border-[#017D58] bg-[#017D58] text-white dark:border-[#0B8F66] dark:bg-[#0B8F66]" : "border-foreground/25")}>
                        {checked && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className="truncate">{f.label}</span>
                    </button>
                  );
                })}
                </div>
              </div>
            );
          })}
        </div>
        {!groups.length && <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">No column matches “{query}”.</p>}
      </div>
    </section>
  );
}

function SelectedChip({ field, index, onRemove }: { field: ReportField; index: number; onRemove: () => void }) {
  const drag = useDragControls();
  return (
    <Reorder.Item value={field.key} dragListener={false} dragControls={drag} title={field.group}
      className="flex h-7 shrink-0 items-center gap-1 rounded-md border bg-card pl-0.5 pr-0.5 text-[12.5px] shadow-xs" whileDrag={{ scale: 1.04, boxShadow: "0 6px 18px rgba(0,0,0,0.18)", zIndex: 1 }}>
      <button type="button" aria-label={`Drag ${field.label}`} onPointerDown={(e) => drag.start(e)} className="flex h-6 cursor-grab touch-none items-center gap-1 rounded pl-1 pr-0.5 text-muted-foreground/70 hover:text-foreground active:cursor-grabbing">
        <GripVertical className="size-3" />
        <span className="tabular-nums text-[11px]">{index}</span>
      </button>
      <span className="max-w-[180px] truncate text-foreground/90">{field.label}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${field.label}`} className="flex size-5 items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground">
        <X className="size-3" />
      </button>
    </Reorder.Item>
  );
}

function FiltersPopover({ mod, value, count, onChange }: { mod: ReportModule; value: Record<string, string[]>; count: number; onChange: (v: Record<string, string[]>) => void }) {
  const [query, setQuery] = useState<Record<string, string>>({});
  const set = (key: string, list: string[]) => onChange({ ...value, [key]: list });
  return (
    <Popover>
      <PopoverTrigger render={toolbarFilterButton(count, "Filters")} />
      <PopoverContent align="start" className="w-[min(92vw,420px)] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-[14px] font-semibold">Filters</p>
          {count > 0 && <button type="button" onClick={() => onChange({})} className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground">Clear all</button>}
        </div>
        <div className="max-h-[min(65vh,520px)] divide-y overflow-y-auto">
          {mod.filters.map((f) => {
            const chosen = value[f.key] ?? [];
            const q = (query[f.key] ?? "").toLowerCase();
            const options = f.options.filter((o) => !q || o.label.toLowerCase().includes(q));
            return (
              <div key={f.key} className="px-2 py-2.5">
                <div className="flex items-center justify-between px-2 pb-1">
                  <p className="text-[12.5px] font-medium text-foreground">{f.label}</p>
                  {chosen.length > 0 && <button type="button" onClick={() => set(f.key, [])} className="text-[12px] text-muted-foreground hover:text-foreground">Clear</button>}
                </div>
                {f.options.length > 8 && (
                  <input value={query[f.key] ?? ""} onChange={(e) => setQuery((s) => ({ ...s, [f.key]: e.target.value }))} placeholder={`Find ${f.label.toLowerCase()}`} aria-label={`Find ${f.label}`}
                    className="mx-2 mb-1 h-7 w-[calc(100%-1rem)] rounded-md bg-muted/70 px-2 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                )}
                <div className="max-h-44 overflow-y-auto">
                  {options.map((o) => {
                    const on = chosen.includes(o.value);
                    return (
                      <button key={o.value} type="button" role="checkbox" aria-checked={on} onClick={() => set(f.key, on ? chosen.filter((v) => v !== o.value) : [...chosen, o.value])}
                        className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] hover:bg-muted/60">
                        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-[4px] border", on ? "border-[#017D58] bg-[#017D58] text-white dark:border-[#0B8F66] dark:bg-[#0B8F66]" : "border-foreground/25")}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                        <span className={cn("min-w-0 flex-1 truncate", o.value === "__blank__" && "italic text-muted-foreground")}>{o.label}</span>
                        {o.count !== undefined && <span className="text-[12px] tabular-nums text-muted-foreground">{o.count}</span>}
                      </button>
                    );
                  })}
                  {!options.length && <p className="px-2 py-2 text-[12.5px] text-muted-foreground">No options</p>}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Arriving on Reports: a picture of what a report is, and one card per kind of data. */
function PickReport({ modules, onPick }: { modules: ReportModule[]; onPick: (k: string) => void }) {
  return (
    <section aria-labelledby="pick-report" className="flex min-w-0 flex-1 flex-col items-center px-2 pb-8 pt-6 text-center lg:pt-14">
      <ReportIllustration />
      <h2 id="pick-report" className="mt-6 text-[18px] font-semibold tracking-[-0.01em] text-foreground">Pick a report</h2>
      <p className="mt-1 max-w-sm text-balance text-[13.5px] text-muted-foreground">Choose the data, tick the columns you want, and download it as an Excel file.</p>
      <div className="mt-7 grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
        {modules.map((m, i) => {
          const nav = navFor(m.key);
          const Icon = nav?.icon;
          return (
            <button key={m.key} type="button" onClick={() => onPick(m.key)} style={{ animationDelay: `${120 + i * 35}ms` }}
              className="group flex animate-in flex-col items-start gap-3 rounded-xl border bg-card p-3.5 text-left fill-mode-both fade-in-0 slide-in-from-bottom-1 duration-300 transition-[border-color,background-color,transform] hover:border-foreground/20 hover:bg-muted/40 active:scale-[0.98]">
              <span className="flex size-8 items-center justify-center rounded-lg bg-foreground/[0.05]">
                {Icon && <Icon className={cn("size-4", nav?.color)} strokeWidth={1.75} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-foreground">{m.label}</span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">{m.fields.length} columns</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** A sheet with one column being lifted out of it: what a report does, drawn in the page's own colours. */
function ReportIllustration() {
  const rows = [0, 1, 2, 3, 4];
  return (
    <svg viewBox="0 0 240 150" className="w-[220px] text-foreground sm:w-[260px]" role="img" aria-label="A spreadsheet with one column picked out">
      <defs>
        <linearGradient id="rep-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.07" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Sheet behind */}
      <rect x="44" y="14" width="150" height="112" rx="10" fill="url(#rep-fade)" stroke="currentColor" strokeOpacity="0.08" transform="rotate(-4 119 70)" />
      {/* Sheet */}
      <rect x="36" y="22" width="160" height="116" rx="10" className="fill-card" stroke="currentColor" strokeOpacity="0.14" />
      <rect x="36" y="22" width="160" height="22" rx="10" fill="currentColor" fillOpacity="0.05" />
      <rect x="36" y="34" width="160" height="10" fill="currentColor" fillOpacity="0.05" />
      {[0, 1, 2].map((c) => <rect key={c} x={48 + c * 50} y="30" width={c === 1 ? 26 : 32} height="6" rx="3" fill="currentColor" fillOpacity="0.28" />)}
      {rows.map((r) => (
        <g key={r}>
          <line x1="36" x2="196" y1={58 + r * 17} y2={58 + r * 17} stroke="currentColor" strokeOpacity="0.07" />
          {[0, 1, 2].map((c) => <rect key={c} x={48 + c * 50} y={48 + r * 17} width={[28, 22, 34, 18, 30][(r + c) % 5]} height="5" rx="2.5" fill="currentColor" fillOpacity="0.13" />)}
        </g>
      ))}
      {/* The picked column, lifted */}
      <g className="rep-lift">
        <rect x="140" y="12" width="66" height="112" rx="9" fill="#0B8F66" fillOpacity="0.12" stroke="#2FB585" strokeOpacity="0.7" />
        <rect x="150" y="22" width="30" height="6" rx="3" fill="#2FB585" />
        {rows.map((r) => <rect key={r} x="150" y={40 + r * 17} width={[36, 26, 42, 22, 32][r]} height="5" rx="2.5" fill="#2FB585" fillOpacity="0.55" />)}
        <circle cx="200" cy="18" r="9" fill="#0B8F66" />
        <path d="M195.8 18.2l2.9 2.8 5.2-5.6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* Excel file it becomes */}
      <g transform="translate(14 96)">
        <rect width="40" height="44" rx="7" className="fill-card" stroke="currentColor" strokeOpacity="0.14" />
        <rect x="8" y="9" width="24" height="18" rx="3" fill="#0B8F66" />
        <path d="M14 13.5l12 9M26 13.5l-12 9" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="8" y="32" width="18" height="4" rx="2" fill="currentColor" fillOpacity="0.2" />
      </g>
    </svg>
  );
}

function BuilderSkeleton() {
  return (
    <div role="status" aria-label="Loading reports" className="mx-auto flex w-full max-w-screen-2xl flex-col items-center gap-4 px-4 pt-16">
      <div className="h-36 w-60 animate-pulse rounded-xl bg-muted" />
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
    </div>
  );
}
