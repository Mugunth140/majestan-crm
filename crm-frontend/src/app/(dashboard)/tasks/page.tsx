"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target, RefreshCw, Search, X } from "lucide-react";
import { motion } from "motion/react";
import { apiFetch } from "@/lib/api-fetch";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskMetricRow } from "@/components/tasks/task-metric-row";
import { TaskLogModal } from "@/components/tasks/task-log-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function TasksPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Active");
  const [searchQuery, setSearchQuery] = useState("");
  const [logModal, setLogModal] = useState<{
    open: boolean;
    templateId: number;
    metricKey: string;
    metricLabel: string;
  } | null>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem("crm_user");
      if (u) setUser(JSON.parse(u));
    } catch {}
  }, []);

  const isStaff = user?.role === "Staff";
  const canCreate =
    user?.role === "Admin" || user?.role === "Manager" || user?.role === "Team Lead";

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isStaff) {
        const res = await apiFetch(`${API_URL}/tasks/my`);
        const d = await res.json();
        setMyTasks(d.data || []);
      } else {
        const res = await apiFetch(`${API_URL}/tasks`);
        const d = await res.json();
        setTasks(d.data || []);
      }
    } catch {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [user, isStaff]);

  useEffect(() => {
    if (user) loadTasks();
  }, [user, loadTasks]);

  const now = new Date();
  const monthDisplay = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  // Filtering for admin/manager/TL view
  const tabs = ["Active", "Archived"];
  const filteredTasks = tasks.filter((t) => {
    const matchesTab = activeTab === "Active" ? t.status !== "archived" : t.status === "archived";
    const matchesSearch =
      !searchQuery.trim() ||
      t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignedTo?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.department?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // ── Desktop view (Admin/Manager/TL) ────────────────────────────────────────
  const desktopManage = (
    <div className="bg-card border rounded-xl overflow-hidden shadow-sm md:flex md:flex-col md:flex-1 md:min-h-0">
      {/* Tabs + search row */}
      <div className="flex items-center justify-between px-6 border-b bg-muted/10 pt-4 gap-4">
        <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide relative">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative pb-4 text-[15px] whitespace-nowrap font-semibold transition-colors duration-200",
                activeTab === tab ? "text-[#0052FF]" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="tasksDesktopUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0052FF] rounded-t-full"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-background">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks, staff, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-muted/30 rounded-xl border-border/60 text-[13.5px]"
          />
        </div>
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchQuery("")}
            className="h-10 w-10 rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {loading ? (
          <TableSkeleton />
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            message={
              searchQuery
                ? "No tasks match your search."
                : activeTab === "Active"
                ? "No active tasks for this month."
                : "No archived tasks."
            }
            action={
              !searchQuery && activeTab === "Active" && canCreate
                ? { label: "Create First Task", onClick: () => router.push("/tasks/new") }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task: any) => (
              <TaskCard
                key={task.id}
                id={task.id}
                title={task.title}
                staff_name={task.assignedTo?.name || "—"}
                dept_name={task.department?.name || "—"}
                month={task.month}
                status={task.status}
                metrics={task.metricTargets?.map((t: any) => ({
                  metric_label: t.metric_label,
                  month_completion_pct: 0,
                  monthly_target: Number(t.monthly_target),
                  total_achieved: 0,
                  metric_value_type: t.metric_value_type,
                }))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Mobile view (Admin/Manager/TL) ─────────────────────────────────────────
  const mobileManage = (
    <div className="px-4 pb-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 h-12 bg-black/5 dark:bg-white/10 border-transparent rounded-2xl text-[16px] focus-visible:ring-1 focus-visible:ring-primary shadow-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 bg-muted-foreground/20 rounded-full"
          >
            <X className="h-3 w-3 text-foreground" />
          </button>
        )}
      </div>

      {/* Pill tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 h-10 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all border active:scale-95",
              activeTab === tab
                ? "bg-foreground text-background border-foreground shadow-sm"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <TableSkeleton />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          message={
            searchQuery
              ? "No tasks match your search."
              : "No tasks found."
          }
          action={
            !searchQuery && activeTab === "Active" && canCreate
              ? { label: "Create First Task", onClick: () => router.push("/tasks/new") }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task: any) => (
            <TaskCard
              key={task.id}
              id={task.id}
              title={task.title}
              staff_name={task.assignedTo?.name || "—"}
              dept_name={task.department?.name || "—"}
              month={task.month}
              status={task.status}
              metrics={task.metricTargets?.map((t: any) => ({
                metric_label: t.metric_label,
                month_completion_pct: 0,
                monthly_target: Number(t.monthly_target),
                total_achieved: 0,
                metric_value_type: t.metric_value_type,
              }))}
            />
          ))}
        </div>
      )}
    </div>
  );

  // ── Staff: My Tasks ─────────────────────────────────────────────────────────
  const staffContent = (
    <div className="px-4 md:px-0 space-y-4">
      {loading ? (
        <TableSkeleton />
      ) : myTasks.length === 0 ? (
        <EmptyState message="No tasks assigned to you for this month." />
      ) : (
        <div className="space-y-4">
          {myTasks.map((task) => (
            <div key={task.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b border-border/50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[14px] text-foreground">{task.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{task.month}</p>
                </div>
                <button
                  onClick={() => router.push(`/tasks/${task.id}`)}
                  className="text-[12px] text-[#0052FF] font-semibold hover:underline shrink-0"
                >
                  View Details
                </button>
              </div>
              <div className="px-5 pb-2">
                {(task.metrics || []).map((m: any) => (
                  <TaskMetricRow
                    key={m.metric_key}
                    {...m}
                    onLogManual={
                      m.tracking_type === "manual"
                        ? () =>
                            setLogModal({
                              open: true,
                              templateId: task.id,
                              metricKey: m.metric_key,
                              metricLabel: m.metric_label,
                            })
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <MobileHeader title={isStaff ? "My Tasks" : "Tasks"} />
      <div className="flex flex-col space-y-4 md:space-y-6 md:h-full">
        {/* Desktop page header */}
        <Device
          mobile={null}
          desktop={
            <div className="flex h-[48px] items-center justify-between pr-[150px]">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight">
                  {isStaff ? "My Tasks" : "Tasks"}
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full border-border/60"
                  onClick={loadTasks}
                  title="Refresh"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </Button>
                {canCreate && (
                  <button
                    onClick={() => router.push("/tasks/new")}
                    className="inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95"
                  >
                    <Plus size={18} />
                    Create Task
                  </button>
                )}
              </div>
            </div>
          }
        />

        {/* Mobile header sub-row (month + refresh) */}
        <Device
          desktop={null}
          mobile={
            <div className="flex items-center justify-between px-4 pb-1">
              <Badge className="bg-[#0052FF]/10 text-[#0052FF] border-[#0052FF]/20 text-[11px] font-semibold">
                {monthDisplay}
              </Badge>
              <button
                onClick={loadTasks}
                className="p-2 rounded-xl bg-muted active:scale-95 transition-transform"
              >
                <RefreshCw className={cn("w-4 h-4 text-muted-foreground", loading && "animate-spin")} />
              </button>
            </div>
          }
        />

        {/* Main content */}
        {isStaff ? (
          staffContent
        ) : (
          <>
            <Device mobile={mobileManage} desktop={desktopManage} />
          </>
        )}
      </div>

      {/* Manual log modal */}
      {logModal?.open && (
        <TaskLogModal
          templateId={logModal.templateId}
          metricKey={logModal.metricKey}
          metricLabel={logModal.metricLabel}
          isOpen={logModal.open}
          onClose={() => setLogModal(null)}
          onSuccess={loadTasks}
        />
      )}
    </>
  );
}

function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-xl bg-muted/10">
      <div className="h-16 w-16 bg-[#0052FF]/10 rounded-full flex items-center justify-center mb-4 border border-[#0052FF]/20">
        <Target className="h-8 w-8 text-[#0052FF]" />
      </div>
      <p className="text-muted-foreground text-sm max-w-xs">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 active:scale-95 transition-transform"
        >
          <Plus size={16} />
          {action.label}
        </button>
      )}
    </div>
  );
}
