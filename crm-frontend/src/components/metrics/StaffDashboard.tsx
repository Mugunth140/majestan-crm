'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import { MetricCard } from './MetricCard';
import { DashboardHeading, DashboardSection } from './DashboardPanels';
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

const n = (v: any): string | number => (v ?? '--') as string | number;

export function StaffDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    <div className="min-w-0 space-y-6">
      <DashboardHeading
        title="My dashboard"
        description={hasRank && !loadingSummary ? `Rank #${n(sm.monthlyRankInDept)} of ${n(sm.deptSize)} in your department` : "Personal activity"}
        busy={busy}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      <DashboardSection title="My KPIs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard label="Leads Assigned" value={n(sm.myLeadsAssigned)} loading={loadingSummary} />
          <MetricCard label="Follow-Ups Today" value={n(sm.followUpsDoneToday)} loading={loadingSummary} />
          <MetricCard label="Calls This Week" value={n(sm.callsThisWeek)} loading={loadingSummary} />
          <MetricCard label="Site Visits (month)" value={n(sm.svDoneThisMonth)} loading={loadingSummary} />
          <MetricCard label="Monthly Task %" value={sm.taskMonthlyPct != null ? `${sm.taskMonthlyPct}%` : '--'} loading={loadingSummary} />
          <MetricCard label="Weekly Task %" value={sm.taskWeeklyPct != null ? `${sm.taskWeeklyPct}%` : '--'} loading={loadingSummary} />
          <MetricCard label="Activity Streak" value={sm.currentStreak != null ? `${sm.currentStreak} days` : '--'} loading={loadingSummary} />
          <MetricCard label="Team Rank" value={sm.monthlyRankInDept != null || sm.deptSize != null ? `#${n(sm.monthlyRankInDept)} / ${n(sm.deptSize)}` : '--'} loading={loadingSummary} />
        </div>
      </DashboardSection>

      <DashboardSection title="Milestones">
        <div className="min-w-0 rounded-lg border bg-card px-4 py-3">
          <MilestoneBadges milestones={sm?.milestones ?? []} loading={loadingSummary} />
        </div>
      </DashboardSection>

      <DashboardSection title="Monthly Metric Progress">
        <div className="min-w-0 rounded-lg border bg-card px-4 py-3">
          <MonthlyRings rings={sm?.monthlyRings ?? []} loading={loadingSummary} />
        </div>
      </DashboardSection>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <DashboardSection title="This week vs last week">
          <div className="min-w-0 rounded-lg border bg-card px-4 py-3">
            <WeeklyCompare rows={sm?.weeklyCompare ?? []} loading={loadingSummary} />
          </div>
        </DashboardSection>

        <DashboardSection title="Activity this month">
          <div className="min-w-0 rounded-lg border bg-card px-4 py-3">
            <ActivityCalendar activeDates={sm?.activityCalendar ?? []} loading={loadingSummary} />
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
