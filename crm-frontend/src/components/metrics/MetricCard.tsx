import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: number;
  subtitle?: string;
  loading?: boolean;
  className?: string;
}

export function MetricCard({ label, value, trend, subtitle, loading, className }: MetricCardProps) {
  return (
    <div className={cn('min-w-0 rounded-lg border bg-card px-4 py-3', className)} aria-busy={loading}>
      <div className="text-sm text-muted-foreground">{label}</div>
      {loading ? (
        <div aria-hidden className="mt-2 h-6 w-12 rounded bg-muted motion-safe:animate-pulse" />
      ) : (
        <div className="mt-1 break-words text-2xl font-semibold tracking-tight tabular-nums">
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value === '--' ? '—' : value}
        </div>
      )}
      {!loading && (trend !== undefined || subtitle) && (
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          {trend !== undefined && (
            <span className={cn('font-medium', trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
          {subtitle && <span className="text-muted-foreground">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
