"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Loader2, User, Building2, Calendar,
  Trash2, Upload, FileText, X, AlertTriangle,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { MobileHeader } from "@/components/layout/mobile-header";
import { TaskMetricRow } from "@/components/tasks/task-metric-row";
import { TaskLogModal } from "@/components/tasks/task-log-modal";
import { cn } from "@/lib/utils";

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const API = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

  const [user, setUser] = useState<any>(null);
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [logModal, setLogModal] = useState<{ metricKey: string; metricLabel: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  useEffect(() => {
    try {
      const u = localStorage.getItem("crm_user");
      if (u) setUser(JSON.parse(u));
    } catch {}
  }, []);

  const loadTask = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${API}/tasks/${id}/progress`);
      if (!res.ok) throw new Error("Failed to load task");
      const d = await res.json();
      const t = d.data;
      setTask(t);
      setSelectedWeek(t.current_week || 1);
    } catch {
      setError("Failed to load task details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTask(); }, [loadTask]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiFetch(`${API}/tasks/${id}`, { method: "DELETE" });
      router.replace("/tasks");
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`${API}/tasks/${id}/receipts`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      await loadTask();
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setUploadingReceipt(false);
      e.target.value = "";
    }
  };

  const handleDeleteReceipt = async (rid: number) => {
    try {
      await apiFetch(`${API}/tasks/${id}/receipts/${rid}`, { method: "DELETE" });
      await loadTask();
    } catch {}
  };

  const isAdmin = user?.role === "Admin";
  const isCollection = task?.department?.name?.toLowerCase().includes("collection");

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (error || !task) return (
    <div className="px-4 md:px-0">
      <div className="bg-red-50 text-red-600 rounded-2xl p-6 text-sm">{error || "Task not found"}</div>
    </div>
  );

  const weekMetrics = (task.metrics || []).map((m: any) => {
    const weekAchieved = m.weekly_progress?.[selectedWeek] || 0;
    const weekTarget = m.week_targets?.[selectedWeek] || 0;
    // Compute overdue only for past weeks relative to current
    const overdueForWeek = selectedWeek === task.current_week ? m.overdue_amount : 0;
    const effectiveTarget = weekTarget + overdueForWeek;
    const weekPct = effectiveTarget > 0 ? Math.min(100, Math.round((weekAchieved / effectiveTarget) * 100)) : 0;
    return {
      ...m,
      current_week_target: weekTarget,
      current_week_achieved: weekAchieved,
      effective_week_target: effectiveTarget,
      overdue_amount: overdueForWeek,
      // For the row's month_completion_pct we keep the real monthly figure
    };
  });

  // Overall month completion (count metrics only)
  const countMetrics = (task.metrics || []).filter((m: any) => m.metric_value_type === "count");
  const totalMonthTarget = countMetrics.reduce((s: number, m: any) => s + (m.monthly_target || 0), 0);
  const totalMonthAchieved = countMetrics.reduce((s: number, m: any) => s + (m.total_achieved || 0), 0);
  const overallPct = totalMonthTarget > 0 ? Math.min(100, Math.round((totalMonthAchieved / totalMonthTarget) * 100)) : 0;

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      <MobileHeader title="Task Detail" />
      <div className="px-4 md:px-0 space-y-6">

        {/* Back + title */}
        <div className="flex items-start gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl bg-muted active:scale-95 shrink-0 mt-1">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate">{task.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{task.assignedTo?.name || "—"}</span>
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{task.department?.name || "—"}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{task.month}</span>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-xl bg-red-50 text-red-600 active:scale-95 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Overall progress ring card */}
        <div className="bg-card border rounded-2xl p-5 flex items-center gap-5">
          <ProgressRing pct={overallPct} size={72} strokeWidth={7} />
          <div>
            <div className="text-sm font-semibold text-muted-foreground">Monthly Progress</div>
            <div className="text-2xl font-bold mt-0.5">{overallPct}%</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {totalMonthAchieved.toLocaleString("en-IN")} / {totalMonthTarget.toLocaleString("en-IN")} targets met
            </div>
          </div>
        </div>

        {/* Week selector tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {Array.from({ length: task.total_weeks || 4 }, (_, i) => i + 1).map(w => (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              className={cn(
                "shrink-0 px-4 py-2 rounded-xl font-semibold text-sm transition-all",
                selectedWeek === w
                  ? "bg-[#0052FF] text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
                w === task.current_week && selectedWeek !== w && "ring-2 ring-[#0052FF]/30"
              )}
            >
              Week {w}
              {w === task.current_week && <span className="ml-1 text-[9px] opacity-70">now</span>}
            </button>
          ))}
        </div>

        {/* Metric rows for selected week */}
        <div className="bg-card border rounded-2xl px-4 py-2">
          {weekMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No metrics found</p>
          ) : (
            weekMetrics.map((m: any) => (
              <TaskMetricRow
                key={m.metric_key}
                {...m}
                onLogManual={
                  m.tracking_type === "manual"
                    ? () => setLogModal({ metricKey: m.metric_key, metricLabel: m.metric_label })
                    : undefined
                }
              />
            ))
          )}
        </div>

        {/* Collection Receipts */}
        {isCollection && (
          <div className="bg-card border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Collection Receipts</h3>
              <label className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer active:scale-95 transition-transform",
                uploadingReceipt ? "bg-muted text-muted-foreground" : "bg-[#0052FF]/10 text-[#0052FF]"
              )}>
                {uploadingReceipt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadingReceipt ? "Uploading..." : "Upload"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  onChange={handleReceiptUpload}
                  disabled={uploadingReceipt}
                />
              </label>
            </div>
            {(task.receipts || []).length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">No receipts uploaded yet</p>
            ) : (
              <div className="space-y-2">
                {(task.receipts || []).map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#0052FF] truncate flex-1 hover:underline">
                      {r.file_name}
                    </a>
                    <span className="text-[10px] text-muted-foreground shrink-0">{r.upload_date}</span>
                    <button onClick={() => handleDeleteReceipt(r.id)} className="p-1 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 active:scale-95">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Delete confirm */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
            <div className="relative bg-card rounded-2xl border shadow-2xl p-6 max-w-sm w-full z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Delete Task</h3>
                  <p className="text-xs text-muted-foreground">This cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">All targets and progress data for this task will be permanently deleted.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-muted font-semibold text-sm active:scale-95">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Log modal */}
      {logModal && (
        <TaskLogModal
          templateId={id}
          metricKey={logModal.metricKey}
          metricLabel={logModal.metricLabel}
          isOpen={true}
          onClose={() => setLogModal(null)}
          onSuccess={loadTask}
        />
      )}
    </div>
  );
}

// SVG progress ring component
function ProgressRing({ pct, size, strokeWidth }: { pct: number; size: number; strokeWidth: number }) {
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 100 ? "#10b981" : pct >= 60 ? "#0052FF" : pct >= 30 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/40" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}
