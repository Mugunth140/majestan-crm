"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Target, Users } from "lucide-react";
import { readUser } from "@/components/layout/nav-items";
import { appModules } from "@/components/mobile/app-modules";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";
import { AdminDashboard } from '@/components/metrics/AdminDashboard';
import { TeamLeadDashboard } from '@/components/metrics/TeamLeadDashboard';
import { StaffDashboard } from '@/components/metrics/StaffDashboard';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem("crm_user");
      if (u) setUser(JSON.parse(u));
    } catch {}
  }, []);

  const isAdmin = user?.role === "Admin" || user?.role === "Super Admin";
  const isStaff = user?.role === "Staff";
  const isManager = user?.role === "Manager";
  const isTeamLead = user?.role === "Team Lead";

  const [tasksDashboard, setTasksDashboard] = useState<any>(null);

  const loadTasksDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const res = await apiFetch(`${API}/tasks/dashboard`);
      const d = await res.json();
      if (d.success) setTasksDashboard(d.data);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (user) loadTasksDashboard();
  }, [user, loadTasksDashboard]);

  const tasksSection = tasksDashboard ? <TasksOverviewSection data={tasksDashboard} isStaff={isStaff} /> : null;

  return (
    <>
      <MobileHeader title="Home" />
      <div className="space-y-6 px-2 pt-5 lg:p-0">
        
      {/* MOBILE ONLY: Master Navigation Hub */}
      <Device 
        desktop={null}
        mobile={
          <div className="space-y-7 pb-6">
            <AppLauncher />
            {tasksSection}
          </div>
        }
      />

      {/* DESKTOP ONLY: Role-based KPI Dashboard */}
      <Device 
        mobile={null}
        desktop={
          <>
            {(isAdmin || isManager) && <AdminDashboard user={user} />}
            {isTeamLead && <TeamLeadDashboard user={user} />}
            {isStaff && <StaffDashboard user={user} />}
            {!isAdmin && !isManager && !isTeamLead && !isStaff && (<AdminDashboard user={user} />)}

            {tasksDashboard && (
              <div className="mt-6">
                <div className="max-w-2xl">
                  {tasksSection}
                </div>
              </div>
            )}
          </>
        }
      />
      </div>
    </>
  );
}

/** Every module the user can open, as a grid of app icons. */
function AppLauncher() {
  const [viewer] = useState(readUser);
  return (
    <nav aria-label="Modules" className="grid grid-cols-4 gap-x-2 gap-y-5 px-2">
      {appModules(viewer).map((m) => (
        <Link key={m.href} href={m.href} className="group flex flex-col items-center gap-1.5 outline-none">
          <span className={cn("flex size-[58px] items-center justify-center rounded-[16px] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.12)] transition-transform duration-150 group-active:scale-90", m.tile)}>
            <m.icon className="size-[26px] text-white" strokeWidth={1.9} />
          </span>
          <span className="w-full truncate text-center text-[12px] font-medium text-foreground/85">{m.name}</span>
        </Link>
      ))}
    </nav>
  );
}

function TasksOverviewSection({ data, isStaff }: { data: any; isStaff: boolean }) {
  if (!data || !data.departments || data.departments.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pl-1">
        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tasks Overview</h3>
        <span className="text-[11px] font-medium text-muted-foreground">{data.month}</span>
      </div>
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        {data.departments.map((dept: any) => {
          const pct = dept.completion_pct || 0;
          const barColor =
            pct >= 100 ? "bg-emerald-500" :
            pct >= 60 ? "bg-[#0052FF]" :
            pct >= 30 ? "bg-amber-500" : "bg-red-500";
          const pctColor =
            pct >= 100 ? "text-emerald-600" :
            pct >= 60 ? "text-[#0052FF]" :
            pct >= 30 ? "text-amber-600" : "text-red-500";

          return (
            <div key={dept.dept_id} className="bg-card border border-border/60 rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-semibold text-foreground truncate mr-2">{dept.dept_name}</span>
                <span className={`text-[12px] font-bold shrink-0 tabular-nums ${pctColor}`}>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {dept.staff?.length || 0} staff
                </span>
                <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  {(dept.total_achieved || 0).toLocaleString("en-IN")} / {(dept.total_target || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
