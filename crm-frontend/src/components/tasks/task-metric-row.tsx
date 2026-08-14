"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PenLine } from "lucide-react";

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
  onLogManual?: () => void;
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

  const barColor =
    month_completion_pct >= 100
      ? "bg-emerald-500"
      : month_completion_pct >= 60
      ? "bg-[#0052FF]"
      : month_completion_pct >= 30
      ? "bg-amber-500"
      : "bg-red-500";

  const pctColor =
    month_completion_pct >= 100
      ? "text-emerald-600"
      : month_completion_pct >= 60
      ? "text-[#0052FF]"
      : month_completion_pct >= 30
      ? "text-amber-600"
      : "text-red-500";

  return (
    <div className="flex flex-col gap-2.5 py-4 border-b border-border/50 last:border-0">
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <span className="text-[13.5px] font-semibold text-foreground truncate">{metric_label}</span>
          {tracking_type === "auto" && (
            <Badge className="bg-blue-50 text-blue-600 border-blue-200/60 text-[10px] font-semibold dark:bg-blue-900/20 dark:border-blue-700/30">
              auto
            </Badge>
          )}
          {metric_value_type === "amount" && (
            <Badge className="bg-purple-50 text-purple-600 border-purple-200/60 text-[10px] font-semibold dark:bg-purple-900/20 dark:border-purple-700/30">
              ₹ amount
            </Badge>
          )}
          {overdue_amount > 0 && (
            <Badge className="bg-red-50 text-red-600 border-red-200/60 text-[10px] font-semibold dark:bg-red-900/20 dark:border-red-700/30">
              +{fmt(overdue_amount)} overdue
            </Badge>
          )}
          {carry_forward_amount > 0 && (
            <Badge className="bg-amber-50 text-amber-600 border-amber-200/60 text-[10px] font-semibold dark:bg-amber-900/20 dark:border-amber-700/30">
              +{fmt(carry_forward_amount)} carried fwd
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground font-medium">
            {fmt(total_achieved)}&nbsp;/&nbsp;{fmt(monthly_target)}
          </span>
          {tracking_type === "manual" && onLogManual && (
            <Button
              size="sm"
              variant="outline"
              onClick={onLogManual}
              className="h-7 px-2.5 rounded-lg border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10 text-xs font-semibold"
            >
              <PenLine className="w-3 h-3 mr-1" />
              Log
            </Button>
          )}
        </div>
      </div>

      {/* Month progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${Math.min(100, month_completion_pct)}%` }}
          />
        </div>
        <span className={cn("text-[11px] font-bold w-8 text-right tabular-nums", pctColor)}>
          {month_completion_pct}%
        </span>
      </div>

      {/* Week mini stats */}
      <div className="text-[11px] text-muted-foreground">
        This week:{" "}
        <span className="font-semibold text-foreground">{fmt(current_week_achieved)}</span>
        {" / "}
        <span className={overdue_amount > 0 ? "text-red-600 font-semibold" : ""}>
          {fmt(effective_week_target)}
        </span>
        {overdue_amount > 0 && (
          <span className="text-muted-foreground/70">
            {" "}({fmt(current_week_target)} + {fmt(overdue_amount)} overdue)
          </span>
        )}
      </div>
    </div>
  );
}
