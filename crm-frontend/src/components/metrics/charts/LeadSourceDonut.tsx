'use client';
const COLORS = ['#238776', '#5682b5', '#ac8246', '#8873ad', '#7f8d9e', '#6b9456', '#bb7369'];

interface LeadSourceDonutProps {
  data: any;
  loading?: boolean;
}

export function LeadSourceDonut({ data, loading }: LeadSourceDonutProps) {
  if (loading) return <div className="flex items-center justify-center h-64 motion-safe:animate-pulse"><div className="w-36 h-36 rounded-full bg-muted" /></div>;
  const slices: { label: string; count: number }[] = data?.slices ?? [];
  if (!slices.length) return <div className="h-64 flex min-h-24 items-center justify-center text-sm text-muted-foreground">No data</div>;
  const total = slices.reduce((a, s) => a + (s.count ?? 0), 0);
  let acc = 0;
  const segs = [];
  for (const [i, s] of slices.entries()) {
    const start = (acc / (total || 1)) * 360;
    acc += s.count ?? 0;
    const end = (acc / (total || 1)) * 360;
    segs.push({ ...s, start, end, color: COLORS[i % COLORS.length] });
  }
  const gradient = `conic-gradient(${segs.map(s => `${s.color} ${s.start}deg ${s.end}deg`).join(', ')})`;
  return (
    <div className="flex min-h-60 flex-wrap items-center justify-center gap-4">
      <div className="relative size-32 shrink-0 rounded-full" style={{ background: total ? gradient : "var(--muted)" }}>
        <div className="absolute inset-5 rounded-full bg-card flex items-center justify-center">
          <span className="text-xl font-semibold tabular-nums">{total.toLocaleString('en-IN')}</span>
        </div>
      </div>
      <ul className="min-w-28 flex-1 space-y-2 text-xs">
        {segs.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="truncate flex-1">{s.label}</span>
            <span className="tabular-nums text-muted-foreground">{s.count ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
