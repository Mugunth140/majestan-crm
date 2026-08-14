"use client";
import { useRouter } from "next/navigation";
import { ChevronRight, User, Building2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  id: number;
  title: string;
  staff_name: string;
  dept_name: string;
  month: string;
  status: string;
  metrics?: Array<{
    metric_label: string;
    month_completion_pct: number;
    monthly_target: number;
    total_achieved: number;
    metric_value_type: string;
  }>;
}

export function TaskCard({ id, title, staff_name, dept_name, month, status, metrics = [] }: TaskCardProps) {
  const router = useRouter();

  // Overall completion: average of all metric pcts (count metrics only)
  const countMetrics = metrics.filter(m => m.metric_value_type === "count");
  const overallPct = countMetrics.length > 0
    ? Math.round(countMetrics.reduce((sum, m) => sum + m.month_completion_pct, 0) / countMetrics.length)
    : 0;

  const pctColor =
    overallPct >= 100 ? "text-emerald-600" :
    overallPct >= 60 ? "text-[#0052FF]" :
    overallPct >= 30 ? "text-amber-600" : "text-red-600";

  const barColor =
    overallPct >= 100 ? "bg-emerald-500" :
    overallPct >= 60 ? "bg-[#0052FF]" :
    overallPct >= 30 ? "bg-amber-500" : "bg-red-500";

  return (
    <button
      onClick={() => router.push(`/tasks/${id}`)}
      className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-transform hover:shadow-md text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-foreground truncate">{title}</span>
          {status === "archived" && (
            <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded font-medium shrink-0">archived</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><User className="w-3 h-3" />{staff_name}</span>
          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{dept_name}</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{month}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${overallPct}%` }} />
          </div>
          <span className={cn("text-xs font-bold shrink-0", pctColor)}>{overallPct}%</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}
