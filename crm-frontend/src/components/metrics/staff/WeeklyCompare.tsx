'use client';

interface WeeklyCompareProps {
  rows: any;
  loading?: boolean;
}

export function WeeklyCompare({ rows, loading }: WeeklyCompareProps) {
  if (loading) return <div className="rounded-2xl border bg-card p-5 space-y-3 animate-pulse">{[0, 1, 2].map(i => <div key={i} className="h-8 bg-muted rounded-xl" />)}</div>;
  const list: { key: string; label: string; thisWeek: number; lastWeek: number }[] = Array.isArray(rows) ? rows : [];
  if (!list.length) return <div className="rounded-2xl border bg-card p-5 flex items-center justify-center text-sm text-muted-foreground">No data</div>;
  const max = Math.max(...list.flatMap(r => [r.thisWeek ?? 0, r.lastWeek ?? 0]), 1);
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#27427f]" /> This week</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ffc900]" /> Last week</span>
      </div>
      {list.map((r, i) => (
        <div key={r.key ?? i}>
          <div className="text-xs font-medium mb-1">{r.label}</div>
          <div className="space-y-1">
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-[#27427f] transition-all" style={{ width: `${((r.thisWeek ?? 0) / max) * 100}%` }} />
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-[#ffc900] transition-all" style={{ width: `${((r.lastWeek ?? 0) / max) * 100}%` }} />
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{r.thisWeek ?? 0} vs {r.lastWeek ?? 0}</div>
        </div>
      ))}
    </div>
  );
}
