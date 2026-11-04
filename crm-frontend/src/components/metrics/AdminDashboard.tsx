'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import { MetricCard } from './MetricCard';
import { DashboardPanel, DashboardSection } from './DashboardPanels';
import { LeadTrendChart } from './charts/LeadTrendChart';
import { LeadFunnelChart } from './charts/LeadFunnelChart';
import { LeadSourceDonut } from './charts/LeadSourceDonut';
import { DeptPerformanceChart } from './charts/DeptPerformanceChart';
import { StaffScatterChart } from './charts/StaffScatterChart';
import { ActivityHeatmap } from './charts/ActivityHeatmap';

const CHART_TYPES = ['trends', 'funnel', 'sources', 'dept_perf', 'scatter', 'heatmap'] as const;

type ChartType = (typeof CHART_TYPES)[number];

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const n = (v: any): string | number => (v ?? '--') as string | number;

export function AdminDashboard() {
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

  const pipe = summary?.pipeline ?? {};
  const inb = summary?.inbound ?? {};
  const ag = summary?.agents ?? {};
  const ast = summary?.assets ?? {};
  const act = summary?.activity ?? {};
  const hr = summary?.hr ?? {};
  const task = summary?.tasks ?? {};


  return (
    <div className="min-w-0 space-y-6">
      <DashboardSection title="Lead pipeline" context="Live totals">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Leads" value={n(pipe.total)} loading={loadingSummary} />
          <MetricCard label="New Leads" value={n(pipe.newLeads)} loading={loadingSummary} />
          <MetricCard label="Follow-Up Leads" value={n(pipe.followUp)} loading={loadingSummary} />
          <MetricCard label="Site Visits Done" value={n(pipe.svDone)} loading={loadingSummary} />
          <MetricCard label="Bookings (Advance)" value={n(pipe.booked)} loading={loadingSummary} />
          <MetricCard label="Converted → Inbound" value={n(pipe.convertedInbound)} loading={loadingSummary} />
          <MetricCard label="Converted → Agent" value={n(pipe.convertedAgent)} loading={loadingSummary} />
          <MetricCard label="Dropped / Unqualified" value={n(pipe.dropped)} loading={loadingSummary} />
        </div>
      </DashboardSection>

      <DashboardSection title="Lead activity" context="Month to date">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <DashboardPanel title="Lead trend">
            <LeadTrendChart data={charts.trends} loading={loadingCharts.trends} />
          </DashboardPanel>
          <DashboardPanel title="Lead sources">
            <LeadSourceDonut data={charts.sources} loading={loadingCharts.sources} />
          </DashboardPanel>
          <DashboardPanel title="Lead funnel" className="xl:col-span-2">
            <LeadFunnelChart data={charts.funnel} loading={loadingCharts.funnel} />
          </DashboardPanel>
        </div>
      </DashboardSection>

      <DashboardSection title="Inbound Supply">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Total Inbounds" value={n(inb.total)} loading={loadingSummary} />
          <MetricCard label="Active Inbounds" value={n(inb.active)} loading={loadingSummary} />
          <MetricCard label="Exclusive Listings" value={n(inb.exclusive)} loading={loadingSummary} />
          <MetricCard label="Prime Locations" value={n(inb.prime)} loading={loadingSummary} />
          <MetricCard label="Avg Quality Score" value={n(inb.avgQuality)} loading={loadingSummary} />
        </div>
      </DashboardSection>

      <DashboardSection title="Agent Network">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard label="Total Agents" value={n(ag.total)} loading={loadingSummary} />
          <MetricCard label="Active Agents" value={n(ag.active)} loading={loadingSummary} />
          <MetricCard label="Commission-Accepted" value={n(ag.commissionAccepted)} loading={loadingSummary} />
          <MetricCard label="New Agents (month)" value={n(ag.newInRange)} loading={loadingSummary} />
        </div>
      </DashboardSection>

      <DashboardSection title="Asset Inventory">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="Total Assets" value={n(ast.total)} loading={loadingSummary} />
          <MetricCard label="Approved Assets" value={n(ast.approved)} loading={loadingSummary} />
          <MetricCard label="Avg Asset Score" value={n(ast.avgQuality)} loading={loadingSummary} />
        </div>
      </DashboardSection>

      <DashboardSection title="Staff & Activity">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Active Staff" value={n(act.activeStaff)} loading={loadingSummary} />
          <MetricCard label="Follow-Ups Logged" value={n(act.followUps)} loading={loadingSummary} />
          <MetricCard label="Calls Made" value={n(act.calls)} loading={loadingSummary} />
          <MetricCard label="WhatsApp Messages" value={n(act.whatsapp)} loading={loadingSummary} />
          <MetricCard label="Routing Events" value={n(act.routingEvents)} loading={loadingSummary} />
        </div>
      </DashboardSection>

      <DashboardSection title="Staff activity charts" context="Month to date">
        <div className="grid gap-3 2xl:grid-cols-2">
          <DashboardPanel title="Staff performance">
            <StaffScatterChart data={charts.scatter} loading={loadingCharts.scatter} />
          </DashboardPanel>
          <DashboardPanel title="Activity heatmap">
            <ActivityHeatmap data={charts.heatmap} loading={loadingCharts.heatmap} />
          </DashboardPanel>
        </div>
      </DashboardSection>

      <DashboardSection title="HR Pipeline">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="Candidates" value={n(hr.total)} loading={loadingSummary} />
          <MetricCard label="Interviews Scheduled" value={n(hr.interviewsScheduled)} loading={loadingSummary} />
          <MetricCard label="Hires Made" value={n(hr.hired)} loading={loadingSummary} />
        </div>
      </DashboardSection>

      <DashboardSection title="Task Completion">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="Active Templates" value={n(task.activeTemplates)} loading={loadingSummary} />
          <MetricCard label="Org Completion %" value={n(task.completionPct)} loading={loadingSummary} />
          <MetricCard label="Manual Logs" value={n(task.manualLogs)} loading={loadingSummary} />
        </div>
      </DashboardSection>

      <DashboardSection title="Department performance" context="Month to date">
        <div className="min-w-0 rounded-lg border bg-card px-4 py-3">
          <DeptPerformanceChart data={charts.dept_perf} loading={loadingCharts.dept_perf} />
        </div>
      </DashboardSection>
    </div>
  );
}
