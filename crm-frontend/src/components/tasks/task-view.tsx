"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, Pencil, RefreshCw, Trash2, Upload, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch, apiJson } from "@/lib/api-fetch";
import { Avatar } from "@/components/record/feed";
import { PageActions } from "@/components/layout/page-actions";
import { headerButtonClass } from "@/components/layout/list-page";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { confetti } from "@/components/dashboard/progress";
import { amount, dayLabel, istToday, monthLabel } from "./format";
import { ActivityFeed, GoalRing, MetricCard, StatusPill, TodayList, WeekStrip } from "./parts";
import { send, TASKS_API, useAgo, useLive, type Live } from "./use-tasks";
import type { ActivityItem, MetricDef, MetricPace, TaskDetail } from "./types";

/**
 * One person's targets for a month: what is left today, this week and this
 * month, every target with its weekly results, and the feed of what counted.
 * `personal` is the viewer's own page, which leads with today.
 */
export function TaskView({ task, live, personal }: { task: TaskDetail; live: Live<TaskDetail>; personal: boolean }) {
  const router = useRouter();
  const activity = useLive<ActivityItem[]>(`${TASKS_API}/${task.id}/activity`, { poll: false });
  const [logFor, setLogFor] = useState<MetricPace | null>(null);
  const [editing, setEditing] = useState(false);
  const ago = useAgo(live.updatedAt);
  const today = istToday();
  const current = task.month === today.slice(0, 7);
  const labels = useMemo(() => new Map(task.metrics.map((m) => [m.key, m.label])), [task.metrics]);
  const reloadAll = () => { live.reload(); activity.reload(); };

  useCelebrate(task, personal && current);

  // The feed refreshes whenever the numbers do.
  const { reload: reloadActivity } = activity;
  const lastUpdate = useRef(live.updatedAt);
  useEffect(() => {
    if (lastUpdate.current === live.updatedAt) return;
    lastUpdate.current = live.updatedAt;
    reloadActivity();
  }, [live.updatedAt, reloadActivity]);

  const remove = async () => {
    if (!window.confirm(`Delete ${task.person.name}'s targets for ${monthLabel(task.month)}? Hand-logged entries and receipts go with them.`)) return;
    try {
      await send(`/${task.id}`, "DELETE");
      toast.success("Targets deleted");
      router.push(`/tasks?month=${task.month}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const actions = (
    <>
      <button type="button" onClick={reloadAll} disabled={live.refreshing} title={ago ? `Updated ${ago}. Refreshes every minute.` : "Refresh"} aria-label="Refresh"
        className="flex size-8 items-center justify-center rounded-md bg-muted/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60">
        <RefreshCw className={cn("size-4", live.refreshing && "animate-spin")} />
      </button>
      {task.can.edit && <button type="button" onClick={() => setEditing(true)} className={headerButtonClass}><Pencil className="size-4" /> Edit targets</button>}
      {task.can.delete && <button type="button" onClick={remove} className={cn(headerButtonClass, "text-[var(--status-bad)]")}><Trash2 className="size-4" /> Delete</button>}
    </>
  );

  const met = task.overall.today;
  const toGo = task.metrics.filter((m) => m.today.remaining > 0);
  const hasReceipts = task.metrics.some((m) => m.key === "receipts_uploaded");

  return (
    <>
      <PageActions>{actions}</PageActions>
      <div className="mx-auto w-full min-w-0 max-w-screen-2xl space-y-5 px-4 pb-16 pt-4 lg:px-0 lg:pt-0">
        <div className="flex flex-wrap items-center gap-2 md:hidden">{actions}</div>

        {!personal && (
          <header className="flex flex-wrap items-center gap-3">
            <Avatar name={task.person.name} src={task.person.avatar} userId={task.person.id} staff className="size-10 text-[13px]" />
            <div className="min-w-0">
              <h1 className="truncate text-[18px] font-semibold tracking-tight">{task.person.name}</h1>
              <p className="text-[12.5px] text-muted-foreground">{task.department?.replace(/\s+Department$/i, "")} · {monthLabel(task.month)}{task.created_by ? ` · set by ${task.created_by.name}` : ""}</p>
            </div>
            <StatusPill status={task.overall.status} className="ml-auto" />
          </header>
        )}

        {current && (
          <section className="grid gap-5 rounded-xl border bg-card p-4 sm:p-5 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-8">
            <div className="flex items-center gap-4">
              <GoalRing met={met.met} total={met.total} />
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold tracking-tight">
                  {met.total === 0 ? "Nothing due today" : met.met === met.total ? "Today's goals are done" : `${toGo.length} ${toGo.length === 1 ? "goal" : "goals"} left today`}
                </h2>
                <p className="mt-1 max-w-72 text-[12.5px] leading-snug text-muted-foreground">
                  {met.total === 0 ? "Sunday is a day off." : met.met === met.total ? "Anything more today puts you ahead for the week." : toGo[0] ? `Biggest gap: ${toGo[0].label}, ${amount(toGo[0].unit, toGo[0].today.remaining)} to go.` : ""}
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground"><Zap aria-hidden className="size-3 text-[var(--series-1)]" />Counts update by themselves{ago ? ` · ${ago}` : ""}</p>
              </div>
            </div>
            <TodayList metrics={task.metrics} />
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-8">
            <h2 className="text-[15px] font-semibold">Targets for {monthLabel(task.month)}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {task.metrics.map((m) => (
                <div key={m.key} className="flex flex-col gap-2">
                  <MetricCard m={m} onLog={m.tracking === "manual" && task.can.log ? () => setLogFor(m) : undefined} />
                  <WeekStrip m={m} />
                </div>
              ))}
            </div>
            {hasReceipts && <Receipts task={task} onChange={reloadAll} />}
          </div>
          <aside className="lg:col-span-4">
            <div className="rounded-xl border bg-card p-4 sm:p-5 lg:sticky lg:top-4">
              <h2 className="text-[14px] font-semibold">What counted</h2>
              <p className="mb-3 mt-0.5 text-[12.5px] text-muted-foreground">Calls, follow-ups and changes that moved these numbers.</p>
              {activity.loading && !activity.data ? (
                <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted/60" />)}</div>
              ) : activity.error && !activity.data ? (
                <p className="text-[13px] text-muted-foreground">Could not load the activity: {activity.error}</p>
              ) : (
                <ActivityFeed items={activity.data ?? []} labels={labels} today={today} />
              )}
            </div>
          </aside>
        </div>
      </div>

      {logFor && <LogDialog task={task} m={logFor} onClose={() => setLogFor(null)} onSaved={reloadAll} />}
      {editing && <EditDialog task={task} onClose={() => setEditing(false)} onSaved={reloadAll} />}
    </>
  );
}

/** Confetti and a toast when a goal for today is met while the page is open. */
function useCelebrate(task: TaskDetail, enabled: boolean) {
  const seen = useRef<Map<string, boolean> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const now = new Map(task.metrics.filter((m) => m.today.goal > 0).map((m) => [m.key, m.today.remaining === 0]));
    const before = seen.current;
    seen.current = now;
    if (!before) return;
    const newly = task.metrics.filter((m) => now.get(m.key) && before.get(m.key) === false);
    if (!newly.length) return;
    const all = [...now.values()].every(Boolean);
    if (all) {
      confetti();
      toast.success("All of today's goals are done");
    } else {
      toast.success(`Today's ${newly.map((m) => m.label.toLowerCase()).join(" and ")} goal met`);
    }
  }, [task, enabled]);
}

