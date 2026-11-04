'use client';

interface LeadFunnelChartProps {
  data: any;
  loading?: boolean;
}

export function LeadFunnelChart({ data, loading }: LeadFunnelChartProps) {
  if (loading) return <div className="space-y-3 motion-safe:animate-pulse">{[0, 1, 2, 3].map(i => <div key={i} className="h-6 rounded bg-muted" />)}</div>;
  const stages: { label: string; count: number }[] = data?.stages ?? [];
  if (!stages.length) return <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">No data</div>;
  const max = Math.max(...stages.map(s => s.count ?? 0), 1);
  return (
    <div className="space-y-3">
      {stages.map((s, i) => (
        <div key={s.label ?? i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium">{s.label}</span>
            <span className="tabular-nums text-muted-foreground">{(s.count ?? 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-700 dark:bg-emerald-500"
              style={{ width: `${((s.count ?? 0) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
