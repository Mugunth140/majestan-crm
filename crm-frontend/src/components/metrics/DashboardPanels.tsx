import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
