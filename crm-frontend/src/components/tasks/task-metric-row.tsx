"use client";
import { cn } from "@/lib/utils";

interface TaskMetricRowProps {
  metric_key: string;
  metric_label: string;
  metric_value_type: "count" | "amount";
  tracking_type: "auto" | "manual";
  monthly_target: number;
  total_achieved: number;
  current_week_target: number;
  current_week_achieved: number;
  effective_week_target: number;
  overdue_amount: number;
  month_completion_pct: number;
  carry_forward_amount?: number;
  onLogManual?: () => void; // only shown for manual metrics
}

export function TaskMetricRow({
  metric_label,
  metric_value_type,
  tracking_type,
  monthly_target,
  total_achieved,
  current_week_target,
  current_week_achieved,
  effective_week_target,
  overdue_amount,
  month_completion_pct,
  carry_forward_amount = 0,
  onLogManual,
}: TaskMetricRowProps) {
  const fmt = (v: number) =>
    metric_value_type === "amount"
      ? `₹${v.toLocaleString("en-IN")}`
      : v.toLocaleString("en-IN");

  const weekPct = effective_week_target > 0
    ? Math.min(100, Math.round((current_week_achieved / effective_week_target) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-2 py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{metric_label}</span>
          {tracking_type === "auto" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium shrink-0 dark:bg-blue-900/20">auto</span>
          )}
          {overdue_amount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-semibold shrink-0 dark:bg-red-900/20">
              +{fmt(overdue_amount)} overdue
            </span>
          )}
          {carry_forward_amount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium shrink-0 dark:bg-amber-900/20">
              +{fmt(carry_forward_amount)} carried fwd
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground">{fmt(total_achieved)} / {fmt(monthly_target)}</span>
          {tracking_type === "manual" && onLogManual && (
            <button
              onClick={onLogManual}
              className="text-[11px] px-2 py-1 rounded-lg bg-[#0052FF]/10 text-[#0052FF] font-semibold active:scale-95 transition-transform hover:bg-[#0052FF]/20"
            >
              Log
            </button>
          )}
        </div>
      </div>

      {/* Month progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              month_completion_pct >= 100 ? "bg-emerald-500" : month_completion_pct >= 60 ? "bg-[#0052FF]" : month_completion_pct >= 30 ? "bg-amber-500" : "bg-red-500"
            )}
            style={{ width: `${month_completion_pct}%` }}
          />
        </div>
        <span className={cn(
          "text-[11px] font-semibold w-8 text-right",
          month_completion_pct >= 100 ? "text-emerald-600" : month_completion_pct >= 60 ? "text-[#0052FF]" : "text-muted-foreground"
        )}>
          {month_completion_pct}%
        </span>
      </div>

      {/* Current week mini stats */}
      <div className="text-[11px] text-muted-foreground">
        This week: <span className="font-semibold text-foreground">{fmt(current_week_achieved)}</span>
        {" / "}
        <span className={overdue_amount > 0 ? "text-red-600 font-semibold" : ""}>{fmt(effective_week_target)}</span>
        {overdue_amount > 0 && (
          <span className="text-muted-foreground"> ({fmt(current_week_target)} + {fmt(overdue_amount)} overdue)</span>
        )}
      </div>
    </div>
  );
}
