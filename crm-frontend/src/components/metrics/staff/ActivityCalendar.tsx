'use client';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface ActivityCalendarProps {
  activeDates: any;
  loading?: boolean;
}

export function ActivityCalendar({ activeDates, loading }: ActivityCalendarProps) {
  const active = useMemo(() => {
    try {
      const arr: string[] = Array.isArray(activeDates) ? activeDates : [];
      return new Set(arr);
    } catch {
      return new Set<string>();
    }
  }, [activeDates]);

  if (loading) return <div className="rounded-2xl border bg-card p-5 h-48 animate-pulse"><div className="h-full w-full bg-muted rounded-xl" /></div>;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const iso = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="text-xs font-semibold mb-3">{now.toLocaleString('en', { month: 'long', year: 'numeric' })}</div>
      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-[10px] text-center text-muted-foreground font-medium">{d}</div>)}
        {cells.map((d, i) => d === null
          ? <div key={`e-${i}`} />
          : (
            <div key={d} title={iso(d)} className={cn('aspect-square rounded-lg flex items-center justify-center text-[11px] tabular-nums', active.has(iso(d)) ? 'bg-[#27427f] text-white font-semibold' : 'bg-muted/50 text-muted-foreground')}>
              {d}
            </div>
          ))}
      </div>
    </div>
  );
}
