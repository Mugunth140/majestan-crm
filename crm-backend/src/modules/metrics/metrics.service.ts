import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AnalyticsStoreService } from '../analytics/analytics-store.service';
import { CacheService } from '../analytics/cache.service';

// Every dashboard number is computed in DuckDB (the analytics copy of MySQL)
// and cached in Valkey. Responses keep the shapes the dashboards already use.

const CACHE_TTL = 60;

// A date range from the dashboard is whole days: `to` includes all of that day.
const IN_RANGE = (col: string) => `${col} >= CAST(? AS DATE) AND ${col} < CAST(? AS DATE) + INTERVAL 1 DAY`;

/** Pipeline order, used to tell how far a lead got. Lost/dropped are off the line. */
const STATUS_RANK: Record<string, number> = {
  'New Lead': 0, 'Contacted': 1, 'Qualified': 2, 'Property Shared': 3, 'Other Location': 3, 'Interested': 4,
  'Follow Up': 4, 'Future Follow-up': 4, 'Site Visit Scheduled': 5, 'Site Visit Completed': 6, 'Re Visit Scheduled': 7,
  'Re Visit Completed': 8, 'Negotiation': 9, 'Booking Advance': 10, 'Agreement': 11, 'Closed Won': 12,
};
const RANK_VALUES = Object.entries(STATUS_RANK).map(([s, r]) => `('${s.replace(/'/g, "''")}', ${r})`).join(', ');

const FUNNEL = [
  { label: 'New Lead', rank: 0 },
  { label: 'Contacted', rank: 1 },
  { label: 'Site Visit Completed', rank: 6 },
  { label: 'Negotiation', rank: 9 },
  { label: 'Booking Advance', rank: 10 },
];

/** Time-series metrics: what is counted, from which table, and who it belongs to. */
const SERIES: Record<string, { from: string; at: string; staff: string; where?: string }> = {
  leads_created: { from: 'leads', at: 'created_at', staff: 'assigned_staff_id' },
  follow_ups: { from: 'lead_follow_ups', at: 'created_at', staff: 'created_by_id' },
  calls: { from: 'all_contacts', at: 'created_at', staff: 'sent_by_id', where: `contact_type = 'call'` },
  whatsapp: { from: 'all_contacts', at: 'created_at', staff: 'sent_by_id', where: `contact_type = 'whatsapp'` },
  status_changes: { from: 'lead_events', at: 'created_at', staff: 'actor_id', where: `type = 'status_changed'` },
  site_visits: { from: 'lead_events', at: 'created_at', staff: 'actor_id', where: `type = 'status_changed' AND to_value IN ('Site Visit Completed', 'Re Visit Completed')` },
  conversions: { from: 'leads', at: 'converted_at', staff: 'assigned_staff_id', where: 'converted_to IS NOT NULL' },
};
const INTERVALS = new Set(['day', 'week', 'month']);

const TASK_PCT = `COALESCE(ROUND(SUM(p.achieved_count) / NULLIF(SUM(t.monthly_target), 0) * 100, 1), 0)`;
const THIS_WEEK_OF_MONTH = `CEIL(dayofmonth(current_date) / 7.0)`;

@Injectable()
export class MetricsService {
  constructor(
    private readonly store: AnalyticsStoreService,
    private readonly cache: CacheService,
  ) {}

  private isAdmin(role: string) { return ['Admin', 'Super Admin', 'Manager'].includes(role); }
  private key(user: any, segment: string, extra: string) { return `metrics:${segment}:${user.role}:${user.id}:${extra}`; }
  private n = (sql: string, params: unknown[] = []) => this.store.scalar(sql, params);
  private q = <T = any>(sql: string, params: unknown[] = []) => this.store.query<T>(sql, params);

  async bustCache(userId: number) { await this.cache.clear(`metrics:*:*:${userId}:*`); }

  getSummary(user: any, from: string, to: string) {
    return this.cache.wrap<object>(this.key(user, 'summary', `${from}:${to}`), CACHE_TTL, () => {
      if (this.isAdmin(user.role)) return this.buildAdminSummary();
      if (user.role === 'Team Lead') return this.buildTeamLeadSummary(user);
      return this.buildStaffSummary(user);
    });
  }

