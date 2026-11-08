"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { TargetBoard } from "./board";
import { TaskView } from "./task-view";
import { TASKS_API, useLive } from "./use-tasks";
import type { Board, TaskDetail, TaskRow } from "./types";

/** The signed-in user's id and role, as the Tasks pages need them. */
export function readMe(): { id: number | null; role: string } {
  try {
    const u = JSON.parse(localStorage.getItem("crm_user") ?? "null");
    return { id: u?.id ? Number(u.id) : null, role: u?.role?.name ?? u?.role ?? "" };
  } catch {
    return { id: null, role: "" };
  }
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Managers and team leads get the board; staff go straight to their own targets. */
export function TargetsPage() {
  const [me] = useState(readMe);
  return me.role === "Staff" ? <MyTargets /> : <BoardPage meId={me.id} />;
}

function BoardPage({ meId }: { meId: number | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("month");
  const month = raw && MONTH.test(raw) ? raw : "";
  const live = useLive<Board>(`${TASKS_API}/board${month ? `?month=${month}` : ""}`);
  const setMonth = useCallback((m: string) => {
    const next = new URLSearchParams(params.toString());
    if (live.data && m === live.data.current) next.delete("month"); else next.set("month", m);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, pathname, router, live.data]);

  if (!live.data) return live.error ? <Failed message={live.error} retry={live.reload} /> : <BoardSkeleton />;
  return <TargetBoard board={live.data} live={live} month={live.data.month} setMonth={setMonth} meId={meId} />;
}

function MyTargets() {
  const mine = useLive<TaskRow[]>(`${TASKS_API}/my`, { poll: false });
  const first = mine.data?.[0];
  if (!mine.data) return mine.error ? <Failed message={mine.error} retry={mine.reload} /> : <BoardSkeleton />;
  if (!first) {
    return (
      <div className="px-4 pt-10 lg:px-0">
        <EmptyState kind="tasks" title="No targets for this month yet" description="Once your team lead sets them, your calls, follow-ups and status changes will count toward them here automatically." />
      </div>
    );
  }
  return <TaskPage id={first.id} personal />;
}

/** One person's targets, kept live. */
export function TaskPage({ id, personal }: { id: number; personal?: boolean }) {
  const live = useLive<TaskDetail>(`${TASKS_API}/${id}`);
  const [me] = useState(readMe);
  if (!live.data) return live.error ? <Failed message={live.error} retry={live.reload} /> : <BoardSkeleton />;
  return <TaskView task={live.data} live={live} personal={personal ?? live.data.person.id === me.id} />;
}

function Failed({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-6 text-center">
      <p className="text-[14px] font-medium">Targets could not load</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{message}</p>
      <button type="button" onClick={retry} className="mt-4 h-8 rounded-md bg-foreground px-3 text-[13px] font-medium text-background">Try again</button>
    </div>
  );
}

export function BoardSkeleton() {
  // Shown only after a beat, so fast loads don't flash.
  const [show, setShow] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    timer.current = window.setTimeout(() => setShow(true), 150);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, []);
  if (!show) return null;
  return (
    <div aria-hidden className="mx-auto w-full max-w-screen-2xl space-y-5 px-4 pt-4 lg:px-0 lg:pt-0">
      <div className="h-4 w-72 animate-pulse rounded bg-muted/70" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[112px] animate-pulse rounded-xl border bg-muted/40" />)}</div>
      <div className="h-8 w-96 max-w-full animate-pulse rounded-md bg-muted/60" />
      <div className="space-y-2 rounded-xl border p-4">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-11 animate-pulse rounded-md bg-muted/50" />)}</div>
    </div>
  );
}
