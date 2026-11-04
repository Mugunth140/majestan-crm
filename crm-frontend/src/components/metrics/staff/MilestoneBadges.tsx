'use client';
import { Target, Flame, Star, Trophy, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = [Target, Flame, Star, Trophy];

interface MilestoneBadgesProps {
  milestones: any;
  loading?: boolean;
}

export function MilestoneBadges({ milestones, loading }: MilestoneBadgesProps) {
  if (loading) return <div className="flex gap-3 motion-safe:animate-pulse">{[0, 1, 2, 3].map(i => <div key={i} className="w-16 h-16 rounded-2xl bg-muted" />)}</div>;
  const list: { label: string; threshold: number; reached: boolean }[] = Array.isArray(milestones) ? milestones : [];
  if (!list.length) return <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">No data</div>;
  return (
    <div className="flex flex-wrap gap-3">
      {list.map((m, i) => {
        const Icon = ICONS[i % ICONS.length];
        return (
          <div key={m.label ?? i} title={`${m.label} — ${m.threshold}`} className={cn('flex flex-col items-center gap-1 min-w-24 rounded-md border px-3 py-2', m.reached ? 'bg-[#ffc900]/15 border-[#ffc900]/50' : 'opacity-60 bg-muted/40')}>
            <div className={cn('w-9 h-9 rounded-full flex items-center justify-center', m.reached ? 'bg-[#27427f] text-white' : 'bg-muted text-muted-foreground')}>
              {m.reached ? <Icon className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <span className="text-xs font-medium text-center">{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}