  getChartData(user: any, type: string, from: string, to: string) {
    return this.cache.wrap<object>(this.key(user, 'charts', `${type}:${from}:${to}`), CACHE_TTL, () => this.buildChartData(user, type, from, to));
  }

  /**
   * A metric over time, e.g. calls per week, optionally split by staff,
   * department or lead source. Staff see their own numbers, Team Leads their
   * department, Admins and Managers everyone.
   */
  getSeries(user: any, metric: string, from: string, to: string, interval: string, by?: string) {
    const def = SERIES[metric];
    if (!def) throw new BadRequestException(`Unknown metric "${metric}". Use one of: ${Object.keys(SERIES).join(', ')}`);
    if (!INTERVALS.has(interval)) throw new BadRequestException('interval must be day, week or month');
    if (by && !['staff', 'department', 'source'].includes(by)) throw new BadRequestException('by must be staff, department or source');
    if (by === 'source' && def.from !== 'leads') throw new BadRequestException('Only lead metrics can be split by source');

    return this.cache.wrap(this.key(user, 'series', `${metric}:${interval}:${by ?? ''}:${from}:${to}`), CACHE_TTL, async () => {
      const params: unknown[] = [from, to];
      const scope = this.scope(user, `x.${def.staff}`, params);
      const group = by === 'staff' ? `COALESCE(u.name, 'Unassigned')`
        : by === 'department' ? `COALESCE(d.name, 'No department')`
        : by === 'source' ? `COALESCE(x.lead_source, 'Unknown')`
        : `'all'`;
      const rows = await this.q<{ bucket: string; grp: string; value: number }>(
        `SELECT strftime(date_trunc('${interval}', x.${def.at}), '%Y-%m-%d') AS bucket, ${group} AS grp, COUNT(*) AS value
           FROM ${def.from} x
           LEFT JOIN users u ON u.id = x.${def.staff}
           LEFT JOIN departments d ON d.id = u.department_id
          WHERE ${IN_RANGE(`x.${def.at}`)} ${def.where ? `AND ${def.where}` : ''} ${scope}
          GROUP BY ALL ORDER BY bucket`,
        params,
      );
      const buckets = [...new Set(rows.map((r) => r.bucket))];
      const groups = new Map<string, number[]>();
      for (const r of rows) {
        const values = groups.get(r.grp) ?? new Array(buckets.length).fill(0);
        values[buckets.indexOf(r.bucket)] = Number(r.value);
        groups.set(r.grp, values);
      }
      return {
        metric, interval, by: by ?? null, buckets,
        series: [...groups].map(([name, values]) => ({ name, values, total: values.reduce((a, b) => a + b, 0) })),
        syncedAt: this.store.syncedAt,
      };
    });
  }

  /** Lead counts by status per day, from the nightly-and-hourly pipeline snapshots. */
  getPipelineHistory(user: any, from: string, to: string) {
    // Company-wide counts, so only admins and managers see them.
    if (!this.isAdmin(user.role)) throw new ForbiddenException('Pipeline history is for admins and managers');
    return this.cache.wrap(this.key(user, 'pipeline', `${from}:${to}`), CACHE_TTL, async () => {
      const rows = await this.q(
        `SELECT strftime(day, '%Y-%m-%d') AS day, status, SUM(leads) AS leads FROM pipeline_daily
          WHERE day BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) GROUP BY ALL ORDER BY day, status`,
        [from, to],
      );
      return { days: rows };
    });
  }

  /** Staff filter for a role: nothing for admins, the department for Team Leads, self otherwise. */
  private scope(user: any, staffCol: string, params: unknown[]) {
    if (this.isAdmin(user.role)) return '';
    if (user.role === 'Team Lead') {
      params.push(user.department_id ?? 0);
      return `AND ${staffCol} IN (SELECT id FROM users WHERE department_id = ?)`;
    }
    params.push(user.id);
    return `AND ${staffCol} = ?`;
  }

