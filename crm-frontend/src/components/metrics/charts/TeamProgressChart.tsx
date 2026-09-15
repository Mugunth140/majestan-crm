'use client';

interface TeamProgressChartProps {
  data: any;
  loading?: boolean;
}

export function TeamProgressChart({ data, loading }: TeamProgressChartProps) {
  if (loading) return <div className="rounded-2xl border bg-card p-5 space-y-3 animate-pulse">{[0, 1, 2].map(i => <div key={i} className="h-8 bg-muted rounded-xl" />)}</div>;
  const staff: { name: string; pct: number }[] = data?.staff ?? [];
  if (!staff.length) return <div className="rounded-2xl border bg-card p-5 flex items-center justify-center text-sm text-muted-foreground">No data</div>;
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      {staff.map((s, i) => {
        const pct = Math.min(Math.max(s.pct ?? 0, 0), 100);
        return (
          <div key={s.name ?? i}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium truncate">{s.name}</span>
              <span className="tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#ffc900' : '#27427f' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