function LogDialog({ task, m, onClose, onSaved }: { task: TaskDetail; m: MetricPace; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    if (!value || !Number.isFinite(n) || n === 0) { toast.error("Enter a number other than zero"); return; }
    setSaving(true);
    try {
      await send(`/${task.id}/log`, "POST", { metric_key: m.key, count_value: n, note: note.trim() || undefined });
      toast.success(`${n > 0 ? "Added" : "Removed"} ${amount(m.unit, Math.abs(n))} ${m.label.toLowerCase()}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log {m.label.toLowerCase()}</DialogTitle>
          <DialogDescription className="text-[13px]">
            {amount(m.unit, m.achieved)} of {amount(m.unit, m.monthly)} so far{m.today.goal ? `, ${amount(m.unit, m.today.remaining)} to go today` : ""}. This counts for today.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[12.5px] font-medium">{m.unit === "amount" ? "Amount (₹)" : "How many"}</span>
            <Input autoFocus type="number" inputMode="decimal" step="any" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 3" className="h-10 text-[15px]" />
            <span className="block text-[11.5px] text-muted-foreground">Use a minus number to correct a mistake.</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12.5px] font-medium">Note <span className="font-normal text-muted-foreground">(optional)</span></span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was it for?" className="h-10" />
          </label>
          <DialogFooter>
            <button type="button" onClick={onClose} className={headerButtonClass}>Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[14px] font-medium text-background disabled:opacity-60">
              {saving && <Loader2 className="size-4 animate-spin" />} Save
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ task, onClose, onSaved }: { task: TaskDetail; onClose: () => void; onSaved: () => void }) {
  const [catalog, setCatalog] = useState<MetricDef[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(task.metrics.map((m) => [m.key, String(m.monthly)])));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    apiJson<{ success: boolean; data: MetricDef[] }>(`${TASKS_API}/metrics/${encodeURIComponent(task.department ?? "")}`, { signal: ctrl.signal })
      .then((r) => setCatalog(r.success ? r.data : []))
      .catch(() => { if (!ctrl.signal.aborted) setCatalog([]); });
    return () => ctrl.abort();
  }, [task.department]);
  const save = async () => {
    setSaving(true);
    try {
      await send(`/${task.id}`, "PATCH", { metrics: (catalog ?? []).map((d) => ({ key: d.key, monthly_target: Number(values[d.key]) || 0 })) });
      toast.success("Targets updated");
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {task.person.name.split(" ")[0]}&apos;s targets</DialogTitle>
          <DialogDescription className="text-[13px]">{monthLabel(task.month)}. Weekly targets split evenly; clear a box to drop that target. What is already counted stays.</DialogDescription>
        </DialogHeader>
        {!catalog ? (
          <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="-mx-1 max-h-[55vh] space-y-1 overflow-y-auto px-1">
            {catalog.map((d) => (
              <label key={d.key} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{d.label}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">{d.tracking_type === "auto" ? d.source : "Logged by hand"}</span>
                </span>
                <Input type="number" min={0} inputMode="numeric" value={values[d.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [d.key]: e.target.value }))} placeholder="—" className="h-8 w-28 text-right tabular-nums" />
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <button type="button" onClick={onClose} className={headerButtonClass}>Cancel</button>
          <button type="button" onClick={save} disabled={saving || !catalog} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[14px] font-medium text-background disabled:opacity-60">
            {saving && <Loader2 className="size-4 animate-spin" />} Save targets
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Receipts({ task, onChange }: { task: TaskDetail; onChange: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      const res = await apiFetch(`${TASKS_API}/${task.id}/receipts`, { method: "POST", body }).catch(() => null);
      if (res?.ok) ok++;
      else toast.error(`Could not upload ${file.name}`);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (ok) { toast.success(`${ok} receipt${ok === 1 ? "" : "s"} uploaded`); onChange(); }
  };
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-semibold">Collection receipts</h2>
          <p className="text-[12.5px] text-muted-foreground">Each upload counts toward the receipts target.</p>
        </div>
        {task.can.log && (
          <>
            <input ref={input} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files)} />
            <button type="button" disabled={busy} onClick={() => input.current?.click()} className={headerButtonClass}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload
            </button>
          </>
        )}
      </div>
      {task.receipts.length ? (
        <ul className="mt-3 divide-y">
          {task.receipts.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-2 text-[13px]">
              <Paperclip aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              <a href={r.file_url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">{r.file_name}</a>
              <span className="shrink-0 text-[12px] text-muted-foreground">{dayLabel(r.upload_date.slice(0, 10))}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-muted-foreground">No receipts yet.</p>
      )}
    </section>
  );
}
