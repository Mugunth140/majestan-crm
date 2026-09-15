'use client';
const STATUS_COLORS: Record<string, string> = {
  new: '#27427f',
  contacted: '#3a5aad',
  qualified: '#5b7dc4',
  converted: '#10b981',
  lost: '#94a3b8',
  pending: '#ffc900',
};
const FALLBACK = ['#27427f', '#3a5aad', '#5b7dc4', '#ffc900', '#10b981', '#94a3b8'];

interface TeamLeadDonutProps {
  data: any;
  loading?: boolean;
}

export function TeamLeadDonut({ data, loading }: TeamLeadDonutProps) {
  if (loading) return <div className="rounded-2xl border bg-card p-5 flex items-center justify-center h-64 animate-pulse"><div className="w-36 h-36 rounded-full bg-muted" /></div>;
  const slices: { label: string; count: number }[] = data?.slices ?? [];
  if (!slices.length) return <div className="rounded-2xl border bg-card p-5 h-64 flex items-center justify-center text-sm text-muted-foreground">No data</div>;
  const total = slices.reduce((a, s) => a + (s.count ?? 0), 0) || 1;
  let acc = 0;
  const segs = slices.map((s, i) => {
    const start = (acc / total) * 360;
    acc += s.count ?? 0;
    const end = (acc / total) * 360;
    const color = STATUS_COLORS[(s.label ?? '').toLowerCase()] ?? FALLBACK[i % FALLBACK.length];
    return { ...s, start, end, color };
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
            <span className="truncate flex-1 capitalize">{s.label}</span>
            <span className="tabular-nums text-muted-foreground">{s.count ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
