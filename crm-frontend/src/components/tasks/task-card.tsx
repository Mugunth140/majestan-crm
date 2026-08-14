"use client";
import { useRouter } from "next/navigation";
import { ChevronRight, User, Building2, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  const countMetrics = metrics.filter((m) => m.metric_value_type === "count");
  const overallPct =
    countMetrics.length > 0
      ? Math.round(
          countMetrics.reduce((sum, m) => sum + m.month_completion_pct, 0) / countMetrics.length
        )
      : 0;

  const pctColor =
    overallPct >= 100
      ? "text-emerald-600"
      : overallPct >= 60
      ? "text-[#0052FF]"
      : overallPct >= 30
      ? "text-amber-600"
      : "text-red-500";

  const barColor =
    overallPct >= 100
      ? "bg-emerald-500"
      : overallPct >= 60
      ? "bg-[#0052FF]"
      : overallPct >= 30
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <button
      onClick={() => router.push(`/tasks/${id}`)}
      className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 active:scale-[0.99] transition-all hover:shadow-md text-left group"
    >
      <div className="flex-1 min-w-0">
        {/* Title + badges */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="font-semibold text-[14px] text-foreground truncate">{title}</span>
          {status === "archived" && (
            <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-border/60 text-[10px]">
              Archived
            </Badge>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3 flex-wrap">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {staff_name}
          </span>
          <span className="flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {dept_name}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {month}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", barColor)}
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <span className={cn("text-xs font-bold shrink-0 tabular-nums", pctColor)}>
            {overallPct}%
          </span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
    </button>
  );
}