  private async buildAdminSummary() {
    // KPI cards are all-time live totals; only "new agents" uses the current month.
    const n = this.n;
    const [
      total, newLeads, followUp, svDone, booked, convInbound, convAgent, dropped,
      totalInbounds, activeInbounds, exclusive, prime, avgQuality,
      totalAgents, activeAgents, commAccepted, newAgents,
      totalAssets, approvedAssets, avgAssetQuality,
      activeStaff, followUps, calls, whatsapp, routingEvents,
      hrTotal, hrInterviews, hrHired, activeTasks, taskCompletion, manualLogs,
    ] = await Promise.all([
      n(`SELECT COUNT(*) AS c FROM leads`),
      n(`SELECT COUNT(*) AS c FROM leads WHERE status = 'New Lead'`),
      // 'Follow Up' is the older name still on some leads.
      n(`SELECT COUNT(*) AS c FROM leads WHERE status IN ('Follow Up', 'Future Follow-up')`),
      n(`SELECT COUNT(*) AS c FROM leads WHERE status = 'Site Visit Completed'`),
      n(`SELECT COUNT(*) AS c FROM leads WHERE status = 'Booking Advance'`),
      n(`SELECT COUNT(*) AS c FROM leads WHERE converted_to = 'inbound'`),
      n(`SELECT COUNT(*) AS c FROM leads WHERE converted_to = 'agent'`),
      n(`SELECT COUNT(*) AS c FROM leads WHERE is_unqualified = 1`),
      n(`SELECT COUNT(*) AS c FROM inbounds`),
      n(`SELECT COUNT(*) AS c FROM inbounds WHERE status NOT IN ('Closed', 'Rented', 'Sold')`),
      n(`SELECT COUNT(*) AS c FROM inbounds WHERE is_exclusive = 1`),
      n(`SELECT COUNT(*) AS c FROM inbounds WHERE is_prime_location = 1`),
      n(`SELECT ROUND(AVG(quality_score), 1) AS c FROM inbounds`),
      n(`SELECT COUNT(*) AS c FROM agents`),
      n(`SELECT COUNT(*) AS c FROM agents WHERE status = 'Active'`),
      n(`SELECT COUNT(*) AS c FROM agents WHERE commission_accepted = 1`),
      n(`SELECT COUNT(*) AS c FROM agents WHERE created_at >= date_trunc('month', current_date)`),
      n(`SELECT COUNT(*) AS c FROM assets`),
      n(`SELECT COUNT(*) AS c FROM assets WHERE status = 'Approved'`),
      n(`SELECT ROUND(AVG(quality_score), 1) AS c FROM assets`),
      n(`SELECT COUNT(*) AS c FROM users WHERE is_active = 1`),
      n(`SELECT COUNT(*) AS c FROM lead_follow_ups`),
      n(`SELECT COUNT(*) AS c FROM all_contacts WHERE contact_type = 'call'`),
      n(`SELECT COUNT(*) AS c FROM contact_logs WHERE contact_type = 'whatsapp'`),
      n(`SELECT COUNT(*) AS c FROM routing_histories`),
      n(`SELECT COUNT(*) AS c FROM hr_candidates`),
      n(`SELECT COUNT(*) AS c FROM hr_candidates WHERE status = 'Interview Scheduled'`),
      n(`SELECT COUNT(*) AS c FROM hr_candidates WHERE status = 'Joined'`),
      n(`SELECT COUNT(*) AS c FROM task_templates WHERE status = 'active'`),
      n(`SELECT ${TASK_PCT} AS c FROM task_metric_progress p JOIN task_metric_targets t ON p.task_template_id = t.task_template_id AND p.metric_key = t.metric_key`),
      n(`SELECT COUNT(*) AS c FROM task_activity_logs`),
    ]);
    return {
      role: 'admin',
      pipeline: { total, newLeads, followUp, svDone, booked, convertedInbound: convInbound, convertedAgent: convAgent, dropped },
      inbound: { total: totalInbounds, active: activeInbounds, exclusive, prime, avgQuality },
      agents: { total: totalAgents, active: activeAgents, commissionAccepted: commAccepted, newInRange: newAgents },
      assets: { total: totalAssets, approved: approvedAssets, avgQuality: avgAssetQuality },
      activity: { activeStaff, followUps, calls, whatsapp, routingEvents },
      hr: { total: hrTotal, interviewsScheduled: hrInterviews, hired: hrHired },
      tasks: { activeTemplates: activeTasks, completionPct: taskCompletion, manualLogs },
    };
  }

