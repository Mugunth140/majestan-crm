'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Users, UserCheck, UserPlus, Phone, MessageCircle, GitBranch,
  Building2, KeyRound, Star, CheckCircle2, ClipboardCheck,
  ListTodo, Target, TrendingUp, CalendarClock, Briefcase, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { MetricCard } from './MetricCard';
import { DateRangePicker } from './DateRangePicker';
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

export function AdminDashboard({ user }: { user: any }) {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [charts, setCharts] = useState<Record<string, any>>({});
  const [loadingCharts, setLoadingCharts] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback(async (f: string, t: string) => {
    setLoadingSummary(true);
    try {
      const res = await apiFetch(`/api/v1/metrics/summary?from=${f}&to=${t}`);
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
    (f: string, t: string) => {
      fetchSummary(f, t);
      CHART_TYPES.forEach((ct) => fetchChart(ct, f, t));
    },
    [fetchSummary, fetchChart]
  );

  useEffect(() => {
    fetchAll(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRangeChange = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    fetchAll(f, t);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiFetch('/api/v1/metrics/cache', { method: 'DELETE' });
    } catch {
      // ignore cache-clear errors, still refetch
    } finally {
      fetchAll(from, to);
      setRefreshing(false);
    }
  };

  const pipe = summary?.pipeline ?? {};
  const inb = summary?.inbound ?? {};
  const ag = summary?.agents ?? {};
  const ast = summary?.assets ?? {};
  const act = summary?.activity ?? {};
  const hr = summary?.hr ?? {};
  const task = summary?.tasks ?? {};

  const busy = loadingSummary || refreshing;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">Command Center</h2>
          <p className="text-xs text-muted-foreground">
            Welcome{user?.name ? `, ${user.name}` : ''} — org-wide KPIs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker from={from} to={to} onChange={handleRangeChange} disabled={busy} />
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
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Lead Pipeline</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard label="Total Leads" value={n(pipe.total)} icon={Users} loading={loadingSummary} />
          <MetricCard label="New Leads" value={n(pipe.newLeads)} icon={UserPlus} loading={loadingSummary} />
          <MetricCard label="Follow-Up Leads" value={n(pipe.followUp)} icon={Phone} loading={loadingSummary} />
          <MetricCard label="Site Visits Done" value={n(pipe.svDone)} icon={CalendarClock} loading={loadingSummary} />
          <MetricCard label="Bookings (Advance)" value={n(pipe.booked)} icon={CheckCircle2} loading={loadingSummary} />
          <MetricCard label="Converted → Inbound" value={n(pipe.convertedInbound)} icon={TrendingUp} loading={loadingSummary} />
          <MetricCard label="Converted → Agent" value={n(pipe.convertedAgent)} icon={Briefcase} loading={loadingSummary} />
          <MetricCard label="Dropped / Unqualified" value={n(pipe.dropped)} icon={Target} loading={loadingSummary} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Inbound Supply</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Total Inbounds" value={n(inb.total)} icon={Building2} loading={loadingSummary} />
          <MetricCard label="Active Inbounds" value={n(inb.active)} icon={CheckCircle2} loading={loadingSummary} />
          <MetricCard label="Exclusive Listings" value={n(inb.exclusive)} icon={Star} loading={loadingSummary} />
          <MetricCard label="Prime Locations" value={n(inb.prime)} icon={Target} loading={loadingSummary} />
          <MetricCard label="Avg Quality Score" value={n(inb.avgQuality)} icon={TrendingUp} loading={loadingSummary} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Agent Network</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard label="Total Agents" value={n(ag.total)} icon={Users} loading={loadingSummary} />
          <MetricCard label="Active Agents" value={n(ag.active)} icon={UserCheck} loading={loadingSummary} />
          <MetricCard label="Commission-Accepted" value={n(ag.commissionAccepted)} icon={CheckCircle2} loading={loadingSummary} />
          <MetricCard label="New Agents (range)" value={n(ag.newInRange)} icon={UserPlus} loading={loadingSummary} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Asset Inventory</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="Total Assets" value={n(ast.total)} icon={Building2} loading={loadingSummary} />
          <MetricCard label="Approved Assets" value={n(ast.approved)} icon={CheckCircle2} loading={loadingSummary} />
          <MetricCard label="Avg Asset Score" value={n(ast.avgQuality)} icon={Star} loading={loadingSummary} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Staff &amp; Activity</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Active Staff" value={n(act.activeStaff)} icon={Users} loading={loadingSummary} />
          <MetricCard label="Follow-Ups Logged" value={n(act.followUps)} icon={Phone} loading={loadingSummary} />
          <MetricCard label="Calls Made" value={n(act.calls)} icon={Phone} loading={loadingSummary} />
          <MetricCard label="WhatsApp Messages" value={n(act.whatsapp)} icon={MessageCircle} loading={loadingSummary} />
          <MetricCard label="Routing Events" value={n(act.routingEvents)} icon={GitBranch} loading={loadingSummary} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">HR Pipeline</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="Candidates" value={n(hr.total)} icon={Users} loading={loadingSummary} />
          <MetricCard label="Interviews Scheduled" value={n(hr.interviewsScheduled)} icon={CalendarClock} loading={loadingSummary} />
          <MetricCard label="Hires Made" value={n(hr.hired)} icon={UserCheck} loading={loadingSummary} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Task Completion</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="Active Templates" value={n(task.activeTemplates)} icon={ListTodo} loading={loadingSummary} />
          <MetricCard label="Org Completion %" value={n(task.completionPct)} icon={ClipboardCheck} loading={loadingSummary} />
          <MetricCard label="Manual Logs (month)" value={n(task.manualLogs)} icon={KeyRound} loading={loadingSummary} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Charts</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h4 className="text-sm font-semibold mb-3">Lead Trend</h4>
            <LeadTrendChart data={charts.trends} loading={loadingCharts.trends} />
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h4 className="text-sm font-semibold mb-3">Lead Funnel</h4>
            <LeadFunnelChart data={charts.funnel} loading={loadingCharts.funnel} />
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h4 className="text-sm font-semibold mb-3">Lead Sources</h4>
            <LeadSourceDonut data={charts.sources} loading={loadingCharts.sources} />
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h4 className="text-sm font-semibold mb-3">Department Performance</h4>
            <DeptPerformanceChart data={charts.dept_perf} loading={loadingCharts.dept_perf} />
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h4 className="text-sm font-semibold mb-3">Staff Performance</h4>
            <StaffScatterChart data={charts.scatter} loading={loadingCharts.scatter} />
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h4 className="text-sm font-semibold mb-3">Activity Heatmap</h4>
            <ActivityHeatmap data={charts.heatmap} loading={loadingCharts.heatmap} />
          </div>
        </div>
      </section>
    </div>
  );
}
