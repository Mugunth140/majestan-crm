'use client';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ActivityHeatmapProps {
  data: any;
  loading?: boolean;
}

export function ActivityHeatmap({ data, loading }: ActivityHeatmapProps) {
  if (loading) return <div className="rounded-2xl border bg-card p-5 h-64 animate-pulse"><div className="h-full w-full bg-muted rounded-xl" /></div>;
  const cells: { dow: number; hour: number; count: number }[] = data?.cells ?? [];
  if (!cells.length) return <div className="rounded-2xl border bg-card p-5 h-64 flex items-center justify-center text-sm text-muted-foreground">No data</div>;
  const max = Math.max(...cells.map(c => c.count ?? 0), 1);
  const lookup = new Map(cells.map(c => [`${c.dow}-${c.hour}`, c.count ?? 0]));
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return (
    <div className="rounded-2xl border bg-card p-5 overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid gap-1" style={{ gridTemplateColumns: `44px repeat(24, 1fr)` }}>
          <div />
          {hours.map(h => <div key={h} className="text-[9px] text-center text-muted-foreground">{h % 3 === 0 ? `${h}h` : ''}</div>)}
          {DAYS.map((d, di) => {
            const dow = di + 1;
            return (
              <>
                <div key={`lbl-${dow}`} className="text-[11px] font-medium text-muted-foreground flex items-center">{d}</div>
                {hours.map(h => {
                  const v = lookup.get(`${dow}-${h}`) ?? 0;
                  const alpha = v / max;
                  return (
                    <div
                      key={`${dow}-${h}`}
                      title={`${d} ${h}:00 — ${v}`}
                      className="aspect-square rounded-[4px]"
                      style={{ backgroundColor: v === 0 ? 'var(--muted, #f1f5f9)' : `color-mix(in srgb, #27427f ${Math.round(alpha * 100)}%, #eef2ff)` }}
                    />
                  );
                })}
              </>
            );
          })}
        </div>
      </div>
    </div>
  );
}
