import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DashboardHeading({ title, description, busy, refreshing, onRefresh }: {
  title: string;
  description: ReactNode;
  busy: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        className="inline-flex h-8 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
      >
        <RefreshCw aria-hidden className={cn('size-3.5', refreshing && 'motion-safe:animate-spin')} />
        Refresh
      </button>
    </header>
  );
}

export function DashboardSection({ title, context, children }: {
  title: string;
  context?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {context && <span className="text-xs text-muted-foreground">{context}</span>}
      </div>
      {children}
    </section>
  );
}

export function DashboardPanel({ title, children, className }: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0 rounded-lg border bg-card px-4 py-3', className)}>
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}
