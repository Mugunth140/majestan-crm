'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  UserPlus, Phone, PhoneCall, CalendarClock,
  ClipboardCheck, CheckCircle2, Flame, Trophy, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { MetricCard } from './MetricCard';
import { MonthlyRings } from './staff/MonthlyRings';
import { WeeklyCompare } from './staff/WeeklyCompare';
import { MilestoneBadges } from './staff/MilestoneBadges';
import { ActivityCalendar } from './staff/ActivityCalendar';

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const n = (v: unknown) => v ?? '--';

export function StaffDashboard({ user }: { user: any }) {
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await apiFetch(`/api/v1/metrics/summary?from=${monthStart()}&to=${today()}`);
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

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiFetch('/api/v1/metrics/cache', { method: 'DELETE' });
    } catch {
      // ignore cache-clear errors, still refetch
    } finally {
      await fetchSummary();
      setRefreshing(false);
    }
  };

  const sm = summary?.staffMetrics ?? {};
  const busy = loadingSummary || refreshing;
  const hasRank = sm.monthlyRankInDept != null || sm.deptSize != null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">My Dashboard</h2>
          <p className="text-xs text-muted-foreground">
            Welcome{user?.name ? `, ${user.name}` : ''}
            {hasRank && !loadingSummary ? ` — Rank #${n(sm.monthlyRankInDept)} of ${n(sm.deptSize)}` : ''}
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
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">My KPIs</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard label="Leads Assigned" value={n(sm.myLeadsAssigned)} icon={UserPlus} loading={loadingSummary} />
          <MetricCard label="Follow-Ups Today" value={n(sm.followUpsDoneToday)} icon={Phone} loading={loadingSummary} />
          <MetricCard label="Calls This Week" value={n(sm.callsThisWeek)} icon={PhoneCall} loading={loadingSummary} />
          <MetricCard label="Site Visits (month)" value={n(sm.svDoneThisMonth)} icon={CalendarClock} loading={loadingSummary} />
          <MetricCard label="Monthly Task %" value={sm.taskMonthlyPct != null ? `${sm.taskMonthlyPct}%` : '--'} icon={ClipboardCheck} loading={loadingSummary} />
          <MetricCard label="Weekly Task %" value={sm.taskWeeklyPct != null ? `${sm.taskWeeklyPct}%` : '--'} icon={CheckCircle2} loading={loadingSummary} />
          <MetricCard label="Activity Streak" value={sm.currentStreak != null ? `${sm.currentStreak} days` : '--'} icon={Flame} loading={loadingSummary} />
          <MetricCard label="Team Rank" value={sm.monthlyRankInDept != null || sm.deptSize != null ? `#${n(sm.monthlyRankInDept)} / ${n(sm.deptSize)}` : '--'} icon={Trophy} loading={loadingSummary} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Milestones</h3>
        <MilestoneBadges milestones={sm?.milestones ?? []} loading={loadingSummary} />
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Monthly Metric Progress</h3>
        <MonthlyRings rings={sm?.monthlyRings ?? []} loading={loadingSummary} />
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">This Week vs Last Week</h3>
        <WeeklyCompare rows={sm?.weeklyCompare ?? []} loading={loadingSummary} />
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Activity This Month</h3>
        <ActivityCalendar activeDates={sm?.activityCalendar ?? []} loading={loadingSummary} />
      </section>
    </div>
  );
}
