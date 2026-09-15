'use client';
import { cn } from '@/lib/utils';
interface MetricCardProps { label: string; value: string | number; trend?: number; subtitle?: string; loading?: boolean; className?: string; }
export function MetricCard({ label, value, trend, subtitle, loading, className }: MetricCardProps) {
  if (loading) return (<div className={cn('rounded-2xl border bg-card shadow p-5 flex flex-col gap-3 animate-pulse', className)}><div className="h-3 w-24 bg-muted rounded" /><div className="h-7 w-16 bg-muted rounded" /></div>);
  return (<div className={cn('rounded-2xl border bg-card text-card-foreground shadow p-5 flex flex-col justify-between hover:shadow-md transition-shadow', className)}><div className="mb-3"><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span></div><div className="text-2xl font-bold tabular-nums">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</div>{(trend !== undefined || subtitle) && (<div className="mt-1 flex items-center gap-1">{trend !== undefined && (<span className={cn('text-xs font-medium', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>)}{subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}</div>)}</div>);
}
