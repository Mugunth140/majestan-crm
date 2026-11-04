"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, Users } from "lucide-react";
import { useIsClient } from "@/hooks/use-is-client";
import { readUser } from "@/components/layout/nav-items";
import { appModules } from "@/components/mobile/app-modules";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";
import { AdminDashboard } from '@/components/metrics/AdminDashboard';
import { TeamLeadDashboard } from '@/components/metrics/TeamLeadDashboard';
import { StaffDashboard } from '@/components/metrics/StaffDashboard';
import { CoachingDashboard } from '@/components/metrics/CoachingDashboard';
import { DashboardSection } from '@/components/metrics/DashboardPanels';

type TasksDashboard = {
  month?: string;
  departments?: {
    dept_id: number;
    dept_name: string;
    completion_pct?: number;
    staff?: unknown[];
    total_achieved?: number;
    total_target?: number;
  }[];
};

export default function DashboardPage() {
  const ready = useIsClient();

  return (
    <>
      <MobileHeader title="Home" />
      {ready && <DashboardContent />}
    </>
  );
}

function DashboardContent() {
  const [user] = useState(readUser);
  const [tasksDashboard, setTasksDashboard] = useState<TasksDashboard | null>(null);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const api = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

    async function loadTasksDashboard() {
      try {
        const response = await apiFetch(`${api}/tasks/dashboard`, { signal: controller.signal });
        const result = await response.json();
        if (result.success && !controller.signal.aborted) setTasksDashboard(result.data);
      } catch {
        // Tasks are supplementary to the role dashboard and launcher.
      }
    }

    void loadTasksDashboard();
    return () => controller.abort();
  }, [user]);

  const tasksSection = tasksDashboard ? <TasksOverviewSection data={tasksDashboard} /> : null;
  const role = user?.role;

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 pt-4 lg:px-0 lg:pt-0">
      <CoachingDashboard role={role} legacy={
        <>
          {role === "Staff" ? <StaffDashboard /> : role === "Team Lead" ? <TeamLeadDashboard /> : <AdminDashboard />}
          {tasksSection && <div className="mt-6">{tasksSection}</div>}
        </>
      } />
      <Device desktop={null} mobile={<><AppLauncher />{tasksSection}</>} />
    </div>
  );
}

/** Every module the user can open, as a grid of app icons. */
function AppLauncher() {
  const [viewer] = useState(readUser);
  return (
    <DashboardSection title="Modules">
      <nav aria-label="Modules" className="grid grid-cols-4 gap-x-2 gap-y-4 rounded-lg border bg-card px-2 py-4">
        {appModules(viewer).map((m) => (
          <Link key={m.href} href={m.href} aria-label={m.name} className="group flex min-w-0 flex-col items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
            <span className="flex size-10 items-center justify-center rounded-md bg-muted group-active:bg-accent">
              <m.icon aria-hidden className={cn("size-5", m.color)} strokeWidth={1.75} />
            </span>
            <span className="w-full text-center text-xs font-medium text-foreground">{m.href === "/ads" ? "Ads" : m.name}</span>
          </Link>
        ))}
      </nav>
    </DashboardSection>
  );
}

function TasksOverviewSection({ data }: { data: TasksDashboard }) {
  if (!data.departments?.length) return null;

  return (
    <DashboardSection title="Tasks overview" context={data.month}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.departments.map((dept) => {
          const pct = dept.completion_pct ?? 0;

          return (
            <div key={dept.dept_id} className="min-w-0 space-y-3 rounded-lg border bg-card px-4 py-3">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{dept.dept_name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className={cn("h-full rounded-full", pct >= 60 ? "bg-emerald-600 dark:bg-emerald-400" : "bg-amber-600 dark:bg-amber-400")} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users aria-hidden className="size-3.5" />
                  {dept.staff?.length ?? 0} staff
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Target aria-hidden className="size-3.5" />
                  {(dept.total_achieved ?? 0).toLocaleString("en-IN")} / {(dept.total_target ?? 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardSection>
  );
}