  private async buildTeamLeadSummary(user: any) {
    const dept = user.department_id ?? 0;
    const team = `(SELECT id FROM users WHERE department_id = ? AND is_active = 1)`;
    const n = this.n;
    const staffPct = (order: 'ASC' | 'DESC') => this.q<{ name: string; pct: number }>(
      `SELECT u.id, u.name, ${TASK_PCT} AS pct FROM users u
         JOIN task_templates tt ON tt.assigned_to = u.id AND tt.status = 'active'
         JOIN task_metric_targets t ON t.task_template_id = tt.id
         LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key
        WHERE u.department_id = ? GROUP BY u.id, u.name ORDER BY pct ${order}`,
      [dept],
    );
    const deptTasks = `FROM task_metric_progress p JOIN task_templates tt ON p.task_template_id = tt.id JOIN users u ON tt.assigned_to = u.id WHERE u.department_id = ?`;
    const deptTargets = `FROM task_metric_targets t JOIN task_templates tt ON t.task_template_id = tt.id JOIN users u ON tt.assigned_to = u.id WHERE u.department_id = ?`;
    const [
      activeStaff, leadsAssigned, followUpsWeek, calls, svDone, conversions, best, worst,
      weeklyAchieved, monthlyAchieved, weeklyTarget, monthlyTarget, rnrHigh,
    ] = await Promise.all([
      n(`SELECT COUNT(*) AS c FROM users WHERE department_id = ? AND is_active = 1`, [dept]),
      n(`SELECT COUNT(*) AS c FROM leads WHERE assigned_staff_id IN ${team}`, [dept]),
      n(`SELECT COUNT(*) AS c FROM lead_follow_ups WHERE created_by_id IN ${team} AND created_at >= date_trunc('week', current_date)`, [dept]),
      n(`SELECT COUNT(*) AS c FROM all_contacts WHERE contact_type = 'call' AND sent_by_id IN ${team}`, [dept]),
      n(`SELECT COUNT(*) AS c FROM leads WHERE status = 'Site Visit Completed' AND assigned_staff_id IN ${team}`, [dept]),
      n(`SELECT COUNT(*) AS c FROM leads WHERE converted_to IS NOT NULL AND assigned_staff_id IN ${team}`, [dept]),
      staffPct('DESC'),
      staffPct('ASC'),
      n(`SELECT COALESCE(SUM(p.achieved_count), 0) AS c ${deptTasks} AND p.week_number = ${THIS_WEEK_OF_MONTH}`, [dept]),
      n(`SELECT COALESCE(SUM(p.achieved_count), 0) AS c ${deptTasks}`, [dept]),
      n(`SELECT COALESCE(SUM(t.monthly_target) / 4, 0) AS c ${deptTargets}`, [dept]),
      n(`SELECT COALESCE(SUM(t.monthly_target), 0) AS c ${deptTargets}`, [dept]),
      n(`SELECT COUNT(*) AS c FROM leads WHERE assigned_staff_id IN ${team} AND rnr_consecutive_count >= 3`, [dept]),
    ]);
    const overallPct = best.length ? best.reduce((s, r) => s + Number(r.pct), 0) / best.length : 0;
    return {
      role: 'teamlead',
      teamLeadMetrics: {
        activeStaffInDept: activeStaff, leadsAssigned, followUpsThisWeek: followUpsWeek, callsMade: calls, svDone, conversions,
        taskCompletionPct: Math.round(overallPct),
        bestPerformer: best.length ? { name: best[0].name, pct: Number(best[0].pct) } : null,
        needsAttention: worst.length ? { name: worst[0].name, pct: Number(worst[0].pct) } : null,
        weeklyAchieved, weeklyTarget: Math.round(weeklyTarget), monthlyAchieved, monthlyTarget, rnrHighCount: rnrHigh,
      },
    };
  }

