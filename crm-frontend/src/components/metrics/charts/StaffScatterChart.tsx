'use client';
import { useMemo } from 'react';
import { defineChart, dot } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { Chart } from '@tanstack/charts/react';
import { scaleSqrt } from 'd3-scale';

interface StaffScatterChartProps {
  data: any;
  loading?: boolean;
}

export function StaffScatterChart({ data, loading }: StaffScatterChartProps) {
  const points = useMemo(() => {
    try {
      const pts: any[] = data?.points ?? [];
      const maxFU = Math.max(...pts.map(p => p?.followUps ?? 0), 1);
      const rScale = scaleSqrt().domain([0, maxFU]).range([3, 12]);
      return pts.map(p => ({ ...p, r: rScale(p?.followUps ?? 0) }));
    } catch {
      return [];
    }
  }, [data]);

  const definition = useMemo(() => {
    return defineChart({
      marks: [
        dot(points, { x: 'calls', y: 'conversions', r: 'r', fill: '#27427f', fillOpacity: 0.7 }),
      ],
      scales: {
        x: { scale: scaleLinear, nice: true, grid: true, axis: { label: 'Calls' } },
        y: { scale: scaleLinear, nice: true, grid: true, axis: { label: 'Conversions' } },
      },
      tooltip,
    });
  }, [points]);

  if (loading) return <div className="rounded-2xl border bg-card p-5 h-64 animate-pulse"><div className="h-full w-full bg-muted rounded-xl" /></div>;
  if (!points.length) return <div className="rounded-2xl border bg-card p-5 h-64 flex items-center justify-center text-sm text-muted-foreground">No data</div>;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <Chart definition={definition} height={240} ariaLabel="Staff calls vs conversions, bubble size is follow-ups" />
      <p className="text-[11px] text-muted-foreground px-2 pt-1">Bubble size = follow-ups</p>
    </div>
  );
}
