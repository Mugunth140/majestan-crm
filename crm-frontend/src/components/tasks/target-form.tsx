"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/record/feed";
import { PageActions } from "@/components/layout/page-actions";
import { SegmentTabs, ToolbarSelect, headerButtonClass, headerPrimaryClass } from "@/components/layout/list-page";
import { Input } from "@/components/ui/input";
import { amount, monthLabel } from "./format";
import { SourceChip } from "./parts";
import { send, TASKS_API, useLive } from "./use-tasks";
import type { MetricDef, Setup } from "./types";

const WORKING_DAYS = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= last; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0) n++;
  return n;
};

type Entry = { value: string; weeks: string[] | null };

/** Set the same monthly targets for one or more people in a department. */
export function TargetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [month, setMonth] = useState<string | null>(params.get("month"));
  const setup = useLive<Setup>(`${TASKS_API}/setup${month ? `?month=${month}` : ""}`, { poll: false });
  const data = setup.data;
  const preselect = useMemo(() => new Set((params.get("people") ?? "").split(",").map(Number).filter(Boolean)), [params]);

  const [deptId, setDeptId] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [saving, setSaving] = useState(false);

  if (!data) {
    return setup.error
      ? <p className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-6 text-center text-[13px] text-muted-foreground">{setup.error}</p>
      : <div className="flex justify-center py-20"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }

  // Start on the department of the people asked for, else the first one.
  const fromPeople = data.departments.find((d) => d.people.some((p) => preselect.has(p.id)));
  const dept = data.departments.find((d) => d.id === deptId) ?? fromPeople ?? data.departments[0];
  if (!dept) return <p className="mx-auto mt-16 max-w-md text-center text-[13px] text-muted-foreground">There are no teams you can set targets for.</p>;
  const open = dept.people.filter((p) => !p.taken);
  const chosen = picked ?? new Set(open.filter((p) => preselect.has(p.id)).map((p) => p.id));
  const workingDays = WORKING_DAYS(data.month);
  const filled = dept.metrics.filter((d) => Number(entries[d.key]?.value) > 0);

  const toggle = (id: number) => { const n = new Set(chosen); if (n.has(id)) n.delete(id); else n.add(id); setPicked(n); };
  const setValue = (key: string, value: string) => setEntries((e) => ({ ...e, [key]: { value, weeks: e[key]?.weeks ?? null } }));
  const setWeeks = (key: string, weeks: string[] | null) => setEntries((e) => ({ ...e, [key]: { value: e[key]?.value ?? "", weeks } }));
  const changeDept = (id: string) => { setDeptId(Number(id)); setPicked(new Set()); setEntries({}); };

  const submit = async () => {
    if (!chosen.size) { toast.error("Choose at least one person"); return; }
    if (!filled.length) { toast.error("Give at least one target"); return; }
    setSaving(true);
    try {
      const r = await send<{ created: number[]; skipped: { name: string; reason: string }[] }>("", "POST", {
        department_id: dept.id, month: data.month, assignees: [...chosen],
        metrics: filled.map((d) => {
          const e = entries[d.key];
          const weeks = e.weeks?.map(Number);
          return { key: d.key, monthly_target: Number(e.value), ...(weeks && weeks.every((w) => Number.isFinite(w)) ? { weekly_overrides: { 1: weeks[0], 2: weeks[1], 3: weeks[2], 4: weeks[3] } } : {}) };
        }),
      });
      if (r.created.length) toast.success(`Targets set for ${r.created.length} ${r.created.length === 1 ? "person" : "people"} in ${monthLabel(data.month)}`);
      for (const s of r.skipped) toast.warning(`${s.name}: ${s.reason}`);
      if (r.created.length) router.push(`/tasks${data.month === data.months[0] ? "" : `?month=${data.month}`}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const actions = (
    <>
      <button type="button" onClick={() => router.back()} className={headerButtonClass}>Cancel</button>
      <button type="button" onClick={submit} disabled={saving} className={headerPrimaryClass}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        Set targets{chosen.size > 1 ? ` for ${chosen.size}` : ""}
      </button>
    </>
  );

  return (
    <>
      <PageActions>{actions}</PageActions>
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-5 px-4 pb-28 pt-4 lg:px-0 lg:pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentTabs label="Month" value={data.month} onChange={(m) => { setMonth(m); setPicked(null); }}
            tabs={data.months.map((m, i) => ({ value: m, label: `${i === 0 ? "This month" : "Next month"} · ${monthLabel(m, true)}` }))} />
          {data.departments.length > 1 && (
            <ToolbarSelect label="Team" value={String(dept.id)} closeOnSelect onChange={changeDept}
              options={data.departments.map((d) => ({ value: String(d.id), label: d.name.replace(/\s+Department$/i, "") }))} />
          )}
        </div>

        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[14px] font-semibold">Who</h2>
            {open.length > 1 && (
              <button type="button" onClick={() => setPicked(chosen.size === open.length ? new Set() : new Set(open.map((p) => p.id)))} className="text-[12.5px] text-muted-foreground hover:text-foreground">
                {chosen.size === open.length ? "Clear" : `Select all ${open.length}`}
              </button>
            )}
          </div>
          {dept.people.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted-foreground">Nobody active in this team.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {dept.people.map((p) => {
                const on = chosen.has(p.id);
                return (
                  <button key={p.id} type="button" disabled={p.taken} onClick={() => toggle(p.id)} aria-pressed={on}
                    title={p.taken ? `Already has targets for ${monthLabel(data.month)}` : undefined}
                    className={cn("inline-flex h-9 items-center gap-2 rounded-full border pl-1 pr-3 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      on ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted")}>
                    {on ? <span className="flex size-7 items-center justify-center rounded-full bg-background/20"><Check className="size-4" /></span>
                      : <Avatar name={p.name} src={p.avatar} userId={p.id} staff className="size-7 text-[11px]" />}
                    {p.name}
                    {p.taken && <span className="text-[11.5px]">· has targets</span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card">
          <div className="p-4 pb-2 sm:p-5 sm:pb-2">
            <h2 className="text-[14px] font-semibold">Monthly targets</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Auto targets count themselves from the call logger and the CRM. Each splits into four weeks (1–7, 8–14, 15–21, 22–end); a week&apos;s shortfall moves into the next.
            </p>
          </div>
          <ul className="divide-y">
            {dept.metrics.map((d) => <MetricInput key={d.key} d={d} entry={entries[d.key]} workingDays={workingDays} onValue={(v) => setValue(d.key, v)} onWeeks={(w) => setWeeks(d.key, w)} />)}
          </ul>
        </section>

        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur md:hidden">
          <span className="text-[13px] text-muted-foreground">{chosen.size} {chosen.size === 1 ? "person" : "people"} · {filled.length} targets</span>
          <button type="button" onClick={submit} disabled={saving} className={headerPrimaryClass}>{saving && <Loader2 className="size-4 animate-spin" />}Set targets</button>
        </div>
      </div>
    </>
  );
}

function MetricInput({ d, entry, workingDays, onValue, onWeeks }: { d: MetricDef; entry?: Entry; workingDays: number; onValue: (v: string) => void; onWeeks: (w: string[] | null) => void }) {
  const monthly = Number(entry?.value) || 0;
  const unit = d.value_type;
  const base = Math.floor(monthly / 4);
  const split = [base, base, base, monthly - base * 3];
  const weeks = entry?.weeks;
  const weeksTotal = weeks?.reduce((s, w) => s + (Number(w) || 0), 0) ?? 0;
  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-medium">{d.label}</span>
            <SourceChip m={{ tracking: d.tracking_type, source: d.source }} />
          </div>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{d.source}</p>
        </div>
        <div className="flex items-center gap-3">
          {monthly > 0 && (
            <span className="hidden text-right text-[11.5px] leading-tight text-muted-foreground tabular-nums sm:block">
              ≈ {amount(unit, base)} a week<br />{amount(unit, Math.ceil(monthly / workingDays))} a working day
            </span>
          )}
          <Input type="number" min={0} inputMode="numeric" value={entry?.value ?? ""} onChange={(e) => onValue(e.target.value)} placeholder="—"
            aria-label={`${d.label} for the month`} className="h-9 w-32 text-right text-[14px] tabular-nums" />
        </div>
      </div>
      {monthly > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => onWeeks(weeks ? null : split.map(String))} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn("size-3.5 transition-transform", weeks && "rotate-180")} />
            {weeks ? "Use an even split" : "Set each week"}
          </button>
          {weeks && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {weeks.map((w, i) => (
                <label key={i} className="space-y-1">
                  <span className="block text-[11px] text-muted-foreground">Week {i + 1}</span>
                  <Input type="number" min={0} value={w} onChange={(e) => onWeeks(weeks.map((x, j) => (j === i ? e.target.value : x)))} className="h-8 text-right tabular-nums" />
                </label>
              ))}
              {weeksTotal !== monthly && <p className="col-span-4 text-[11.5px] text-[var(--status-warn)]">Weeks add up to {amount(unit, weeksTotal)}, not {amount(unit, monthly)}.</p>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