  private async buildStaffSummary(user: any) {
    const userId = user.id;
    const dept = user.department_id ?? 0;
    const active = `FROM task_metric_targets t JOIN task_templates tt ON t.task_template_id = tt.id
      LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key
      WHERE tt.assigned_to = ? AND tt.status = 'active'`;
    const [myLeads, followUpsToday, callsWeek, svMonth, rings, weekProgress, lastWeekProgress, [month], ranking, activityDays] = await Promise.all([
      this.n(`SELECT COUNT(*) AS c FROM leads WHERE assigned_staff_id = ?`, [userId]),
      this.n(`SELECT COUNT(*) AS c FROM lead_follow_ups WHERE created_by_id = ? AND CAST(created_at AS DATE) = current_date`, [userId]),
      this.n(`SELECT COUNT(*) AS c FROM all_contacts WHERE contact_type = 'call' AND sent_by_id = ? AND created_at >= current_date - INTERVAL 7 DAY`, [userId]),
      // Visits this month by when the status was set, not by the lead's last edit.
      this.n(`SELECT COUNT(DISTINCT e.lead_id) AS c FROM lead_events e JOIN leads l ON l.id = e.lead_id
               WHERE l.assigned_staff_id = ? AND e.type = 'status_changed' AND e.to_value = 'Site Visit Completed'
                 AND e.created_at >= date_trunc('month', current_date)`, [userId]),
      this.q(`SELECT t.metric_key, t.metric_label, t.monthly_target, COALESCE(SUM(p.achieved_count), 0) AS achieved ${active}
               GROUP BY t.metric_key, t.metric_label, t.monthly_target`, [userId]),
      this.q(`SELECT t.metric_key, t.metric_label,
                     COALESCE(SUM(CASE WHEN p.week_number = ${THIS_WEEK_OF_MONTH} THEN p.achieved_count ELSE 0 END), 0) AS this_week
               ${active} GROUP BY t.metric_key, t.metric_label`, [userId]),
      this.q(`SELECT t.metric_key,
                     COALESCE(SUM(CASE WHEN p.week_number = ${THIS_WEEK_OF_MONTH} - 1 THEN p.achieved_count ELSE 0 END), 0) AS last_week
               ${active} GROUP BY t.metric_key`, [userId]),
      this.q(`SELECT COALESCE(SUM(p.achieved_count), 0) AS achieved, COALESCE(SUM(t.monthly_target), 0) AS target ${active}`, [userId]),
      this.q<{ id: number }>(`SELECT u.id, ${TASK_PCT} AS pct FROM users u
               JOIN task_templates tt ON tt.assigned_to = u.id AND tt.status = 'active'
               JOIN task_metric_targets t ON t.task_template_id = tt.id
               LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key
              WHERE u.department_id = ? GROUP BY u.id ORDER BY pct DESC`, [dept]),
      this.q<{ d: string }>(`SELECT DISTINCT strftime(CAST(created_at AS DATE), '%Y-%m-%d') AS d FROM task_activity_logs
               WHERE logged_by = ? AND created_at >= date_trunc('month', current_date) ORDER BY d`, [userId]),
    ]);

    const monthAchieved = Number(month?.achieved ?? 0);
    const monthTarget = Number(month?.target ?? 0);
    const taskMonthlyPct = monthTarget > 0 ? Math.round((monthAchieved / monthTarget) * 100) : 0;
    const weekAchieved = weekProgress.reduce((s: number, r: any) => s + Number(r.this_week), 0);
    const weekTarget = rings.reduce((s: number, r: any) => s + Number(r.monthly_target) / 4, 0);
    const taskWeeklyPct = weekTarget > 0 ? Math.round((weekAchieved / weekTarget) * 100) : 0;
    const rank = ranking.map((r) => Number(r.id)).indexOf(Number(userId)) + 1 || 1;

    const activeDates = activityDays.map((r) => r.d);
    let streak = 0;
    for (let i = 0; i < 31; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (activeDates.includes(d.toISOString().slice(0, 10))) streak++;
      else break;
    }
    const lastWeek = new Map(lastWeekProgress.map((r: any) => [r.metric_key, Number(r.last_week)]));
    return {
      role: 'staff',
      staffMetrics: {
        myLeadsAssigned: myLeads, followUpsDoneToday: followUpsToday, callsThisWeek: callsWeek, svDoneThisMonth: svMonth,
        taskMonthlyPct, taskWeeklyPct, currentStreak: streak, monthlyRankInDept: rank, deptSize: ranking.length,
        monthlyRings: rings.map((r: any) => ({
          key: r.metric_key, label: r.metric_label, achieved: Number(r.achieved), target: Number(r.monthly_target),
          pct: Number(r.monthly_target) > 0 ? Math.round((Number(r.achieved) / Number(r.monthly_target)) * 100) : 0,
        })),
        weeklyCompare: weekProgress.map((r: any) => ({ key: r.metric_key, label: r.metric_label, thisWeek: Number(r.this_week), lastWeek: lastWeek.get(r.metric_key) ?? 0 })),
        activityCalendar: activeDates,
        milestones: [25, 50, 75, 100].map((threshold, i) => ({
          label: ['Quarter Way!', 'Halfway There!', 'Almost Done!', 'Crushed It!'][i], threshold, reached: taskMonthlyPct >= threshold,
        })),
      },
    };
  }

