'use client';
import { useMemo } from 'react';
import { defineChart, barY } from '@tanstack/charts';
import { scaleBand } from '@tanstack/charts/scales/band';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { Chart } from '@tanstack/charts/react';

interface DeptPerformanceChartProps {
  data: any;
  loading?: boolean;
}

export function DeptPerformanceChart({ data, loading }: DeptPerformanceChartProps) {
  const rows = useMemo(() => {
    try {
      const depts: any[] = data?.departments ?? [];
      return depts.flatMap(d => ([
        { dept: d?.name ?? '—', series: 'Target', value: d?.target ?? 0 },
        { dept: d?.name ?? '—', series: 'Achieved', value: d?.achieved ?? 0 },
      ]));
    } catch {
      return [];
    }
  }, [data]);

  const definition = useMemo(() => {
    return defineChart({
      marks: [
        barY(rows, { x: 'dept', y: 'value', color: 'series', fillOpacity: 1 }),
      ],
      scales: {
        x: { scale: () => scaleBand().padding(0.2) },
        y: { scale: scaleLinear, nice: true, grid: true },
      },
      tooltip,
    });
  }, [rows]);

  if (loading) return <div className="rounded-2xl border bg-card p-5 h-64 animate-pulse"><div className="h-full w-full bg-muted rounded-xl" /></div>;
  if (!rows.length) return <div className="rounded-2xl border bg-card p-5 h-64 flex items-center justify-center text-sm text-muted-foreground">No data</div>;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-4 text-xs px-2 pb-2">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]" /> Target</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#27427f]" /> Achieved</span>
      </div>
      <Chart definition={definition} height={240} ariaLabel="Department target vs achieved" />
    </div>
  );
}
