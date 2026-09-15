import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

@Injectable()
export class MetricsService {
  private redis: Redis;
  constructor(@InjectDataSource() private readonly ds: DataSource) {
    const host = process.env.REDIS_HOST || 'valkey';
    this.redis = new Redis({ host, port: 6379, lazyConnect: true, retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000)) });
    this.redis.on('error', () => {});
  }
  private cacheKey(role: string, userId: number, segment: string, extra: string) { return `metrics:${segment}:${role}:${userId}:${extra}`; }
  private async cacheGet(key: string): Promise<any | null> { try { const v = await this.redis.get(key); return v ? JSON.parse(v) : null; } catch { return null; } }
  private async cacheSet(key: string, value: any, ttl: number) { try { await this.redis.setex(key, ttl, JSON.stringify(value)); } catch {} }
  async bustCache(userId: number) { try { const keys = await this.redis.keys(`metrics:*:*:${userId}:*`); if (keys.length) await this.redis.del(...keys); } catch {} }
  private isAdmin(role: string) { return ['Admin', 'Super Admin', 'Manager'].includes(role); }
  async getSummary(user: any, from: string, to: string) {
    const key = this.cacheKey(user.role, user.id, 'summary', `${from}:${to}`);
    const cached = await this.cacheGet(key);
    if (cached) return cached;
    const result = await this.buildSummary(user, from, to);
    await this.cacheSet(key, result, 60);
    return result;
  }
  private async buildSummary(user: any, from: string, to: string) {
    if (this.isAdmin(user.role)) return this.buildAdminSummary(from, to);
    if (user.role === 'Team Lead') return this.buildTeamLeadSummary(user, from, to);
    return this.buildStaffSummary(user, from, to);
  }
  private async buildAdminSummary(from: string, to: string) {
    // KPI cards are ALL-TIME live totals — no date filtering (from/to ignored).
    // Only newAgents/newHires-style cards use the current month; everything else counts every row ever worked.
    const qAll = (sql: string) => this.ds.query(sql);
    void from; void to;
    const [ [totalLeads], [newLeads], [followUpLeads], [svDone], [booked], [convInbound], [convAgent], [dropped], [totalInbounds], [activeInbounds], [exclusive], [prime], [avgQuality], [totalAgents], [activeAgents], [commAccepted], [newAgents], [totalAssets], [approvedAssets], [avgAssetQuality], [activeStaff], [followUps], [calls], [whatsapp], [routingEvents], [hrTotal], [hrInterviews], [hrHired], [activeTasks], taskCompletion, [manualLogs] ] = await Promise.all([
      qAll(`SELECT COUNT(*) as c FROM leads`),
      qAll(`SELECT COUNT(*) as c FROM leads WHERE status = 'New Lead'`),
      qAll(`SELECT COUNT(*) as c FROM leads WHERE status = 'Follow Up'`),
      qAll(`SELECT COUNT(*) as c FROM leads WHERE status = 'Site Visit Completed'`),
      qAll(`SELECT COUNT(*) as c FROM leads WHERE status = 'Booking Advance'`),
      qAll(`SELECT COUNT(*) as c FROM leads WHERE converted_to = 'inbound'`),
      qAll(`SELECT COUNT(*) as c FROM leads WHERE converted_to = 'agent'`),
      qAll(`SELECT COUNT(*) as c FROM leads WHERE is_unqualified = 1`),
      qAll(`SELECT COUNT(*) as c FROM inbounds`),
      qAll(`SELECT COUNT(*) as c FROM inbounds WHERE status NOT IN ('Closed','Rented','Sold')`),
      qAll(`SELECT COUNT(*) as c FROM inbounds WHERE is_exclusive = 1`),
      qAll(`SELECT COUNT(*) as c FROM inbounds WHERE is_prime_location = 1`),
      qAll(`SELECT ROUND(AVG(quality_score),1) as c FROM inbounds`),
      qAll(`SELECT COUNT(*) as c FROM agents`),
      qAll(`SELECT COUNT(*) as c FROM agents WHERE status = 'Active'`),
      qAll(`SELECT COUNT(*) as c FROM agents WHERE commission_accepted = 1`),
      qAll(`SELECT COUNT(*) as c FROM agents WHERE created_at >= DATE_FORMAT(CURDATE(),'%Y-%m-01')`),
      qAll(`SELECT COUNT(*) as c FROM assets`),
      qAll(`SELECT COUNT(*) as c FROM assets WHERE status = 'Approved'`),
      qAll(`SELECT ROUND(AVG(quality_score),1) as c FROM assets`),
      qAll(`SELECT COUNT(*) as c FROM users WHERE is_active = 1`),
      qAll(`SELECT COUNT(*) as c FROM lead_follow_ups`),
      qAll(`SELECT COUNT(*) as c FROM contact_logs WHERE contact_type = 'call'`),
      qAll(`SELECT COUNT(*) as c FROM contact_logs WHERE contact_type = 'whatsapp'`),
      qAll(`SELECT COUNT(*) as c FROM routing_histories`),
      qAll(`SELECT COUNT(*) as c FROM hr_candidates`),
      qAll(`SELECT COUNT(*) as c FROM hr_candidates WHERE status = 'Interview Scheduled'`),
      qAll(`SELECT COUNT(*) as c FROM hr_candidates WHERE status = 'Joined'`),
      qAll(`SELECT COUNT(*) as c FROM task_templates WHERE status = 'active'`),
      this.ds.query(`SELECT COALESCE(ROUND(SUM(p.achieved_count) / NULLIF(SUM(t.monthly_target),0) * 100, 1), 0) as pct FROM task_metric_progress p JOIN task_metric_targets t ON p.task_template_id = t.task_template_id AND p.metric_key = t.metric_key`),
      qAll(`SELECT COUNT(*) as c FROM task_activity_logs`),
    ]);
    const n = (r: any) => Number(r?.c ?? 0);
    return { role: 'admin',
      pipeline: { total: n(totalLeads), newLeads: n(newLeads), followUp: n(followUpLeads), svDone: n(svDone), booked: n(booked), convertedInbound: n(convInbound), convertedAgent: n(convAgent), dropped: n(dropped) },
      inbound: { total: n(totalInbounds), active: n(activeInbounds), exclusive: n(exclusive), prime: n(prime), avgQuality: n(avgQuality) },
      agents: { total: n(totalAgents), active: n(activeAgents), commissionAccepted: n(commAccepted), newInRange: n(newAgents) },
      assets: { total: n(totalAssets), approved: n(approvedAssets), avgQuality: n(avgAssetQuality) },
      activity: { activeStaff: n(activeStaff), followUps: n(followUps), calls: n(calls), whatsapp: n(whatsapp), routingEvents: n(routingEvents) },
      hr: { total: n(hrTotal), interviewsScheduled: n(hrInterviews), hired: n(hrHired) },
      tasks: { activeTemplates: n(activeTasks), completionPct: Number(taskCompletion[0]?.pct ?? 0), manualLogs: n(manualLogs) } };
  }
  private async buildTeamLeadSummary(user: any, from: string, to: string) {
    const deptId = user.department_id;
    const staffIds: any[] = await this.ds.query(`SELECT id FROM users WHERE department_id = ? AND is_active = 1`, [deptId]);
    const ids = staffIds.map((r: any) => r.id);
    const inClause = ids.length ? ids.join(',') : '0';
    const [ [activeStaff], [leadsAssigned], [followUpsWeek], [calls], [svDone], [conversions], taskCompDesc, taskCompAsc, [weeklyAchieved], [monthlyAchieved], [weeklyTarget], [monthlyTarget], [rnrHigh] ] = await Promise.all([
      this.ds.query(`SELECT COUNT(*) as c FROM users WHERE department_id = ? AND is_active = 1`, [deptId]),
      this.ds.query(`SELECT COUNT(*) as c FROM leads WHERE assigned_staff_id IN (${inClause})`),
      this.ds.query(`SELECT COUNT(*) as c FROM lead_follow_ups WHERE created_by_id IN (${inClause}) AND created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`),
      this.ds.query(`SELECT COUNT(*) as c FROM contact_logs WHERE contact_type = 'call' AND sent_by_id IN (${inClause})`),
      this.ds.query(`SELECT COUNT(*) as c FROM leads WHERE status = 'Site Visit Completed' AND assigned_staff_id IN (${inClause})`),
      this.ds.query(`SELECT COUNT(*) as c FROM leads WHERE converted_to IS NOT NULL AND assigned_staff_id IN (${inClause})`),
      this.ds.query(`SELECT u.id, u.name, COALESCE(ROUND(SUM(p.achieved_count) / NULLIF(SUM(t.monthly_target),0) * 100, 1), 0) as pct FROM users u JOIN task_templates tt ON tt.assigned_to = u.id AND tt.status = 'active' JOIN task_metric_targets t ON t.task_template_id = tt.id LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key WHERE u.department_id = ? GROUP BY u.id, u.name ORDER BY pct DESC`, [deptId]),
      this.ds.query(`SELECT u.id, u.name, COALESCE(ROUND(SUM(p.achieved_count) / NULLIF(SUM(t.monthly_target),0) * 100, 1), 0) as pct FROM users u JOIN task_templates tt ON tt.assigned_to = u.id AND tt.status = 'active' JOIN task_metric_targets t ON t.task_template_id = tt.id LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key WHERE u.department_id = ? GROUP BY u.id, u.name ORDER BY pct ASC`, [deptId]),
      this.ds.query(`SELECT COALESCE(SUM(p.achieved_count), 0) as c FROM task_metric_progress p JOIN task_templates tt ON p.task_template_id = tt.id JOIN users u ON tt.assigned_to = u.id WHERE u.department_id = ? AND p.week_number = CEIL(DAYOFMONTH(CURDATE())/7)`, [deptId]),
      this.ds.query(`SELECT COALESCE(SUM(p.achieved_count), 0) as c FROM task_metric_progress p JOIN task_templates tt ON p.task_template_id = tt.id JOIN users u ON tt.assigned_to = u.id WHERE u.department_id = ?`, [deptId]),
      this.ds.query(`SELECT COALESCE(SUM(t.monthly_target)/4, 0) as c FROM task_metric_targets t JOIN task_templates tt ON t.task_template_id = tt.id JOIN users u ON tt.assigned_to = u.id WHERE u.department_id = ?`, [deptId]),
      this.ds.query(`SELECT COALESCE(SUM(t.monthly_target), 0) as c FROM task_metric_targets t JOIN task_templates tt ON t.task_template_id = tt.id JOIN users u ON tt.assigned_to = u.id WHERE u.department_id = ?`, [deptId]),
      this.ds.query(`SELECT COUNT(*) as c FROM leads WHERE assigned_staff_id IN (${inClause}) AND rnr_consecutive_count >= 3`),
    ]);
    const n = (r: any) => Number(r?.c ?? 0);
    const overallPct = taskCompDesc.length > 0 ? taskCompDesc.reduce((s: number, r: any) => s + Number(r.pct), 0) / taskCompDesc.length : 0;
    return { role: 'teamlead', teamLeadMetrics: { activeStaffInDept: n(activeStaff), leadsAssigned: n(leadsAssigned), followUpsThisWeek: n(followUpsWeek), callsMade: n(calls), svDone: n(svDone), conversions: n(conversions), taskCompletionPct: Math.round(overallPct), bestPerformer: taskCompDesc.length > 0 ? { name: taskCompDesc[0]?.name, pct: Number(taskCompDesc[0]?.pct) } : null, needsAttention: taskCompAsc.length > 0 ? { name: taskCompAsc[0]?.name, pct: Number(taskCompAsc[0]?.pct) } : null, weeklyAchieved: n(weeklyAchieved), weeklyTarget: Math.round(n(weeklyTarget)), monthlyAchieved: n(monthlyAchieved), monthlyTarget: n(monthlyTarget), rnrHighCount: n(rnrHigh) } };
  }
  private async buildStaffSummary(user: any, from: string, to: string) {
    const userId = user.id; const deptId = user.department_id;
    const todayStr = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStart = weekAgo.toISOString().slice(0, 10);
    const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeekStart = twoWeeksAgo.toISOString().slice(0, 10);
    const monthStart = new Date().toISOString().slice(0, 8) + '01';
    const [ [myLeads], [followUpsToday], [callsWeek], [svMonth], activeTemplate, weekProgress, monthProgress, allStaffProgress, activityDays ] = await Promise.all([
      this.ds.query(`SELECT COUNT(*) as c FROM leads WHERE assigned_staff_id = ?`, [userId]),
      this.ds.query(`SELECT COUNT(*) as c FROM lead_follow_ups WHERE created_by_id = ? AND DATE(created_at) = ?`, [userId, todayStr]),
      this.ds.query(`SELECT COUNT(*) as c FROM contact_logs WHERE sent_by_id = ? AND contact_type = 'call' AND created_at >= ?`, [userId, weekStart]),
      this.ds.query(`SELECT COUNT(*) as c FROM leads WHERE assigned_staff_id = ? AND status = 'Site Visit Completed' AND updated_at >= ?`, [userId, monthStart]),
      this.ds.query(`SELECT tt.id, t.metric_key, t.metric_label, t.monthly_target, COALESCE(SUM(p.achieved_count),0) as achieved FROM task_templates tt JOIN task_metric_targets t ON t.task_template_id = tt.id LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key WHERE tt.assigned_to = ? AND tt.status = 'active' GROUP BY tt.id, t.metric_key, t.metric_label, t.monthly_target`, [userId]),
      this.ds.query(`SELECT t.metric_key, t.metric_label, COALESCE(SUM(CASE WHEN p.week_number = CEIL(DAYOFMONTH(CURDATE())/7) THEN p.achieved_count ELSE 0 END),0) as thisWeek FROM task_metric_targets t JOIN task_templates tt ON t.task_template_id = tt.id LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key WHERE tt.assigned_to = ? AND tt.status = 'active' GROUP BY t.metric_key, t.metric_label`, [userId]),
      this.ds.query(`SELECT COALESCE(SUM(p.achieved_count),0) as achieved, COALESCE(SUM(t.monthly_target),0) as target FROM task_metric_targets t JOIN task_templates tt ON t.task_template_id = tt.id LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key WHERE tt.assigned_to = ? AND tt.status = 'active'`, [userId]),
      this.ds.query(`SELECT u.id, COALESCE(ROUND(SUM(p.achieved_count) / NULLIF(SUM(t.monthly_target),0) * 100, 1), 0) as pct FROM users u JOIN task_templates tt ON tt.assigned_to = u.id AND tt.status = 'active' JOIN task_metric_targets t ON t.task_template_id = tt.id LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key WHERE u.department_id = ? GROUP BY u.id ORDER BY pct DESC`, [deptId]),
      this.ds.query(`SELECT DISTINCT DATE(created_at) as d FROM task_activity_logs WHERE logged_by = ? AND DATE(created_at) >= ? ORDER BY d`, [userId, monthStart]),
    ]);
    const n = (r: any) => Number(r?.c ?? 0);
    const monthAchieved = Number((monthProgress as any[])[0]?.achieved ?? 0);
    const monthTarget = Number((monthProgress as any[])[0]?.target ?? 0);
    const taskMonthlyPct = monthTarget > 0 ? Math.round(monthAchieved / monthTarget * 100) : 0;
    const weekAchieved = (weekProgress as any[]).reduce((s: number, r: any) => s + Number(r.thisWeek), 0);
    const weekTargetSum = (activeTemplate as any[]).reduce((s: number, r: any) => s + Number(r.monthly_target) / 4, 0);
    const taskWeeklyPct = weekTargetSum > 0 ? Math.round(weekAchieved / weekTargetSum * 100) : 0;
    const sortedIds = (allStaffProgress as any[]).map((r: any) => r.id);
    const rank = sortedIds.indexOf(userId) + 1 || 1;
    const activeDates = (activityDays as any[]).map((r: any) => r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10));
    let streak = 0; const todayD = new Date();
    for (let i = 0; i < 31; i++) { const d = new Date(todayD); d.setDate(d.getDate() - i); const ds = d.toISOString().slice(0, 10); if (activeDates.includes(ds)) streak++; else break; }
    const monthlyRings = (activeTemplate as any[]).map((r: any) => ({ key: r.metric_key, label: r.metric_label, achieved: Number(r.achieved), target: Number(r.monthly_target), pct: Number(r.monthly_target) > 0 ? Math.round(Number(r.achieved) / Number(r.monthly_target) * 100) : 0 }));
    const lastWeekProgress: any[] = await this.ds.query(`SELECT t.metric_key, COALESCE(SUM(CASE WHEN p.week_number = CEIL(DAYOFMONTH(CURDATE())/7) - 1 THEN p.achieved_count ELSE 0 END),0) as lastWeek FROM task_metric_targets t JOIN task_templates tt ON t.task_template_id = tt.id LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key WHERE tt.assigned_to = ? AND tt.status = 'active' GROUP BY t.metric_key`, [userId]);
    const lastWeekMap: Record<string, number> = {};
    lastWeekProgress.forEach((r: any) => { lastWeekMap[r.metric_key] = Number(r.lastWeek); });
    const weeklyCompare = (weekProgress as any[]).map((r: any) => ({ key: r.metric_key, label: r.metric_label, thisWeek: Number(r.thisWeek), lastWeek: lastWeekMap[r.metric_key] ?? 0 }));
    const milestones = [ { label: 'Quarter Way!', threshold: 25, reached: taskMonthlyPct >= 25 }, { label: 'Halfway There!', threshold: 50, reached: taskMonthlyPct >= 50 }, { label: 'Almost Done!', threshold: 75, reached: taskMonthlyPct >= 75 }, { label: 'Crushed It!', threshold: 100, reached: taskMonthlyPct >= 100 } ];
    void weekStart; void twoWeekStart;
    return { role: 'staff', staffMetrics: { myLeadsAssigned: n(myLeads), followUpsDoneToday: n(followUpsToday), callsThisWeek: n(callsWeek), svDoneThisMonth: n(svMonth), taskMonthlyPct, taskWeeklyPct, currentStreak: streak, monthlyRankInDept: rank, deptSize: (allStaffProgress as any[]).length, monthlyRings, weeklyCompare, activityCalendar: activeDates, milestones } };
  }
  async getChartData(user: any, type: string, from: string, to: string) {
    const key = this.cacheKey(user.role, user.id, 'charts', `${type}:${from}:${to}`);
    const cached = await this.cacheGet(key);
    if (cached) return cached;
    const result = await this.buildChartData(user, type, from, to);
    await this.cacheSet(key, result, 600);
    return result;
  }
  private async buildChartData(user: any, type: string, from: string, to: string) {
    switch (type) {
      case 'trends': return this.chartTrends(from, to);
      case 'funnel': return this.chartFunnel(from, to);
      case 'sources': return this.chartSources(from, to);
      case 'dept_perf': return this.chartDeptPerf();
      case 'scatter': return this.chartScatter(from, to);
      case 'heatmap': return this.chartHeatmap(from, to);
      case 'team_progress': return this.chartTeamProgress(user.department_id);
      case 'team_trend': return this.chartTeamTrend(user.department_id);
      case 'team_leads': return this.chartTeamLeads(user.department_id, from, to);
      default: return {};
    }
  }
  private async chartTrends(from: string, to: string) {
    const rows = await this.ds.query(`SELECT DATE(created_at) as date, COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY date`, [from, to]);
    return { type: 'trends', dates: rows.map((r: any) => r.date), counts: rows.map((r: any) => Number(r.count)) };
  }
  private async chartFunnel(from: string, to: string) {
    const stages = ['New Lead', 'Follow Up', 'Site Visit Completed', 'Booking Advance'];
    const rows: any[] = await this.ds.query(`SELECT status, COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ? GROUP BY status`, [from, to]);
    const map: Record<string, number> = {};
    rows.forEach((r: any) => { map[r.status] = Number(r.count); });
    return { type: 'funnel', stages: stages.map(s => ({ label: s, count: map[s] ?? 0 })) };
  }
  private async chartSources(from: string, to: string) {
    const rows = await this.ds.query(`SELECT COALESCE(lead_source, 'Unknown') as label, COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ? GROUP BY lead_source ORDER BY count DESC LIMIT 10`, [from, to]);
    return { type: 'sources', slices: rows.map((r: any) => ({ label: r.label, count: Number(r.count) })) };
  }
  private async chartDeptPerf() {
    const rows = await this.ds.query(`SELECT d.name, COALESCE(SUM(p.achieved_count), 0) as achieved, COALESCE(SUM(t.monthly_target), 0) as target FROM departments d LEFT JOIN users u ON u.department_id = d.id AND u.is_active = 1 LEFT JOIN task_templates tt ON tt.assigned_to = u.id AND tt.status = 'active' LEFT JOIN task_metric_targets t ON t.task_template_id = tt.id LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key GROUP BY d.id, d.name ORDER BY d.name`);
    return { type: 'dept_perf', departments: rows.map((r: any) => ({ name: r.name, achieved: Number(r.achieved), target: Number(r.target), pct: Number(r.target) > 0 ? Math.round(Number(r.achieved) / Number(r.target) * 100) : 0 })) };
  }
  private async chartScatter(from: string, to: string) {
    const rows = await this.ds.query(`SELECT u.id as staffId, u.name, (SELECT COUNT(*) FROM contact_logs cl WHERE cl.sent_by_id = u.id AND cl.contact_type = 'call' AND cl.created_at BETWEEN ? AND ?) as calls, (SELECT COUNT(*) FROM leads l WHERE l.assigned_staff_id = u.id AND l.converted_to IS NOT NULL AND l.converted_at BETWEEN ? AND ?) as conversions, (SELECT COUNT(*) FROM lead_follow_ups lf WHERE lf.created_by_id = u.id AND lf.created_at BETWEEN ? AND ?) as followUps FROM users u WHERE u.is_active = 1`, [from, to, from, to, from, to]);
    return { type: 'scatter', points: rows.map((r: any) => ({ staffId: Number(r.staffId), name: r.name, calls: Number(r.calls), conversions: Number(r.conversions), followUps: Number(r.followUps) })) };
  }
  private async chartHeatmap(from: string, to: string) {
    const rows = await this.ds.query(`SELECT DAYOFWEEK(created_at) as dow, HOUR(created_at) as hr, COUNT(*) as count FROM lead_follow_ups WHERE created_at BETWEEN ? AND ? GROUP BY dow, hr`, [from, to]);
    return { type: 'heatmap', cells: rows.map((r: any) => ({ dow: Number(r.dow), hour: Number(r.hr), count: Number(r.count) })) };
  }
  private async chartTeamProgress(deptId: number) {
    const rows = await this.ds.query(`SELECT u.name, COALESCE(ROUND(SUM(p.achieved_count) / NULLIF(SUM(t.monthly_target),0) * 100, 1), 0) as pct FROM users u JOIN task_templates tt ON tt.assigned_to = u.id AND tt.status = 'active' JOIN task_metric_targets t ON t.task_template_id = tt.id LEFT JOIN task_metric_progress p ON p.task_template_id = tt.id AND p.metric_key = t.metric_key WHERE u.department_id = ? AND u.is_active = 1 GROUP BY u.id, u.name ORDER BY pct DESC`, [deptId]);
    return { type: 'team_progress', staff: rows.map((r: any) => ({ name: r.name, pct: Number(r.pct) })) };
  }
  private async chartTeamTrend(deptId: number) {
    const rows = await this.ds.query(`SELECT p.week_number, COALESCE(SUM(p.achieved_count),0) as achieved FROM task_metric_progress p JOIN task_templates tt ON p.task_template_id = tt.id JOIN users u ON tt.assigned_to = u.id WHERE u.department_id = ? AND p.month = DATE_FORMAT(CURDATE(),'%Y-%m') GROUP BY p.week_number ORDER BY p.week_number`, [deptId]);
    return { type: 'team_trend', weeks: rows.map((r: any) => ({ week: Number(r.week_number), achieved: Number(r.achieved) })) };
  }
  private async chartTeamLeads(deptId: number, from: string, to: string) {
    const staffIds: any[] = await this.ds.query(`SELECT id FROM users WHERE department_id = ? AND is_active = 1`, [deptId]);
    const ids = staffIds.map((r: any) => r.id);
    if (!ids.length) return { type: 'team_leads', slices: [] };
    const inClause = ids.join(',');
    const rows = await this.ds.query(`SELECT status as label, COUNT(*) as count FROM leads WHERE assigned_staff_id IN (${inClause}) AND created_at BETWEEN ? AND ? GROUP BY status ORDER BY count DESC`, [from, to]);
    return { type: 'team_leads', slices: rows.map((r: any) => ({ label: r.label, count: Number(r.count) })) };
  }
}
