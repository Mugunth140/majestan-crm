"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  User,
  Building2,
  Calendar,
  Trash2,
  Upload,
  FileText,
  X,
  AlertTriangle,
} from "lucide-react";
import { motion } from "motion/react";
import { apiFetch } from "@/lib/api-fetch";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";
import { TaskMetricRow } from "@/components/tasks/task-metric-row";
import { TaskLogModal } from "@/components/tasks/task-log-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

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
      const res = await apiFetch(`${API_URL}/tasks/${id}/progress`);
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

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiFetch(`${API_URL}/tasks/${id}`, { method: "DELETE" });
      toast.success("Task deleted successfully");
      router.replace("/tasks");
    } catch {
      toast.error("Failed to delete task");
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
      const res = await apiFetch(`${API_URL}/tasks/${id}/receipts`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      toast.success("Receipt uploaded successfully");
      await loadTask();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingReceipt(false);
      e.target.value = "";
    }
  };

  const handleDeleteReceipt = async (rid: number) => {
    try {
      await apiFetch(`${API_URL}/tasks/${id}/receipts/${rid}`, { method: "DELETE" });
      toast.success("Receipt deleted");
      await loadTask();
    } catch {
      toast.error("Failed to delete receipt");
    }
  };

  const isAdmin = user?.role === "Admin" || user?.role === "Super Admin";
  const isCollection = task?.department?.name?.toLowerCase().includes("collection");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0052FF]" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="px-4 md:px-0">
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-6 text-[15px] shadow-sm">
          {error || "Task not found"}
        </div>
      </div>
    );
  }

  const weekMetrics = (task.metrics || []).map((m: any) => {
    const weekAchieved = m.weekly_progress?.[selectedWeek] || 0;
    const weekTarget = m.week_targets?.[selectedWeek] || 0;
    // Compute overdue only for past weeks relative to current
    const overdueForWeek = selectedWeek === task.current_week ? m.overdue_amount : 0;
    const effectiveTarget = weekTarget + overdueForWeek;
    return {
      ...m,
      current_week_target: weekTarget,
      current_week_achieved: weekAchieved,
      effective_week_target: effectiveTarget,
      overdue_amount: overdueForWeek,
    };
  });

  // Overall month completion (count metrics only)
  const countMetrics = (task.metrics || []).filter((m: any) => m.metric_value_type === "count");
  const totalMonthTarget = countMetrics.reduce((s: number, m: any) => s + (m.monthly_target || 0), 0);
  const totalMonthAchieved = countMetrics.reduce((s: number, m: any) => s + (m.total_achieved || 0), 0);
  const overallPct =
    totalMonthTarget > 0 ? Math.min(100, Math.round((totalMonthAchieved / totalMonthTarget) * 100)) : 0;

  return (
    <>
      <MobileHeader title="Task Detail" showBack />
      <div className="flex flex-col space-y-4 md:space-y-6 md:h-full pb-8">
        {/* Desktop page header */}
        <Device
          mobile={null}
          desktop={
            <div className="flex h-[48px] items-center justify-between pr-[150px]">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="p-2 rounded-full hover:bg-muted active:scale-95 transition-transform"
                  title="Back to Tasks"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-[28px] font-bold tracking-tight truncate flex items-center gap-2">
                    {task.title}
                    {task.status === "archived" && (
                      <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-border/60 text-[10px] ml-2 align-middle">
                        Archived
                      </Badge>
                    )}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="h-10 rounded-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 shadow-sm"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Task
                  </Button>
                )}
              </div>
            </div>
          }
        />

        {/* Mobile top action row (delete) */}
        <Device
          desktop={null}
          mobile={
            <div className="flex items-center justify-between px-4 pb-1">
              <div className="min-w-0 flex-1 flex items-center gap-2">
                <h2 className="text-xl font-bold truncate">{task.title}</h2>
                {task.status === "archived" && (
                  <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-border/60 text-[10px]">
                    Archived
                  </Badge>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-full text-red-600 hover:bg-red-50 active:scale-95 transition-transform shrink-0"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          }
        />

        {/* Content area */}
        <div className="px-4 md:px-0 space-y-6">
          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4 text-[12px] md:text-[13px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-full border border-border/60">
              <User className="w-3.5 h-3.5" />
              {task.assignedTo?.name || "—"}
            </span>
            <span className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-full border border-border/60">
              <Building2 className="w-3.5 h-3.5" />
              {task.department?.name || "—"}
            </span>
            <span className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-full border border-border/60">
              <Calendar className="w-3.5 h-3.5" />
              {task.month}
            </span>
          </div>

          {/* Overall progress ring card */}
          <div className="bg-card border border-border/60 rounded-xl p-5 md:p-6 flex items-center gap-6 shadow-sm">
            <ProgressRing pct={overallPct} size={84} strokeWidth={8} />
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                Monthly Progress
              </div>
              <div className="text-3xl font-bold mt-1 tracking-tight text-foreground">{overallPct}%</div>
              <div className="text-[13px] text-muted-foreground/80 mt-1 font-medium">
                {totalMonthAchieved.toLocaleString("en-IN")} / {totalMonthTarget.toLocaleString("en-IN")} targets met
              </div>
            </div>
          </div>

          {/* Week selector tabs */}
          <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-2 py-2 border-b bg-muted/10">
              {Array.from({ length: task.total_weeks || 4 }, (_, i) => i + 1).map((w) => (
                <button
                  key={w}
                  onClick={() => setSelectedWeek(w)}
                  className={cn(
                    "relative px-5 py-2.5 rounded-lg text-[14px] font-semibold transition-colors duration-200 shrink-0",
                    selectedWeek === w ? "text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {selectedWeek === w && (
                    <motion.div
                      layoutId="taskWeekTabBg"
                      className="absolute inset-0 bg-[#0052FF] rounded-lg shadow-sm"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    Week {w}
                    {w === task.current_week && (
                      <span
                        className={cn(
                          "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded",
                          selectedWeek === w ? "bg-white/20 text-white" : "bg-black/10 dark:bg-white/10 text-muted-foreground"
                        )}
                      >
                        now
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* Metric rows for selected week */}
            <div className="px-5 py-2">
              {weekMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center font-medium">
                  No metrics found for this week
                </p>
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
          </div>

          {/* Collection Receipts */}
          {isCollection && (
            <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/10">
                <h3 className="font-bold text-[15px] text-foreground">Collection Receipts</h3>
                <label
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold cursor-pointer transition-all active:scale-95 border",
                    uploadingReceipt
                      ? "bg-muted text-muted-foreground border-border"
                      : "bg-[#0052FF] text-white border-[#0052FF] shadow-sm hover:bg-[#0040CC]"
                  )}
                >
                  {uploadingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploadingReceipt ? "Uploading..." : "Upload File"}
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
              <div className="p-5">
                {(task.receipts || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-border rounded-xl bg-muted/10">
                    <FileText className="h-8 w-8 text-muted-foreground/50 mb-3" />
                    <p className="text-[13.5px] font-medium text-foreground">No receipts uploaded</p>
                    <p className="text-xs text-muted-foreground mt-1">Upload receipts to track collection targets</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(task.receipts || []).map((r: any) => (
                      <div key={r.id} className="flex items-center gap-3 p-3 bg-muted/30 border border-border/60 rounded-xl group">
                        <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <a
                            href={r.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-semibold text-[#0052FF] truncate block hover:underline"
                            title={r.file_name}
                          >
                            {r.file_name}
                          </a>
                          <span className="text-[11px] text-muted-foreground">{r.upload_date}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteReceipt(r.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all active:scale-95 shrink-0"
                          title="Delete Receipt"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Task
            </DialogTitle>
            <DialogDescription className="text-[14px]">
              Are you sure you want to delete this task? All targets and progress data will be permanently deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="shadow-sm"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {deleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}

// SVG progress ring component
function ProgressRing({ pct, size, strokeWidth }: { pct: number; size: number; strokeWidth: number }) {
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const color =
    pct >= 100
      ? "#10b981"
      : pct >= 60
      ? "#0052FF"
      : pct >= 30
      ? "#f59e0b"
      : "#ef4444";

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/20"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
      />
    </svg>
  );
}
