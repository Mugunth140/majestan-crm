'use client';

interface MonthlyRingsProps {
  rings: any;
  loading?: boolean;
}

export function MonthlyRings({ rings, loading }: MonthlyRingsProps) {
  if (loading) return <div className="rounded-2xl border bg-card p-5 flex gap-4 animate-pulse">{[0, 1, 2].map(i => <div key={i} className="w-24 h-24 rounded-full bg-muted" />)}</div>;
  const list: { key: string; label: string; achieved: number; target: number; pct: number }[] = Array.isArray(rings) ? rings : [];
  if (!list.length) return <div className="rounded-2xl border bg-card p-5 flex items-center justify-center text-sm text-muted-foreground">No data</div>;
  return (
    <div className="rounded-2xl border bg-card p-5 flex flex-wrap gap-5">
      {list.map((r, i) => {
        const pct = Math.min(Math.max(r.pct ?? 0, 0), 100);
        const C = 2 * Math.PI * 40;
        return (
          <div key={r.key ?? i} className="flex flex-col items-center gap-1">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" strokeWidth="10" className="stroke-muted" />
                <circle cx="50" cy="50" r="40" fill="none" stroke={pct >= 100 ? '#ffc900' : '#27427f'} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">{pct.toFixed(0)}%</span>
            </div>
            <span className="text-xs font-medium">{r.label}</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">{r.achieved ?? 0}/{r.target ?? 0}</span>
          </div>
        );
      })}
    </div>
  );
}