  private buildChartData(user: any, type: string, from: string, to: string) {
    switch (type) {
      case 'trends': return this.chartTrends(from, to);
      case 'funnel': return this.chartFunnel(from, to);
      case 'sources': return this.chartSources(from, to);
      case 'dept_perf': return this.chartDeptPerf();
      case 'scatter': return this.chartScatter(from, to);
      case 'heatmap': return this.chartHeatmap(from, to);
      case 'team_progress': return this.chartTeamProgress(user.department_id ?? 0);
      case 'team_trend': return this.chartTeamTrend(user.department_id ?? 0);
      case 'team_leads': return this.chartTeamLeads(user.department_id ?? 0, from, to);
      default: return Promise.resolve({});
    }
  }

  private async chartTrends(from: string, to: string) {
    const rows = await this.q(`SELECT strftime(CAST(created_at AS DATE), '%Y-%m-%d') AS date, COUNT(*) AS count FROM leads
      WHERE ${IN_RANGE('created_at')} GROUP BY ALL ORDER BY date`, [from, to]);
    return { type: 'trends', dates: rows.map((r) => r.date), counts: rows.map((r) => Number(r.count)) };
  }

  /**
   * Leads created in the range that reached each stage: by their current
   * status, or by any status they were moved through (from the lead history).
   */
  private async chartFunnel(from: string, to: string) {
    const [row] = await this.q(
      `WITH rank(status, r) AS (VALUES ${RANK_VALUES}),
       reached AS (
         SELECT l.id, GREATEST(COALESCE(MAX(cr.r), 0), COALESCE(MAX(er.r), 0)) AS r
           FROM leads l
           LEFT JOIN rank cr ON cr.status = l.status
           LEFT JOIN lead_events e ON e.lead_id = l.id AND e.type = 'status_changed'
           LEFT JOIN rank er ON er.status = e.to_value
          WHERE ${IN_RANGE('l.created_at')}
          GROUP BY l.id)
       SELECT ${FUNNEL.map((s, i) => `COUNT(*) FILTER (WHERE r >= ${s.rank}) AS s${i}`).join(', ')} FROM reached`,
      [from, to],
    );
    return { type: 'funnel', stages: FUNNEL.map((s, i) => ({ label: s.label, count: Number(row?.[`s${i}`] ?? 0) })) };
  }

  private async chartSources(from: string, to: string) {
    const rows = await this.q(`SELECT COALESCE(lead_source, 'Unknown') AS label, COUNT(*) AS count FROM leads
      WHERE ${IN_RANGE('created_at')} GROUP BY ALL ORDER BY count DESC LIMIT 10`, [from, to]);
    return { type: 'sources', slices: rows.map((r) => ({ label: r.label, count: Number(r.count) })) };
  }

