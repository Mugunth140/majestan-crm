'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import { MetricCard } from './MetricCard';
import { DashboardPanel, DashboardSection } from './DashboardPanels';
import { TeamProgressChart } from './charts/TeamProgressChart';
import { TeamTrendChart } from './charts/TeamTrendChart';
import { TeamLeadDonut } from './charts/TeamLeadDonut';

const CHART_TYPES = ['team_progress', 'team_trend', 'team_leads'] as const;

type ChartType = (typeof CHART_TYPES)[number];

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const n = (v: any): string | number => (v ?? '--') as string | number;

export function TeamLeadDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [charts, setCharts] = useState<Record<string, any>>({});
  const [loadingCharts, setLoadingCharts] = useState<Record<string, boolean>>({});

  // KPI cards are all-time live totals (no date filter). Charts use the current month range.
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await apiFetch(`/api/v1/metrics/summary`);
      if (res.ok) {
        const json = await res.json();
        setSummary(json?.data ?? json ?? null);
      } else {
        setSummary(null);
      }
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchChart = useCallback(async (type: ChartType, f: string, t: string) => {
    setLoadingCharts((p) => ({ ...p, [type]: true }));
    try {
      const res = await apiFetch(`/api/v1/metrics/charts?type=${type}&from=${f}&to=${t}`);
      if (res.ok) {
        const json = await res.json();
        setCharts((p) => ({ ...p, [type]: json?.data ?? json ?? null }));
      } else {
        setCharts((p) => ({ ...p, [type]: null }));
      }
    } catch {
      setCharts((p) => ({ ...p, [type]: null }));
    } finally {
      setLoadingCharts((p) => ({ ...p, [type]: false }));
    }
  }, []);

  const fetchAll = useCallback(
    () => {
      fetchSummary();
      const f = monthStart();
      const t = today();
      CHART_TYPES.forEach((ct) => fetchChart(ct, f, t));
    },
    [fetchSummary, fetchChart]
  );

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tlm = summary?.teamLeadMetrics ?? {};
  const best = tlm.bestPerformer as { name?: string; pct?: number } | undefined;
  const needsAttention = tlm.needsAttention as { name?: string; pct?: number } | undefined;

  return (
    <div className="min-w-0 space-y-6">
      <DashboardSection title="Team KPIs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard label="Active Staff" value={n(tlm.activeStaffInDept)} loading={loadingSummary} />
          <MetricCard label="Leads Assigned" value={n(tlm.leadsAssigned)} loading={loadingSummary} />
          <MetricCard label="Follow-Ups (week)" value={n(tlm.followUpsThisWeek)} loading={loadingSummary} />
          <MetricCard label="Calls Made" value={n(tlm.callsMade)} loading={loadingSummary} />
          <MetricCard label="Site Visits Done" value={n(tlm.svDone)} loading={loadingSummary} />
          <MetricCard label="Conversions" value={n(tlm.conversions)} loading={loadingSummary} />
          <MetricCard label="Task Completion %" value={tlm.taskCompletionPct != null ? `${tlm.taskCompletionPct}%` : '--'} loading={loadingSummary} />
          <MetricCard label="RNR ≥3" value={n(tlm.rnrHighCount)} loading={loadingSummary} />
          {best ? (
            <MetricCard label="Best Performer" value={`${best.name ?? '--'} (${best.pct ?? '--'}%)`} loading={loadingSummary} />
          ) : null}
          {needsAttention ? (
            <MetricCard label="Needs Attention" value={`${needsAttention.name ?? '--'} (${needsAttention.pct ?? '--'}%)`} loading={loadingSummary} />
          ) : null}
          <MetricCard label="Weekly Progress" value={tlm.weeklyAchieved != null || tlm.weeklyTarget != null ? `${n(tlm.weeklyAchieved)} / ${n(tlm.weeklyTarget)}` : '--'} loading={loadingSummary} />
          <MetricCard label="Monthly Progress" value={tlm.monthlyAchieved != null || tlm.monthlyTarget != null ? `${n(tlm.monthlyAchieved)} / ${n(tlm.monthlyTarget)}` : '--'} loading={loadingSummary} />
        </div>
      </DashboardSection>

      <DashboardSection title="Team activity" context="Month to date">
        <div className="grid gap-3 lg:grid-cols-2">
          <DashboardPanel title="Team trend" className="lg:col-span-2">
            <TeamTrendChart data={charts.team_trend} loading={loadingCharts.team_trend} />
          </DashboardPanel>
          <DashboardPanel title="Team progress">
            <TeamProgressChart data={charts.team_progress} loading={loadingCharts.team_progress} />
          </DashboardPanel>
          <DashboardPanel title="Team leads">
            <TeamLeadDonut data={charts.team_leads} loading={loadingCharts.team_leads} />
          </DashboardPanel>
        </div>
      </DashboardSection>
    </div>
  );
}
