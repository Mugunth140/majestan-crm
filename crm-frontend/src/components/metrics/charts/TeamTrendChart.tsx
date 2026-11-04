'use client';
import { useMemo } from 'react';
import { defineChart, lineY, areaY } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { tooltip } from '@tanstack/charts/tooltip';
import { Chart } from '@tanstack/charts/react';

interface TeamTrendChartProps {
  data: any;
  loading?: boolean;
}

export function TeamTrendChart({ data, loading }: TeamTrendChartProps) {
  const rows = useMemo(() => {
    try {
      return (data?.weeks ?? []).map((w: any) => ({ week: w?.week ?? '', achieved: w?.achieved ?? 0 }));
    } catch {
      return [];
    }
  }, [data]);

  const definition = useMemo(() => {
    return defineChart({
      marks: [
        areaY(rows, { x: 'week', y: 'achieved', fill: '#ffc900', fillOpacity: 0.2 }),
        lineY(rows, { x: 'week', y: 'achieved', stroke: '#238776', strokeWidth: 2, points: true }),
      ],
      scales: {
        x: { scale: () => scalePoint<string>().padding(0.2) },
        y: { scale: scaleLinear, nice: true, grid: true },
      },
      tooltip,
    });
  }, [rows]);

  if (loading) return <div className="h-64 motion-safe:animate-pulse"><div className="h-full w-full bg-muted rounded-xl" /></div>;
  if (!rows.length) return <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">No team trend for this period</div>;
  return (
    <div className="min-w-0">
      <Chart definition={definition} height={240} ariaLabel="Team weekly achievement trend" />
    </div>
  );
}
