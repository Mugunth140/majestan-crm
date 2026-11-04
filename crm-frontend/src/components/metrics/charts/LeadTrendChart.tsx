'use client';
import { useMemo } from 'react';
import { defineChart, lineY, areaY } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { tooltip } from '@tanstack/charts/tooltip';
import { Chart } from '@tanstack/charts/react';

interface LeadTrendChartProps {
  data: any;
  loading?: boolean;
}

export function LeadTrendChart({ data, loading }: LeadTrendChartProps) {
  const rows = useMemo(() => {
    try {
      const dates: string[] = data?.dates ?? [];
      const counts: number[] = data?.counts ?? [];
      return dates.map((d: string, i: number) => ({ date: d, count: counts[i] ?? 0 }));
    } catch {
      return [];
    }
  }, [data]);

  const definition = useMemo(() => {
    return defineChart({
      marks: [
        areaY(rows, { x: 'date', y: 'count', fill: '#238776', fillOpacity: 0.12 }),
        lineY(rows, { x: 'date', y: 'count', stroke: '#238776', strokeWidth: 2, points: true }),
      ],
      scales: {
        x: { scale: () => scalePoint<string>().padding(0.2) },
        y: { scale: scaleLinear, nice: true, grid: true },
      },
      tooltip,
    });
  }, [rows]);

  if (loading) return <div className="h-64 motion-safe:animate-pulse"><div className="h-full w-full bg-muted rounded-xl" /></div>;
  if (!rows.length) return <div className="h-64 flex min-h-24 items-center justify-center text-sm text-muted-foreground">No data</div>;
  return (
    <div className="min-w-0">
      <Chart definition={definition} height={240} ariaLabel="Lead trend over time" />
    </div>
  );
}
