"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, History, Loader2, Search } from "lucide-react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ListFrame, SegmentTabs, ToolbarSelect, toolbarButtonClass } from "@/components/layout/list-page";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, Feed } from "@/components/record/feed";
import { AssigneePicker } from "@/components/record/assignee-picker";
import { staffActivityItems, type StaffActivityEntry } from "@/components/activity-logs/staff-activity-feed";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const PAGE = 50;

type Staff = { id: number; name: string; avatar_url: string | null; active: boolean; role: string | null; department: string | null };
type Group = "all" | "activity" | "conversation";
type Period = "today" | "7d" | "30d" | "all";
type Summary = { calls: number; messages: number; followUps: number; changes: number };

const GROUPS = [
  { value: "all" as const, label: "Everything" },
  { value: "activity" as const, label: "Activity", title: "Changes to leads, inbounds, agents and candidates" },
  { value: "conversation" as const, label: "Conversation", title: "Follow-ups, calls and messages" },
];
const PERIODS = [
  { value: "today" as const, label: "Today" },
  { value: "7d" as const, label: "Last 7 days" },
  { value: "30d" as const, label: "Last 30 days" },
  { value: "all" as const, label: "All time" },
];

/** The start of the period, from local midnight. */
function sinceOf(period: Period): string | null {
  if (period === "all") return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "7d") d.setDate(d.getDate() - 6);
  if (period === "30d") d.setDate(d.getDate() - 29);
  return d.toISOString();
}

const hint = (s: Staff) => [s.role, s.department?.replace(/ Department$/, "")].filter(Boolean).join(" · ");

async function getJson(url: string) {
  const res = await apiFetch(url);
  const body = await res.json().catch(() => null);
  if (res.status === 403) throw new Error("forbidden");
  if (!res.ok || !body?.success) throw new Error(body?.message || "Couldn't load activity");
  return body.data;
}

function StaffList({ staff, value, onPick }: { staff: Staff[]; value: number | null; onPick: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? staff.filter((s) => `${s.name} ${hint(s)}`.toLowerCase().includes(q)) : staff;
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r lg:flex">
      <div className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find staff" aria-label="Find staff"
            className="h-8 w-full rounded-md border border-transparent bg-muted/70 pl-8 pr-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground hover:bg-muted focus:border-border focus:bg-background" />
        </div>
      </div>
      <div role="listbox" aria-label="Staff" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {shown.map((s) => (
          <button key={s.id} type="button" role="option" aria-selected={s.id === value} onClick={() => onPick(s.id)}
            className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
              s.id === value ? "bg-foreground/[0.07]" : "hover:bg-muted", !s.active && "opacity-60")}>
            <Avatar name={s.name} src={s.avatar_url} userId={s.id} staff className="h-7 w-7 text-[11px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-foreground">{s.name}</span>
              <span className="block truncate text-[12px] text-muted-foreground">{s.active ? hint(s) || "—" : "Inactive"}</span>
            </span>
          </button>
        ))}
        {!shown.length && <p className="px-2 py-2 text-[13px] text-muted-foreground">No one matches “{query.trim()}”.</p>}
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border bg-card px-3.5 py-2.5">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[20px] font-semibold tabular-nums leading-7 text-foreground">{value == null ? "–" : value.toLocaleString("en-IN")}</p>
    </div>
  );
}

