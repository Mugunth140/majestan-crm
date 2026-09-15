'use client';
const COLORS = ['#27427f', '#3a5aad', '#5b7dc4', '#ffc900', '#94a3b8', '#10b981', '#f59e0b'];

interface LeadSourceDonutProps {
  data: any;
  loading?: boolean;
}

export function LeadSourceDonut({ data, loading }: LeadSourceDonutProps) {
  if (loading) return <div className="rounded-2xl border bg-card p-5 flex items-center justify-center h-64 animate-pulse"><div className="w-36 h-36 rounded-full bg-muted" /></div>;
  const slices: { label: string; count: number }[] = data?.slices ?? [];
  if (!slices.length) return <div className="rounded-2xl border bg-card p-5 h-64 flex items-center justify-center text-sm text-muted-foreground">No data</div>;
  const total = slices.reduce((a, s) => a + (s.count ?? 0), 0) || 1;
  let acc = 0;
  const segs = slices.map((s, i) => {
    const start = (acc / total) * 360;
    acc += s.count ?? 0;
    const end = (acc / total) * 360;
    return { ...s, start, end, color: COLORS[i % COLORS.length] };
  });
  const gradient = `conic-gradient(${segs.map(s => `${s.color} ${s.start}deg ${s.end}deg`).join(', ')})`;
  return (
    <div className="rounded-2xl border bg-card p-5 flex items-center gap-5">
      <div className="relative w-36 h-36 shrink-0 rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-5 rounded-full bg-card flex items-center justify-center">
          <span className="text-lg font-bold tabular-nums">{total.toLocaleString('en-IN')}</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-xs flex-1">
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
