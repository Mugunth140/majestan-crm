'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { MetricCard } from './MetricCard';
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

export function TeamLeadDashboard({ user }: { user: any }) {
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [charts, setCharts] = useState<Record<string, any>>({});
  const [loadingCharts, setLoadingCharts] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiFetch('/api/v1/metrics/cache', { method: 'DELETE' });
    } catch {
      // ignore cache-clear errors, still refetch
    } finally {
      fetchAll();
      setRefreshing(false);
    }
  };

  const tlm = summary?.teamLeadMetrics ?? {};
  const busy = loadingSummary || refreshing;
  const best = tlm.bestPerformer as { name?: string; pct?: number } | undefined;

  return (
    <div className="space-y-8 metrics-stagger">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">Team Dashboard</h2>
          <p className="text-xs text-muted-foreground">
            Welcome{user?.name ? `, ${user.name}` : ''} — department KPIs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={busy}
            className="text-sm border border-border rounded-xl px-3 py-1.5 bg-card hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Team KPIs</h3>
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
          {tlm.needsAttention ? (
            <MetricCard label="Needs Attention" value={n(tlm.needsAttention)} loading={loadingSummary} />
          ) : null}
          <MetricCard label="Weekly Progress" value={tlm.weeklyAchieved != null || tlm.weeklyTarget != null ? `${n(tlm.weeklyAchieved)} / ${n(tlm.weeklyTarget)}` : '--'} loading={loadingSummary} />
          <MetricCard label="Monthly Progress" value={tlm.monthlyAchieved != null || tlm.monthlyTarget != null ? `${n(tlm.monthlyAchieved)} / ${n(tlm.monthlyTarget)}` : '--'} loading={loadingSummary} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Charts</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
            <h4 className="text-sm font-semibold mb-3">Team Trend</h4>
            <TeamTrendChart data={charts.team_trend} loading={loadingCharts.team_trend} />
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h4 className="text-sm font-semibold mb-3">Team Progress</h4>
            <TeamProgressChart data={charts.team_progress} loading={loadingCharts.team_progress} />
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h4 className="text-sm font-semibold mb-3">Team Leads</h4>
            <TeamLeadDonut data={charts.team_leads} loading={loadingCharts.team_leads} />
          </div>
        </div>
      </section>
    </div>
  );
}