  private async chartDeptPerf() {
    const rows = await this.q(`SELECT d.name, COALESCE(SUM(p.achieved_count), 0) AS achieved, COALESCE(SUM(t.monthly_target), 0) AS target
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id AND u.is_active = 1
      LEFT JOIN task_templates tt ON tt.assigned_to = u.id AND tt.status = 'active'
      LEFT JOIN task_metric_targets t ON t.task_template_id = tt.id
      LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key
      GROUP BY d.id, d.name ORDER BY d.name`);
    return {
      type: 'dept_perf',
      departments: rows.map((r) => ({
        name: r.name, achieved: Number(r.achieved), target: Number(r.target),
        pct: Number(r.target) > 0 ? Math.round((Number(r.achieved) / Number(r.target)) * 100) : 0,
      })),
    };
  }

  private async chartScatter(from: string, to: string) {
    const rows = await this.q(`SELECT u.id AS staff_id, u.name,
        (SELECT COUNT(*) FROM all_contacts c WHERE c.sent_by_id = u.id AND c.contact_type = 'call' AND ${IN_RANGE('c.created_at')}) AS calls,
        (SELECT COUNT(*) FROM leads l WHERE l.assigned_staff_id = u.id AND l.converted_to IS NOT NULL AND ${IN_RANGE('l.converted_at')}) AS conversions,
        (SELECT COUNT(*) FROM lead_follow_ups f WHERE f.created_by_id = u.id AND ${IN_RANGE('f.created_at')}) AS follow_ups
      FROM users u WHERE u.is_active = 1`, [from, to, from, to, from, to]);
    return {
      type: 'scatter',
      points: rows.map((r) => ({ staffId: Number(r.staff_id), name: r.name, calls: Number(r.calls), conversions: Number(r.conversions), followUps: Number(r.follow_ups) })),
    };
  }

  private async chartHeatmap(from: string, to: string) {
    // MySQL numbering kept for the chart: 1 = Sunday … 7 = Saturday.
    const rows = await this.q(`SELECT dayofweek(created_at) + 1 AS dow, hour(created_at) AS hr, COUNT(*) AS count FROM lead_follow_ups
      WHERE ${IN_RANGE('created_at')} GROUP BY ALL`, [from, to]);
    return { type: 'heatmap', cells: rows.map((r) => ({ dow: Number(r.dow), hour: Number(r.hr), count: Number(r.count) })) };
  }

  private async chartTeamProgress(dept: number) {
    const rows = await this.q(`SELECT u.name, ${TASK_PCT} AS pct FROM users u
      JOIN task_templates tt ON tt.assigned_to = u.id AND tt.status = 'active'
      JOIN task_metric_targets t ON t.task_template_id = tt.id
      LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key
      WHERE u.department_id = ? AND u.is_active = 1 GROUP BY u.id, u.name ORDER BY pct DESC`, [dept]);
    return { type: 'team_progress', staff: rows.map((r) => ({ name: r.name, pct: Number(r.pct) })) };
  }

  private async chartTeamTrend(dept: number) {
    const rows = await this.q(`SELECT p.week_number, COALESCE(SUM(p.achieved_count), 0) AS achieved
      FROM task_metric_progress p JOIN task_templates tt ON p.task_template_id = tt.id JOIN users u ON tt.assigned_to = u.id
      WHERE u.department_id = ? AND p.month = strftime(current_date, '%Y-%m') GROUP BY p.week_number ORDER BY p.week_number`, [dept]);
    return { type: 'team_trend', weeks: rows.map((r) => ({ week: Number(r.week_number), achieved: Number(r.achieved) })) };
  }

  private async chartTeamLeads(dept: number, from: string, to: string) {
    const rows = await this.q(`SELECT status AS label, COUNT(*) AS count FROM leads
      WHERE assigned_staff_id IN (SELECT id FROM users WHERE department_id = ? AND is_active = 1) AND ${IN_RANGE('created_at')}
      GROUP BY ALL ORDER BY count DESC`, [dept, from, to]);
    return { type: 'team_leads', slices: rows.map((r) => ({ label: r.label, count: Number(r.count) })) };
  }
}
