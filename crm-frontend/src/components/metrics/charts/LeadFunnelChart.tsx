'use client';
const COLORS = ['#27427f', '#3a5aad', '#5b7dc4', '#ffc900'];

interface LeadFunnelChartProps {
  data: any;
  loading?: boolean;
}

export function LeadFunnelChart({ data, loading }: LeadFunnelChartProps) {
  if (loading) return <div className="rounded-2xl border bg-card p-5 space-y-3 animate-pulse">{[0, 1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded-xl" />)}</div>;
  const stages: { label: string; count: number }[] = data?.stages ?? [];
  if (!stages.length) return <div className="rounded-2xl border bg-card p-5 flex items-center justify-center text-sm text-muted-foreground">No data</div>;
  const max = Math.max(...stages.map(s => s.count ?? 0), 1);
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      {stages.map((s, i) => (
        <div key={s.label ?? i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium">{s.label}</span>
            <span className="tabular-nums text-muted-foreground">{(s.count ?? 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="h-9 rounded-xl bg-muted overflow-hidden">
            <div
              className="h-full rounded-xl flex items-center justify-end pr-2 text-xs font-semibold text-white transition-all"
              style={{ width: `${Math.max(((s.count ?? 0) / max) * 100, 4)}%`, backgroundColor: COLORS[i % COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
