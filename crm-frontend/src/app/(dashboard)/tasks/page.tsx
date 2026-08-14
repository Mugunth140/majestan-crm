"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target, Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { MobileHeader } from "@/components/layout/mobile-header";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskMetricRow } from "@/components/tasks/task-metric-row";
import { TaskLogModal } from "@/components/tasks/task-log-modal";
import { cn } from "@/lib/utils";

export default function TasksPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logModal, setLogModal] = useState<{ open: boolean; templateId: number; metricKey: string; metricLabel: string } | null>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem("crm_user");
      if (u) setUser(JSON.parse(u));
    } catch {}
  }, []);

  const isStaff = user?.role === "Staff";
  const canCreate = user?.role === "Admin" || user?.role === "Manager" || user?.role === "Team Lead";

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      if (isStaff) {
        const res = await apiFetch(`${API}/tasks/my`);
        const d = await res.json();
        setMyTasks(d.data || []);
      } else {
        const res = await apiFetch(`${API}/tasks`);
        const d = await res.json();
        setTasks(d.data || []);
      }
    } catch {
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [user, isStaff]);

  useEffect(() => {
    if (user) loadTasks();
  }, [user, loadTasks]);

  const now = new Date();
  const monthDisplay = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      <MobileHeader title="Tasks" />
      <div className="px-4 md:px-0">

        {/* Desktop header */}
        <div className="hidden md:flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight">
              {isStaff ? "My Tasks" : "Manage Tasks"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{monthDisplay}</p>
          </div>
          {canCreate && (
            <button
              onClick={() => router.push("/tasks/new")}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0052FF] text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform hover:bg-[#0041CC]"
            >
              <Plus className="w-4 h-4" />
              Create Task
            </button>
          )}
        </div>

        {/* Mobile header row */}
        <div className="md:hidden flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">{monthDisplay}</p>
          <div className="flex items-center gap-2">
            <button onClick={loadTasks} className="p-2 rounded-xl bg-muted active:scale-95">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
            {canCreate && (
              <button
                onClick={() => router.push("/tasks/new")}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#0052FF] text-white rounded-xl font-semibold text-sm active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-50 text-red-600 rounded-2xl p-4 text-sm">{error}</div>
        )}

        {/* Staff: My Tasks */}
        {!loading && isStaff && !error && (
          <>
            {myTasks.length === 0 ? (
              <EmptyState message="No tasks assigned to you for this month." />
            ) : (
              <div className="space-y-4">
                {myTasks.map(task => (
                  <div key={task.id} className="bg-card border rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 pt-4 pb-2 border-b border-border/50">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm">{task.title}</h3>
                        <button
                          onClick={() => router.push(`/tasks/${task.id}`)}
                          className="text-[11px] text-[#0052FF] font-semibold"
                        >
                          View Details
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{task.month}</p>
                    </div>
                    <div className="px-4 pb-2">
                      {(task.metrics || []).map((m: any) => (
                        <TaskMetricRow
                          key={m.metric_key}
                          {...m}
                          onLogManual={
                            m.tracking_type === "manual"
                              ? () => setLogModal({ open: true, templateId: task.id, metricKey: m.metric_key, metricLabel: m.metric_label })
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Admin/Manager/TL: Manage Tasks */}
        {!loading && !isStaff && !error && (
          <>
            {tasks.length === 0 ? (
              <EmptyState
                message="No tasks created yet."
                action={canCreate ? { label: "Create First Task", onClick: () => router.push("/tasks/new") } : undefined}
              />
            ) : (
              <div className="space-y-3">
                {tasks.map((task: any) => (
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
                      month_completion_pct: 0, // Will be enriched in detail view
                      monthly_target: Number(t.monthly_target),
                      total_achieved: 0,
                      metric_value_type: t.metric_value_type,
                    }))}
                  />
                ))}
              </div>
            )}
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
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="bg-card border rounded-2xl p-10 shadow-sm flex flex-col items-center justify-center text-center min-h-[40vh] gap-4">
      <div className="w-14 h-14 rounded-full bg-[#0052FF]/10 flex items-center justify-center">
        <Target className="w-7 h-7 text-[#0052FF]" />
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2.5 bg-[#0052FF] text-white rounded-xl font-semibold text-sm active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
