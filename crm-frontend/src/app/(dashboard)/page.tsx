"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  User, Building2, Layers, Users, TrendingUp, Route, 
  Inbox, Network, Briefcase, Package, UserPen, Target, 
  Activity, Settings, Database, Contact, Home
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

import { MobileHeader } from "@/components/layout/mobile-header";

export default function DashboardPage() {
  const router = useRouter();
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

  return (
    <>
      <MobileHeader title="Dashboard" />
      <div className="space-y-6 px-2 pt-4 lg:p-0">
        
        {/* Universal Greeting */}
        <div className="flex flex-col gap-1 hidden md:flex">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
            Welcome back, {user?.name?.split(' ')[0] || "Team"} 👋
          </h1>
          <p className="text-muted-foreground text-sm lg:text-base">
            <span className="hidden md:inline">Overview of all CRM activities.</span>
          </p>
        </div>

      {/* MOBILE ONLY: Master Navigation Hub */}
      <div className="md:hidden space-y-6 pb-6">
        <MenuSection title="Core Pipeline">
          <MenuCard icon={Contact} label="Leads" onClick={() => router.push('/leads')} color="text-blue-600" bg="bg-blue-500/10" />
          <MenuCard icon={Route} label="Lead Routing" onClick={() => router.push('/lead-routing')} color="text-indigo-600" bg="bg-indigo-500/10" />
          <MenuCard icon={Inbox} label="Inbound" onClick={() => router.push('/inbound')} color="text-emerald-600" bg="bg-emerald-500/10" />
        </MenuSection>

        <MenuSection title="Inventory & Projects">
          <MenuCard icon={Briefcase} label="Projects" onClick={() => router.push('/projects')} color="text-rose-600" bg="bg-rose-500/10" />
          <MenuCard icon={Home} label="Properties" onClick={() => router.push('/properties')} color="text-teal-600" bg="bg-teal-500/10" />
          <MenuCard icon={Package} label="Asset Inventory" onClick={() => router.push('/asset-inventory')} color="text-amber-600" bg="bg-amber-500/10" />
        </MenuSection>

        <MenuSection title="Network & Team">
          <MenuCard icon={Network} label="Agent Network" onClick={() => router.push('/agent-network')} color="text-cyan-600" bg="bg-cyan-500/10" />
          <MenuCard icon={UserPen} label="HR Panel" onClick={() => router.push('/hr')} color="text-fuchsia-600" bg="bg-fuchsia-500/10" />
          {isAdmin && <MenuCard icon={Users} label="Users" onClick={() => router.push('/users')} color="text-violet-600" bg="bg-violet-500/10" />}
        </MenuSection>

        <MenuSection title="System">
          <MenuCard icon={Target} label="Tasks" onClick={() => router.push('/tasks')} color="text-orange-600" bg="bg-orange-500/10" />
          <MenuCard icon={Settings} label="Settings" onClick={() => router.push('/settings')} color="text-slate-600" bg="bg-slate-500/10" />
          {isAdmin && (
            <>
              <MenuCard icon={Activity} label="Activity Logs" onClick={() => router.push('/activity-logs')} color="text-red-600" bg="bg-red-500/10" />
              <MenuCard icon={Database} label="Master Registry" onClick={() => router.push('/master/sources')} color="text-zinc-600" bg="bg-zinc-500/10" />
            </>
          )}
        </MenuSection>
        {tasksDashboard && (
          <TasksOverviewSection data={tasksDashboard} isStaff={isStaff} />
        )}
      </div>

      {/* DESKTOP ONLY: Analytics Dashboard */}
      <div className="hidden md:grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="tracking-tight text-sm font-medium">Total Leads</h3>
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold mt-2">--</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="tracking-tight text-sm font-medium">Inbounds</h3>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold mt-2">--</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="tracking-tight text-sm font-medium">Active Assets</h3>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold mt-2">--</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="tracking-tight text-sm font-medium">Agents</h3>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold mt-2">--</div>
        </div>
      </div>
      {tasksDashboard && (
        <div className="hidden md:block mt-6">
          <TasksOverviewSection data={tasksDashboard} isStaff={isStaff} />
        </div>
      )}
      </div>
    </>
  );
}

function MenuSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        {children}
      </div>
    </div>
  )
}

function MenuCard({ icon: Icon, label, onClick, color, bg }: any) {
  return (
    <button 
      onClick={onClick} 
      className="bg-card hover:bg-muted/50 border border-border p-4 rounded-[1.25rem] flex flex-col items-start gap-4 transition-colors active:scale-95 shadow-sm"
    >
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", bg)}>
        <Icon className={cn("w-5 h-5", color)} strokeWidth={2.5} />
      </div>
      <span className="font-semibold text-[13px] text-foreground text-left leading-tight">{label}</span>
    </button>
  )
}

function TasksOverviewSection({ data, isStaff }: { data: any; isStaff: boolean }) {
  if (!data || !data.departments || data.departments.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Tasks Overview</h3>
        <span className="text-xs text-muted-foreground">{data.month}</span>
      </div>
      <div className="space-y-2">
        {data.departments.map((dept: any) => {
          const pct = dept.completion_pct || 0;
          const barColor =
            pct >= 100 ? "bg-emerald-500" :
            pct >= 60 ? "bg-[#0052FF]" :
            pct >= 30 ? "bg-amber-500" : "bg-red-500";
          const pctColor =
            pct >= 100 ? "text-emerald-600" :
            pct >= 60 ? "text-[#0052FF]" :
            pct >= 30 ? "text-amber-600" : "text-red-600";

          return (
            <div key={dept.dept_id} className="bg-card border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">{dept.dept_name}</span>
                <span className={`text-xs font-bold ${pctColor}`}>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">{dept.staff?.length || 0} staff</span>
                <span className="text-[10px] text-muted-foreground">
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