function ActivityLogs() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = Number(params.get("staff")) || null;

  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [group, setGroup] = useState<Group>("all");
  const [period, setPeriod] = useState<Period>("7d");
  // What's on screen, and for which person/group/period it was loaded.
  const [shown, setShown] = useState<{ key: string; entries: StaffActivityEntry[]; next: string | null; summary: Summary | null; error: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    getJson(`${API_URL}/staff-activity/staff`)
      .then(setStaff)
      .catch((e) => { if (e.message === "forbidden") setForbidden(true); else setStaff([]); });
  }, []);

  const pick = useCallback((id: number) => router.replace(`/activity-logs?staff=${id}`, { scroll: false }), [router]);
  const person = staff?.find((s) => s.id === selected) ?? null;

  const query = useCallback((before?: string | null) => {
    const q = new URLSearchParams({ userId: String(selected), limit: String(PAGE) });
    if (group !== "all") q.set("group", group);
    const since = sinceOf(period);
    if (since) q.set("since", since);
    if (before) q.set("before", before);
    return `${API_URL}/staff-activity?${q}`;
  }, [selected, group, period]);

  // A new person, group or period starts the feed over.
  const key = `${selected}:${group}:${period}`;
  const loading = !!selected && shown?.key !== key;
  useEffect(() => {
    if (!selected) return;
    let live = true;
    const since = sinceOf(period);
    Promise.all([
      getJson(query()),
      getJson(`${API_URL}/staff-activity/summary?userId=${selected}${since ? `&since=${encodeURIComponent(since)}` : ""}`),
    ])
      .then(([page, totals]) => { if (live) setShown({ key, entries: page.items, next: page.next, summary: totals, error: null }); })
      .catch((e) => {
        if (!live) return;
        if (e.message === "forbidden") setForbidden(true);
        else setShown({ key, entries: [], next: null, summary: null, error: e.message });
      });
    return () => { live = false; };
  }, [selected, period, query, key]);
  const entries = useMemo(() => shown?.entries ?? [], [shown]);
  const next = shown?.next ?? null;
  const summary = shown?.summary ?? null;
  const error = shown?.error ?? null;

  const loadMore = async () => {
    if (!next) return;
    setLoadingMore(true);
    try {
      const page = await getJson(query(next));
      // The cursor is a timestamp: skip anything already shown at the boundary.
      setShown((prev) => {
        if (!prev || prev.key !== key) return prev;
        const seen = new Set(prev.entries.map((e) => e.id));
        return { ...prev, entries: [...prev.entries, ...page.items.filter((e: StaffActivityEntry) => !seen.has(e.id))], next: page.next };
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load activity");
    } finally {
      setLoadingMore(false);
    }
  };

  const items = useMemo(() => (person ? staffActivityItems(entries, person) : []), [entries, person]);

  if (forbidden) {
    return (
      <>
        <MobileHeader title="Activity Logs" />
        <EmptyState kind="records" className="py-24" title="Admin or manager access required" description="Staff activity is visible to admins and managers only." />
      </>
    );
  }

  const people = (staff ?? []).map((s) => ({ id: s.id, name: s.name, hint: s.active ? hint(s) : "Inactive" }));
  const picker = (
    <AssigneePicker people={people} value={selected} allowClear={false} align="start" loading={!staff} placeholder="Find staff…"
      onPick={async (id) => { if (id) pick(id); }}
      trigger={<button type="button" className={cn(toolbarButtonClass, "lg:hidden")} />}>
      {person ? <Avatar name={person.name} src={person.avatar_url} className="h-5 w-5 text-[9px]" /> : null}
      <span className="max-w-[160px] truncate font-medium">{person?.name ?? "Pick staff"}</span>
      <ChevronDown className="size-3.5 text-muted-foreground" />
    </AssigneePicker>
  );

  return (
    <div className="flex flex-col md:h-full">
      <MobileHeader title="Activity Logs" />
      <ListFrame>
        <div className="flex min-h-0 flex-1">
          {staff ? <StaffList staff={staff} value={selected} onPick={pick} /> : (
            <div className="hidden w-72 shrink-0 items-start justify-center border-r pt-10 lg:flex"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          )}

          <div className="min-w-0 flex-1 overflow-y-auto pb-24 md:pb-10">
            <div className="flex flex-wrap items-center gap-2 px-4 pb-2 pt-3 md:px-5">
              {picker}
              <SegmentTabs tabs={GROUPS} value={group} onChange={setGroup} label="What to show" disabled={!selected} />
              <ToolbarSelect label="Period" value={period} options={PERIODS} onChange={setPeriod} disabled={!selected} closeOnSelect />
            </div>

            {!person ? (
              <EmptyState kind="records" className="py-20" title="Pick a staff member"
                description="See everything they did across the CRM: status changes, edits and assignments, with every follow-up, call and message they logged." />
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 pb-4 pt-3 md:px-5">
                  <Avatar name={person.name} src={person.avatar_url} className="h-11 w-11 text-[15px]" />
                  <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-semibold leading-6 text-foreground">{person.name}</h2>
                    <p className="truncate text-[13px] text-muted-foreground">{person.active ? hint(person) || "—" : "Inactive"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 px-4 pb-5 sm:grid-cols-4 md:px-5">
                  <Stat label="Calls" value={loading ? undefined : summary?.calls} />
                  <Stat label="Messages" value={loading ? undefined : summary?.messages} />
                  <Stat label="Follow-ups" value={loading ? undefined : summary?.followUps} />
                  <Stat label="Record changes" value={loading ? undefined : summary?.changes} />
                </div>

                {loading ? (
                  <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : error ? (
                  <EmptyState kind="records" className="py-16" title="Couldn't load activity" description={error} />
                ) : items.length ? (
                  <>
                    <div className="pt-1 [&_[role=separator]]:sm:px-5 [&_li]:sm:px-5"><Feed items={items} /></div>
                    {next && (
                      <div className="flex justify-center pt-2">
                        <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className={cn(toolbarButtonClass, "disabled:opacity-60")}>
                          {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Show older
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center py-14 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.06] text-muted-foreground"><History className="h-5 w-5" /></span>
                    <p className="mt-3 text-[15px] font-medium text-foreground">Nothing in this period</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">Try a longer period{group !== "all" ? " or show everything" : ""}.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </ListFrame>
    </div>
  );
}

export default function ActivityLogsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
      <ActivityLogs />
    </Suspense>
  );
}
