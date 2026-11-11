import { gettingStarted, type ChecklistItem } from '../users/getting-started';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { AnalyticsStoreService } from '../analytics/analytics-store.service';
import { CacheService } from '../analytics/cache.service';
import { TaskTemplate } from '../../database/entities/task-template.entity';
import { dailyProgress } from '../tasks/task-progress';
import { computePace, storedWeeks } from '../tasks/task-pace';
import { metricDef } from '../tasks/task-metrics';
import {
  addDays, isWorkingDay, parseRange, taskWeek, workingDaysBetween, type Range,
} from './range';
import * as Q from './sql';
import {
  addCounters, compute, DEPARTMENTS, DEPT_METRICS, deptKeyOf, deptLabel, HEADLINE, median, percentile,
  SCORE_METRICS, type Counters, type DeptKey, type MetricDef,
} from './metrics';
import { hrTab, sourcingTab } from './module-tabs';
import { changeInsights, outlierInsights, targetInsights, workloadInsights } from './insights';
import type {
  Achievement, Bar, Block, Insight, LeaderRow, MetricOut, Person, ProgressHero, Scope, Section, Subject, Tab, TargetRow, Viewer,
} from './types';

const ORG_ROLES = ['Admin', 'Super Admin', 'Manager'];
const MODULE_TABS: DeptKey[] = ['hr', 'sourcing'];
type PeriodCounters = { cur: Counters; prev: Counters };
type SeriesMap = Map<number, Map<string, Record<string, number>>>;

/** Everything one report needs about a set of people, loaded once. */
type Data = {
  range: Range;
  people: Person[];
  counters: Map<number, PeriodCounters>;
  series: SeriesMap;
  targets: TargetRow[];
  loggers: Map<number, string | null>;
};

const ALL_DEFS: Map<string, MetricDef> = new Map(
  Object.values(DEPT_METRICS).flat().map(d => [d.key, d]),
);
const SERIES_LABELS: Record<string, string> = {
  calls: 'Calls', connected: 'Connected', talk: 'Talk minutes', followups: 'Follow-ups', qualified: 'Qualified',
  sv_sched: 'Visits scheduled', sv_done: 'Visits completed', nego: 'Negotiations', booked: 'Bookings', dropped: 'Dropped',
  shares: 'Shares', messages: 'Messages', sourced: 'Listings sourced', verified: 'Verified', hr_moves: 'Candidate moves', tasks: 'Task entries',
};
const DEPT_SERIES: Record<DeptKey, string[]> = {
  telecalling: ['calls', 'connected', 'followups', 'qualified', 'sv_sched', 'sv_done'],
  sales: ['calls', 'shares', 'sv_done', 'nego', 'booked', 'followups'],
  collection: ['calls', 'messages', 'tasks'],
  sourcing: ['sourced', 'verified', 'calls'],
  hr: ['hr_moves', 'calls'],
  digital: ['tasks'],
  design: ['tasks'],
  other: ['calls', 'followups'],
};
/** The activity a person's streak and personal best are measured on. */
const PRIMARY: Record<DeptKey, string> = {
  telecalling: 'calls', sales: 'calls', collection: 'calls', sourcing: 'sourced', hr: 'hr_moves', digital: 'tasks', design: 'tasks', other: 'calls',
};
const SALES_STAGES = ['New Lead', 'Contacted', 'Qualified', 'Property Shared', 'Interested', 'Site Visit Scheduled', 'Site Visit Completed', 'Re Visit Scheduled', 'Re Visit Completed', 'Negotiation', 'Booking Advance', 'Agreement', 'Closed Won'];
const HR_STAGES = ['New Application', 'Resume Shortlisted', 'Interview Scheduled', 'Interview Completed', 'Selected', 'Offer Sent', 'Joined'];
const leadsHref = (params: Record<string, string | number>) => `/leads?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;

@Injectable()
export class DashboardService {
  constructor(
    private readonly store: AnalyticsStoreService,
    private readonly cache: CacheService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  // ── Who can see what ────────────────────────────────────────────────────

  private async roster(): Promise<Person[]> {
    const rows: { id: number; name: string; role: string | null; department_id: number | null; department: string | null; avatar: string | null }[] =
      await this.db.query(
        `SELECT u.id, u.name, r.name AS role, u.department_id, d.name AS department, u.avatar_url AS avatar
           FROM users u LEFT JOIN roles r ON r.id = u.role_id LEFT JOIN departments d ON d.id = u.department_id
          WHERE u.is_active = 1 ORDER BY u.name, u.id`,
      );
    return rows.map(r => ({
      id: Number(r.id), name: r.name, role: r.role ?? 'Staff', departmentId: r.department_id === null ? null : Number(r.department_id),
      department: r.department, dept: deptKeyOf(r.department), avatar: r.avatar,
    }));
  }

  private scopeOf(role: string): Scope {
    if (ORG_ROLES.includes(role)) return 'organization';
    if (role === 'Team Lead') return 'department';
    return 'self';
  }

  private visible(scope: Scope, me: Person, roster: Person[]) {
    if (scope === 'organization') return roster;
    if (scope === 'department') return roster.filter(p => p.id === me.id || (me.departmentId !== null && p.departmentId === me.departmentId));
    return roster.filter(p => p.id === me.id);
  }

  private me(viewer: Viewer, roster: Person[]) {
    const me = roster.find(p => p.id === Number(viewer.id));
    if (!me) throw new ForbiddenException('Your account is not active');
    return me;
  }

  async subjects(viewer: Viewer) {
    const roster = await this.roster();
    const me = this.me(viewer, roster);
    const scope = this.scopeOf(me.role);
    const people = this.visible(scope, me, roster);
    const departments = [...new Map(people.filter(p => p.departmentId !== null).map(p => [p.departmentId!, p])).values()]
      .filter(p => scope === 'organization' || p.departmentId === me.departmentId)
      .map(p => ({ id: p.departmentId!, name: p.department!, dept: p.dept, label: deptLabel(p.dept), members: people.filter(x => x.departmentId === p.departmentId).length }))
      .sort((a, b) => DEPARTMENTS.findIndex(d => d.key === a.dept) - DEPARTMENTS.findIndex(d => d.key === b.dept));
    return { scope, me, defaultSubject: this.defaultSubject(scope, me), departments, people };
  }

  private defaultSubject(scope: Scope, me: Person) {
    if (scope === 'organization') return 'all';
    if (scope === 'department' && me.departmentId !== null) return `dept:${me.departmentId}`;
    return `user:${me.id}`;
  }

  private resolveSubject(raw: string | undefined, scope: Scope, me: Person, roster: Person[]): Subject {
    const key = !raw || raw === 'me' ? (raw === 'me' ? `user:${me.id}` : this.defaultSubject(scope, me)) : raw;
    const visible = this.visible(scope, me, roster);
    if (key === 'all') {
      if (scope !== 'organization') throw new ForbiddenException('The whole-business view is for Admins and Managers');
      return { kind: 'all', key, label: 'Everyone' };
    }
    const match = /^(dept|user):(\d+)$/.exec(key);
    if (!match) throw new BadRequestException('Unknown dashboard subject');
    const id = Number(match[2]);
    if (match[1] === 'dept') {
      const member = visible.find(p => p.departmentId === id);
      if (!member || (scope === 'department' && id !== me.departmentId) || scope === 'self') {
        throw new ForbiddenException('This department is outside your dashboard');
      }
      return { kind: 'dept', key, label: deptLabel(member.dept), dept: member.dept, departmentId: id };
    }
    const person = visible.find(p => p.id === id);
    if (!person) throw new ForbiddenException('This person is outside your dashboard');
    return { kind: 'person', key, label: person.name, person };
  }

  private tabsFor(subject: Subject, me: Person, scope: Scope, roster: Person[]): Tab[] {
    if (subject.kind === 'all') {
      const present = new Set(roster.map(p => p.dept));
      return [
        { id: 'overview', label: 'Overview' },
        ...(me.role === 'Manager' ? [{ id: 'me', label: 'My work' }] : []),
        // HR and Sourcing always have a tab: they report on the whole module, not only on their department's people.
        ...DEPARTMENTS.filter(d => present.has(d.key) || MODULE_TABS.includes(d.key)).map(d => ({ id: d.key, label: d.label })),
        { id: 'people', label: 'People' },
      ];
    }
    if (subject.kind === 'dept') {
      const own = scope === 'department' && me.departmentId === subject.departmentId;
      return [{ id: 'team', label: 'Team' }, { id: 'metrics', label: `${deptLabel(subject.dept)} metrics` }, ...(own ? [{ id: 'me', label: 'My work' }] : [])];
    }
    return [{ id: 'progress', label: subject.person.id === me.id ? 'My progress' : 'Progress' }, { id: 'metrics', label: `${deptLabel(subject.person.dept)} metrics` }];
  }

  // ── Report ──────────────────────────────────────────────────────────────

  async report(viewer: Viewer, query: { subject?: string; range?: string; tab?: string }) {
    const range = parseRange(query.range);
    const roster = await this.roster();
    const me = this.me(viewer, roster);
    const scope = this.scopeOf(me.role);
    const subject = this.resolveSubject(query.subject, scope, me, roster);
    const tabs = this.tabsFor(subject, me, scope, roster);
    const tab = tabs.find(t => t.id === query.tab) ?? tabs[0];
    const visible = this.visible(scope, me, roster);
    const key = `dashboard:v1:${me.id}:${me.role}:${subject.key}:${range.key}:${range.from}..${range.to}:${range.today}:${tab.id}:${visible.map(p => `${p.id}.${p.departmentId}`).join(',')}`;
    const sections = await this.cache.wrap(key, 60, () => this.build(subject, tab.id, range, me, visible, roster));
    // Celebrations depend on what this viewer has already seen, so they are never cached.
    await this.markCelebrations(me, sections);
    return {
      scope, subject, tabs, tab: tab.id, sections, syncedAt: this.store.syncedAt,
      range: { key: range.key, from: range.from, to: range.to, prevFrom: range.prevFrom, prevTo: range.prevTo, bucket: range.bucket },
    };
  }

  private async build(subject: Subject, tab: string, range: Range, me: Person, visible: Person[], roster: Person[]): Promise<Section[]> {
    if (subject.kind === 'all') {
      if (tab === 'me') return this.personTabs(me, roster, range, 'progress', me);
      if (tab === 'people') return this.peopleTab(visible, range);
      if (tab === 'overview') return this.overview(visible, range);
      const dept = tab as DeptKey;
      const members = visible.filter(p => p.dept === dept);
      if (MODULE_TABS.includes(dept)) return this.moduleTab(dept, members, range, roster);
      const data = await this.load(members, range);
      const [team, metrics] = await Promise.all([this.teamSections(dept, members, data, null), this.deptSections(dept, members, data, null)]);
      return [...team, ...metrics];
    }
    if (subject.kind === 'dept') {
      const members = visible.filter(p => p.departmentId === subject.departmentId);
      if (tab === 'me') return this.personTabs(me, roster, range, 'progress', me);
      const data = await this.load(members, range);
      return tab === 'metrics' ? this.deptSections(subject.dept, members, data, null) : this.teamSections(subject.dept, members, data, me);
    }
    return this.personTabs(subject.person, roster, range, tab, me);
  }

  /** Business-wide HR or Sourcing, then the department's own leaderboard when it has people. */
  private async moduleTab(dept: DeptKey, members: Person[], range: Range, roster: Person[]): Promise<Section[]> {
    const ctx: Q.Ctx = { ids: Q.idList(members.map(p => p.id)), range, now: Q.nowLiteral() };
    const query = <T>(sql: string) => this.store.query<T>(sql);
    const sections = await (dept === 'hr' ? hrTab : sourcingTab)(query, ctx, roster);
    if (members.length) {
      const data = await this.load(members, range);
      sections.push({ id: `${dept}-board`, title: `${deptLabel(dept)} team`, blocks: [this.leaderboard(`${dept}-board`, 'Team leaderboard', dept, members, data)] });
    }
    return sections;
  }

  private async personTabs(person: Person, roster: Person[], range: Range, tab: string, viewer: Person) {
    // The whole department sets the median, rank and leaderboard, even for a viewer
    // who can only open their own dashboard. Without a department there is no one to compare with.
    const peers = person.departmentId === null ? [person] : roster.filter(p => p.departmentId === person.departmentId);
    const people = peers.some(p => p.id === person.id) ? peers : [...peers, person];
    const data = await this.load(people, range);
    if (tab === 'metrics') return this.deptSections(person.dept, people, data, person);
    return this.progressSections(person, people, data, viewer);
  }

  // ── Data loading ────────────────────────────────────────────────────────

  private async load(people: Person[], range: Range): Promise<Data> {
    const ids = people.map(p => p.id);
    const ctx: Q.Ctx = { ids: Q.idList(ids), range, now: Q.nowLiteral() };
    const [counters, series, targets, loggers] = await Promise.all([
      this.counters(ctx),
      this.series(ctx),
      this.targets(people, range),
      this.store.query<{ uid: number; t_at: string | null }>(Q.loggerStatus(ctx)),
    ]);
    return { range, people, counters, series, targets, loggers: new Map(loggers.map(r => [Number(r.uid), r.t_at])) };
  }

  private async counters(ctx: Q.Ctx): Promise<Map<number, PeriodCounters>> {
    const periodQueries = [
      Q.callCounters, Q.touchCounters, Q.followUpDiscipline, Q.statusCounters, Q.responseCounters, Q.crmCompliance,
      Q.handoffCounters, Q.visitAttendance, Q.salesJourneys, Q.sourcingCounters, Q.verificationCounters, Q.hrCounters, Q.manualTaskCounters,
      Q.leadWorkCounters,
    ];
    const [snapshot, ...results] = await Promise.all([
      this.store.query<Record<string, unknown>>(Q.portfolio(ctx)),
      ...periodQueries.map(q => this.store.query<Record<string, unknown>>(q(ctx))),
    ]);
    const map = new Map<number, PeriodCounters>();
    const slot = (uid: number) => {
      if (!map.has(uid)) map.set(uid, { cur: {}, prev: {} });
      return map.get(uid)!;
    };
    const put = (row: Record<string, unknown>, p: 'cur' | 'prev') => {
      const uid = Number(row.uid);
      if (!Number.isFinite(uid)) return;
      const target = slot(uid)[p];
      for (const [k, v] of Object.entries(row)) {
        if (k === 'uid' || k === 'p') continue;
        target[k] = (target[k] ?? 0) + (Number(v) || 0);
      }
    };
    for (const rows of results) for (const row of rows) put(row, row.p === 'prev' ? 'prev' : 'cur');
    // The portfolio is a snapshot: it belongs to now and to no previous period.
    for (const row of snapshot) put(row, 'cur');
    return map;
  }

  private async series(ctx: Q.Ctx, from?: string, to?: string, bucket?: Range['bucket']): Promise<SeriesMap> {
    const rows = await this.store.query<{ uid: number; t: string; k: string; n: number; connected: number; seconds: number }>(
      Q.activitySeries(ctx, from, to, bucket),
    );
    const map: SeriesMap = new Map();
    for (const r of rows) {
      const uid = Number(r.uid);
      if (!map.has(uid)) map.set(uid, new Map());
      const byT = map.get(uid)!;
      const point = byT.get(r.t) ?? {};
      point[r.k] = (point[r.k] ?? 0) + Number(r.n);
      if (r.k === 'calls') {
        point.connected = (point.connected ?? 0) + Number(r.connected);
        point.talk = (point.talk ?? 0) + Math.round(Number(r.seconds) / 60);
      }
      byT.set(r.t, point);
    }
    return map;
  }

  /** This month's targets for the people, with today's goal derived from pace. */
  private async targets(people: Person[], range: Range): Promise<TargetRow[]> {
    if (!people.length) return [];
    const today = range.today;
    const month = today.slice(0, 7);
    const templates = await this.db.getRepository(TaskTemplate).find({
      where: { assigned_to: In(people.map(p => p.id)), month, status: 'active' },
      relations: { metricTargets: true },
    });
    if (!templates.length) return [];
    const progress = await dailyProgress(this.db, templates);
    const rows: TargetRow[] = [];
    for (const t of templates) {
      const person = people.find(p => p.id === t.assigned_to);
      if (!person) continue;
      for (const target of t.metricTargets ?? []) {
        const monthly = Number(target.monthly_target) || 0;
        if (monthly <= 0) continue;
        const pace = computePace({ monthly, weeks: storedWeeks(target) }, progress.get(t.id)?.get(target.metric_key), month, today);
        rows.push({
          personId: person.id, name: person.name, metric: target.metric_key, label: metricDef(target.metric_key)?.label ?? target.metric_label,
          unit: target.metric_value_type === 'amount' ? 'amount' : 'count', monthly, achieved: pace.achieved,
          expected: pace.expected,
          week: { target: pace.week.target, achieved: pace.week.achieved, number: pace.week.number },
          today: { goal: pace.today.goal, achieved: pace.today.achieved },
          forecast: pace.forecast,
        });
      }
    }
    return rows;
  }

  // ── Building blocks ─────────────────────────────────────────────────────

  private sum(data: Data, ids: number[], p: 'cur' | 'prev') {
    const c: Counters = {};
    for (const id of ids) addCounters(c, data.counters.get(id)?.[p]);
    return c;
  }

  private metric(def: MetricDef, data: Data, ids: number[], peers?: Person[]): MetricOut {
    const cur = this.sum(data, ids, 'cur');
    const prev = this.sum(data, ids, 'prev');
    const value = compute(def, cur, data.range.workingDays);
    const out: MetricOut = {
      key: def.key, label: def.label, fmt: def.fmt, better: def.better, value,
      prev: def.snapshot ? null : compute(def, prev, data.range.prevWorkingDays),
      series: def.series, alert: def.alert, hint: def.hint, snapshot: def.snapshot,
    };
    if (peers && peers.length > 1) {
      const values = peers.map(p => compute(def, data.counters.get(p.id)?.cur ?? {}, data.range.workingDays)).filter((v): v is number => v !== null);
      out.median = median(values);
      out.percentile = value === null ? null : percentile(value, values, def.better);
    }
    return out;
  }

  private kpis(id: string, title: string, keys: string[], data: Data, ids: number[], peers?: Person[], span: Block['span'] = 'full'): Block {
    const metrics = keys.map(k => ALL_DEFS.get(k)).filter((d): d is MetricDef => !!d).map(d => this.metric(d, data, ids, peers));
    return { kind: 'kpis', id, title, span, metrics };
  }

  private buckets(range: Range) {
    if (range.bucket === 'hour') return Array.from({ length: 13 }, (_, i) => String(i + 8));
    const out: string[] = [];
    if (range.bucket === 'week') {
      const start = new Date(range.from);
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
      for (let d = start.toISOString().slice(0, 10); d <= range.to; d = addDays(d, 7)) out.push(d);
      return out;
    }
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) out.push(d);
    return out;
  }

  private trend(id: string, title: string, keys: string[], data: Data, ids: number[], span: Block['span'] = 'twoThirds'): Block {
    const points = this.buckets(data.range).map(t => {
      const v: Record<string, number> = {};
      for (const uid of ids) {
        const point = data.series.get(uid)?.get(t);
        if (point) for (const k of keys) v[k] = (v[k] ?? 0) + (point[k] ?? 0);
      }
      for (const k of keys) v[k] ??= 0;
      return { t, v };
    });
    const series = keys.map(k => ({ key: k, label: SERIES_LABELS[k] ?? k }));
    return { kind: 'trend', id, title, fmt: 'n', span, series, points, bucket: data.range.bucket };
  }

  private async heatmap(id: string, title: string, ids: number[], range: Range, span: Block['span'] = 'half'): Promise<Block> {
    const rows = await this.store.query<{ dow: number; hour: number; calls: number; connected: number }>(
      Q.callHeatmap({ ids: Q.idList(ids), range, now: Q.nowLiteral() }),
    );
    const hours = Array.from({ length: 13 }, (_, i) => i + 8);
    const days = [1, 2, 3, 4, 5, 6];
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const cells = days.map(d => hours.map(h => rows.filter(r => r.dow === d && r.hour === h).reduce((s, r) => s + Number(r.calls), 0)));
    return {
      kind: 'heatmap', id, title, subtitle: 'Calls by weekday and hour (IST)', fmt: 'n', span,
      rows: days.map(d => ({ label: names[d] })), cols: hours.map(h => `${h > 12 ? h - 12 : h}${h >= 12 ? 'p' : 'a'}`), cells,
    };
  }

  private activityCalendar(id: string, people: Person[], data: Data, key: string): Block {
    const cols = this.buckets(data.range);
    const label = (t: string) => data.range.bucket === 'hour' ? `${Number(t) > 12 ? Number(t) - 12 : t}${Number(t) >= 12 ? 'p' : 'a'}` : t.slice(5);
    const rows = people.map(p => ({ label: p.name, personId: p.id }));
    const cells = people.map(p => cols.map(t => data.series.get(p.id)?.get(t)?.[key] ?? 0));
    return {
      kind: 'heatmap', id, title: 'Activity consistency', subtitle: `${SERIES_LABELS[key] ?? key} per person per ${data.range.bucket}`,
      fmt: 'n', span: 'full', rows, cols: cols.map(label), cells,
    };
  }

  // ── Scores and flags ────────────────────────────────────────────────────

  private score(person: Person, data: Data, peers: Person[]): { score: number | null; basis: 'targets' | 'peers' | null; axes: { label: string; value: number }[] } {
    const rows = data.targets.filter(t => t.personId === person.id && t.expected > 0);
    if (rows.length) {
      const axes = rows.map(r => ({ label: r.label, value: Math.round(Math.min(1.5, r.achieved / r.expected) * 100) }));
      const score = Math.round((rows.reduce((s, r) => s + Math.min(1, r.achieved / r.expected), 0) / rows.length) * 100);
      return { score, basis: 'targets', axes };
    }
    const metrics = SCORE_METRICS[person.dept];
    const axes: { label: string; value: number }[] = [];
    let total = 0, weights = 0;
    for (const [key, weight] of metrics) {
      const def = ALL_DEFS.get(key);
      if (!def) continue;
      const values = peers.map(p => compute(def, data.counters.get(p.id)?.cur, data.range.workingDays)).filter((v): v is number => v !== null);
      const mine = compute(def, data.counters.get(person.id)?.cur, data.range.workingDays);
      const pc = mine === null ? null : percentile(mine, values, def.better);
      if (pc === null) continue;
      axes.push({ label: def.label, value: pc });
      total += pc * weight;
      weights += weight;
    }
    return weights ? { score: Math.round(total / weights), basis: 'peers', axes } : { score: null, basis: null, axes };
  }

  private primaryChange(person: Person, data: Data) {
    const key = HEADLINE[person.dept][0];
    const def = ALL_DEFS.get(key);
    if (!def) return null;
    const c = data.counters.get(person.id);
    const a = compute(def, c?.cur, data.range.workingDays);
    const b = compute(def, c?.prev, data.range.prevWorkingDays);
    if (a === null || b === null || b === 0) return null;
    return Math.round(((a - b) / b) * 100);
  }

  private flags(person: Person, data: Data, peers: Person[], top: Set<number>) {
    const flags: string[] = [];
    const c = data.counters.get(person.id);
    if (top.has(person.id)) flags.push('top');
    if (data.targets.some(t => t.personId === person.id && t.monthly > 0 && t.expected > t.monthly * 0.2 && t.forecast < t.monthly * 0.8)) flags.push('behind');
    const change = this.primaryChange(person, data);
    const prevActivity = (c?.prev.calls ?? 0) + (c?.prev.touches ?? 0) + (c?.prev.src_added ?? 0);
    if (change !== null && change <= -25 && prevActivity >= 8) flags.push('slowing');
    const loads = peers.map(p => data.counters.get(p.id)?.cur.open ?? 0).filter(n => n > 0);
    const m = median(loads) ?? 0;
    if (m >= 5 && (c?.cur.open ?? 0) >= m * 1.8) flags.push('overloaded');
    if ((c?.cur.neglected ?? 0) >= 10) flags.push('neglecting');
    const synced = data.loggers.get(person.id);
    if (data.loggers.has(person.id) && (!synced || Date.parse(synced.replace(' ', 'T') + 'Z') < Date.now() - 86_400_000)) flags.push('logger-offline');
    const activity = (c?.cur.calls ?? 0) + (c?.cur.touches ?? 0) + (c?.cur.src_added ?? 0) + (c?.cur.ver_done ?? 0) + (c?.cur.hr_apps ?? 0) + (c?.cur.manual_logged ?? 0) + (c?.cur.status_changes ?? 0);
    if (!activity) flags.push('no-activity');
    return flags;
  }

  private leaderboard(id: string, title: string, dept: DeptKey, people: Person[], data: Data, peersFor = people, keys = HEADLINE[dept].slice(0, 6)): Block {
    const defs = keys.map(k => ALL_DEFS.get(k)!).filter(Boolean);
    const scored = people.map(p => ({ p, s: this.score(p, data, peersFor.filter(x => x.dept === p.dept)) }));
    const top = new Set(scored.filter(x => x.s.score !== null).sort((a, b) => b.s.score! - a.s.score!).slice(0, Math.min(3, Math.ceil(people.length / 3))).map(x => x.p.id));
    const rows: LeaderRow[] = scored.map(({ p, s }) => ({
      personId: p.id, name: p.name, avatar: p.avatar, role: p.role, score: s.score, scoreBasis: s.basis,
      change: this.primaryChange(p, data),
      values: Object.fromEntries(defs.map(d => [d.key, compute(d, data.counters.get(p.id)?.cur, data.range.workingDays)])),
      flags: this.flags(p, data, peersFor.filter(x => x.dept === p.dept), top),
    })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
    return { kind: 'leaderboard', id, title, span: 'full', columns: defs.map(d => ({ key: d.key, label: d.label, fmt: d.fmt, better: d.better })), rows };
  }

  private async queue(id: string, title: string, people: Person[], range: Range, limit = 40): Promise<Block> {
    const rows = await this.store.query<{ id: number; name: string; status: string; ownerId: number; due: string | null; reason: string; idleDays: number }>(
      Q.attentionQueue({ ids: Q.idList(people.map(p => p.id)), range, now: Q.nowLiteral() }, limit),
    );
    const names = new Map(people.map(p => [p.id, p.name]));
    return {
      kind: 'queue', id, title, span: 'full',
      items: rows.map(r => ({ ...r, id: Number(r.id), ownerId: Number(r.ownerId), idleDays: Number(r.idleDays), owner: names.get(Number(r.ownerId)), status: r.status ?? 'New Lead' })),
    };
  }

  // ── Department metrics ──────────────────────────────────────────────────

  private async deptSections(dept: DeptKey, people: Person[], data: Data, focus: Person | null): Promise<Section[]> {
    const ids = focus ? [focus.id] : people.map(p => p.id);
    const peers = focus ? people.filter(p => p.dept === focus.dept) : undefined;
    const ctx: Q.Ctx = { ids: Q.idList(ids), range: data.range, now: Q.nowLiteral() };
    const defs = DEPT_METRICS[dept];
    const charts: Block[] = [];
    const c = this.sum(data, ids, 'cur');

    if (dept === 'telecalling' || dept === 'sales' || dept === 'other' || dept === 'collection') {
      charts.push(await this.heatmap(`${dept}-heatmap`, 'Calls by time of day', ids, data.range));
    }
    if (dept === 'telecalling') {
      charts.push({
        kind: 'funnel', id: 'tc-funnel', title: 'Lead progression', subtitle: 'Leads moved by the team in the period', span: 'half',
        stages: [
          { label: 'Contacted', value: c.leads_contacted ?? 0 },
          { label: 'Qualified', value: c.ev_qualified ?? 0, href: leadsHref({ status: 'Qualified' }) },
          { label: 'Visit scheduled', value: c.ev_sv_sched ?? 0, href: leadsHref({ status: 'Site Visit Scheduled' }) },
          { label: 'Visit completed', value: c.ev_sv_done ?? 0, href: leadsHref({ status: 'Site Visit Completed' }) },
        ],
      });
      charts.push(this.followUpBars(people, data, focus));
    }
    if (dept === 'sales') {
      const mix = await this.store.query<{ label: string; value: number }>(Q.statusMix(ctx));
      charts.push({
        kind: 'funnel', id: 'sales-pipeline', title: 'Sales pipeline by stage', subtitle: 'Current leads owned', span: 'half',
        stages: SALES_STAGES.slice(5).map(s => ({ label: s, value: Number(mix.find(m => m.label === s)?.value ?? 0), href: leadsHref({ status: s }) })),
      });
      const visits = (c.ev_sv_done ?? 0) + (c.ev_rsv_done ?? 0);
      charts.push({
        kind: 'bars', id: 'sales-conversion', title: 'Stage-wise conversion', subtitle: 'Share moving to the next stage in the period', fmt: 'pct', span: 'half',
        bars: [
          { label: 'Contacted → qualified', value: pctOf(c.ev_qualified, c.leads_contacted) },
          { label: 'Shared → visit', value: pctOf(c.shared_to_visit, c.shared_leads) },
          { label: 'Visit → negotiation', value: pctOf(c.ev_nego, visits) },
          { label: 'Negotiation → booking', value: pctOf(c.ev_booked, c.ev_nego) },
          { label: 'Visit → booking', value: pctOf(c.ev_booked, visits) },
        ],
      });
      charts.push({
        kind: 'bars', id: 'sales-ageing', title: 'Opportunity ageing', subtitle: 'Open sales leads by days in their current stage', fmt: 'n', span: 'half',
        bars: [
          { label: '0–7 days', value: c.age_0_7 ?? 0, tone: 'good' }, { label: '8–14 days', value: c.age_8_14 ?? 0 },
          { label: '15–30 days', value: c.age_15_30 ?? 0, tone: 'warn' }, { label: '30+ days', value: c.age_30_plus ?? 0, tone: 'bad' },
        ],
      });
      const reasons = await this.store.query<{ label: string; value: number }>(Q.lossReasons(ctx));
      charts.push({ kind: 'donut', id: 'sales-loss', title: 'Loss reasons', subtitle: 'Leads dropped in the period', span: 'half', centerLabel: 'Dropped', slices: reasons.map(r => ({ label: r.label, value: Number(r.value) })) });
    }
    if (dept === 'telecalling') {
      const mix = await this.store.query<{ label: string; value: number }>(Q.statusMix(ctx));
      charts.push({ kind: 'donut', id: 'tc-status', title: 'Lead status distribution', subtitle: 'All leads owned', span: 'half', centerLabel: 'Leads', slices: mix.map(m => ({ label: m.label, value: Number(m.value), href: leadsHref({ status: m.label }) })) });
    }
    if (dept === 'sourcing') {
      const mix = await this.store.query<{ dim: string; label: string; value: number }>(Q.sourcingMix(ctx));
      const area = mix.filter(m => m.dim === 'area').sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 12);
      charts.push({ kind: 'bars', id: 'src-area', title: 'Area-wise sourcing', subtitle: 'Listings sourced per locality', fmt: 'n', span: 'half', bars: area.map(a => ({ label: a.label, value: Number(a.value) })) });
      charts.push({ kind: 'donut', id: 'src-type', title: 'Property type distribution', span: 'half', centerLabel: 'Listings', slices: mix.filter(m => m.dim === 'type').map(m => ({ label: m.label, value: Number(m.value) })) });
      const sd = await this.store.query<{ label: string; demand: number; supply: number }>(Q.supplyDemand(ctx));
      charts.push({
        kind: 'bars', id: 'src-gaps', title: 'Inventory gaps', subtitle: 'Buyer requirements (90 days) against available listings, by type', fmt: 'n', span: 'half',
        valueLabel: 'Requirements', secondaryLabel: 'Listings',
        bars: sd.map(r => ({ label: r.label, value: Number(r.demand), secondary: Number(r.supply), tone: Number(r.supply) < Number(r.demand) / 2 ? 'bad' : undefined })),
      });
      charts.push({
        kind: 'funnel', id: 'src-verify', title: 'Verification pipeline', subtitle: 'Listings sourced in the period and where they stand', span: 'half',
        stages: [
          { label: 'Sourced', value: c.src_added ?? 0 },
          { label: 'Verified', value: c.src_verified ?? 0 },
          { label: 'Not available', value: c.src_rejected ?? 0 },
        ],
      });
    }
    if (dept === 'hr') {
      const mix = await this.store.query<{ dim: string; label: string; value: number; joined: number }>(Q.hrMix(ctx));
      charts.push({
        kind: 'funnel', id: 'hr-pipeline', title: 'Recruitment pipeline', subtitle: 'Candidates at each stage now', span: 'half',
        stages: HR_STAGES.map(s => ({ label: s, value: Number(mix.find(m => m.dim === 'status' && m.label === s)?.value ?? 0) })),
      });
      charts.push({
        kind: 'bars', id: 'hr-sources', title: 'Recruitment source effectiveness', subtitle: 'Applications in the period, and how many joined', fmt: 'n', span: 'half',
        valueLabel: 'Applications', secondaryLabel: 'Joined',
        bars: mix.filter(m => m.dim === 'source').map(m => ({ label: m.label, value: Number(m.value), secondary: Number(m.joined) })),
      });
    }
    if (dept === 'digital') {
      charts.push(...(await this.sourceQuality(data.range, 'half')));
    }

    const headline = this.kpis(`${dept}-kpis`, 'Key metrics', HEADLINE[dept], data, ids, peers);
    const trendKeys = DEPT_SERIES[dept];
    const sections: Section[] = [
      { id: 'key', title: focus ? `${focus.name} · ${deptLabel(dept)}` : deptLabel(dept), blocks: [headline] },
      { id: 'trend', title: 'Trends', blocks: [this.trend(`${dept}-trend`, 'Activity trend', trendKeys, data, ids), this.radarOrMix(dept, focus, people, data)] },
    ];
    if (charts.length) sections.push({ id: 'charts', title: 'Breakdown', blocks: charts });
    const targetRows = data.targets.filter(t => ids.includes(t.personId));
    if (targetRows.length) sections.push({ id: 'targets', title: 'Targets this month', blocks: [{ kind: 'targets', id: `${dept}-targets`, title: 'Target achievement', span: 'full', rows: targetRows, personal: !!focus }] });
    sections.push({ id: 'all', title: 'All metrics', blocks: [{ kind: 'table', id: `${dept}-table`, title: 'Every metric', subtitle: focus ? 'Compared with the previous period and the department median' : 'Compared with the previous period', span: 'full', metrics: defs.map(d => this.metric(d, data, ids, peers)) }] });
    return sections;
  }

  private radarOrMix(dept: DeptKey, focus: Person | null, people: Person[], data: Data): Block {
    if (focus) {
      const s = this.score(focus, data, people.filter(p => p.dept === focus.dept));
      return { kind: 'radar', id: `${dept}-radar`, title: 'Performance profile', subtitle: s.basis === 'targets' ? 'Target pace per metric (100 = on pace)' : 'Percentile against the department', span: 'third', axes: s.axes };
    }
    const c = this.sum(data, people.map(p => p.id), 'cur');
    return {
      kind: 'donut', id: `${dept}-channels`, title: 'Activity mix', span: 'third', centerLabel: 'Actions',
      slices: [
        { label: 'Calls', value: c.calls ?? 0 }, { label: 'Messages', value: c.messages ?? 0 },
        { label: 'Follow-ups', value: c.followups_logged ?? 0 }, { label: 'Shares', value: c.shares ?? 0 },
        { label: 'Listings', value: c.src_added ?? 0 }, { label: 'Status moves', value: c.status_changes ?? 0 },
      ].filter(s => s.value > 0),
    };
  }

  private followUpBars(people: Person[], data: Data, focus: Person | null): Block {
    const rows = (focus ? [focus] : people).map(p => {
      const c = data.counters.get(p.id)?.cur ?? {};
      return { label: p.name, personId: p.id, values: { ontime: c.fu_ontime ?? 0, late: c.fu_late ?? 0, overdue: c.fu_overdue ?? 0, pending: c.fu_pending_today ?? 0 } };
    }).filter(r => Object.values(r.values).some(v => v > 0));
    return {
      kind: 'stacked', id: 'fu-stacked', title: 'Follow-ups due', subtitle: 'Follow-ups falling due in the period', fmt: 'n', span: 'half',
      keys: [{ key: 'ontime', label: 'On time' }, { key: 'late', label: 'Late' }, { key: 'overdue', label: 'Overdue' }, { key: 'pending', label: 'Due today' }],
      rows,
    };
  }

  /** New leads in the period per source (99acres, website…), with how many were booked. */
  private sourceBars(id: string, rows: Record<string, number | string>[], span: Block['span']): Block {
    const sorted = rows.map(r => ({ label: String(r.source), value: Number(r.leads ?? 0), secondary: Number(r.booked ?? 0) }))
      .filter(r => r.value > 0).sort((a, b) => b.value - a.value);
    const shown = sorted.length > 12 ? sorted.slice(0, 11) : sorted;
    const rest = sorted.slice(shown.length);
    const bars: Bar[] = shown.map(r => ({ ...r, href: leadsHref({ source: r.label }) }));
    if (rest.length) bars.push({ label: `Other (${rest.length} sources)`, value: rest.reduce((n, r) => n + r.value, 0), secondary: rest.reduce((n, r) => n + r.secondary, 0) });
    return {
      kind: 'bars', id, title: 'Leads by source', subtitle: `${sorted.reduce((n, r) => n + r.value, 0)} new leads in the period, and how many were booked`,
      fmt: 'n', span, valueLabel: 'Leads', secondaryLabel: 'Booked', bars,
    };
  }

  private async sourceQuality(range: Range, span: Block['span']): Promise<Block[]> {
    const rows = await this.store.query<{ source: string; leads: number; contacted: number; qualified: number; sv_sched: number; sv_done: number; nego: number; booked: number }>(
      Q.leadCohort({ ids: 'NULL', range, now: Q.nowLiteral() }),
    );
    const top = rows.slice(0, 8);
    return [
      { kind: 'donut', id: 'src-contribution', title: 'Lead source contribution', subtitle: 'Leads created in the period', span, centerLabel: 'Leads', slices: rows.map(r => ({ label: r.source, value: Number(r.leads), href: leadsHref({ source: r.source }) })) },
      {
        kind: 'stacked', id: 'src-quality', title: 'Lead quality by source', subtitle: 'How far the period’s new leads got', fmt: 'n', span,
        keys: [{ key: 'booked', label: 'Booked' }, { key: 'visited', label: 'Visited' }, { key: 'qualified', label: 'Qualified' }, { key: 'contacted', label: 'Contacted only' }, { key: 'untouched', label: 'Not contacted' }],
        rows: top.map(r => ({
          label: r.source,
          values: {
            booked: Number(r.booked), visited: Math.max(0, Number(r.sv_done) - Number(r.booked)),
            qualified: Math.max(0, Number(r.qualified) - Number(r.sv_done)), contacted: Math.max(0, Number(r.contacted) - Number(r.qualified)),
            untouched: Math.max(0, Number(r.leads) - Number(r.contacted)),
          },
        })),
      },
    ];
  }

  // ── Team (Team Lead view, and each department in the business view) ─────

  private async teamSections(dept: DeptKey, people: Person[], data: Data, viewer: Person | null): Promise<Section[]> {
    const ids = people.map(p => p.id);
    const cur = this.sum(data, ids, 'cur');
    const prev = this.sum(data, ids, 'prev');
    const attainment = this.attainment(data.targets.filter(t => ids.includes(t.personId)));
    const scores = people.map(p => this.score(p, data, people)).map(s => s.score).filter((s): s is number => s !== null);
    const teamTiles: MetricOut[] = [
      { key: 'attainment', label: 'Department target achievement', fmt: 'pct', better: 'up', value: attainment, prev: null, hint: 'Achieved against where targets should be by today', snapshot: true },
      { key: 'avg_score', label: 'Average performance score', fmt: 'score', better: 'up', value: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, prev: null, snapshot: true },
      this.metric(ALL_DEFS.get('ontime')!, data, ids),
      this.metric(ALL_DEFS.get('fu_overdue')!, data, ids),
      this.metric(ALL_DEFS.get('neglected')!, data, ids),
      this.metric(ALL_DEFS.get('sla')!, data, ids),
    ];
    const board = this.leaderboard(`${dept}-board`, 'Team leaderboard', dept, people, data);
    const rows = (board as Extract<Block, { kind: 'leaderboard' }>).rows;
    const insights: Insight[] = [
      ...rows.filter(r => r.flags.includes('top')).map(r => ({ tone: 'good' as const, title: `${r.name} is leading the team`, detail: `Performance score ${r.score}${r.scoreBasis === 'targets' ? ' on target pace' : ' against peers'}.`, personId: r.personId })),
      ...targetInsights(data.targets.filter(t => ids.includes(t.personId)), this.monthFraction(data.range)),
      ...rows.filter(r => r.flags.includes('slowing')).map(r => ({ tone: 'bad' as const, title: `${r.name} is slowing down`, detail: `Main activity is ${r.change}% against the previous period.`, personId: r.personId })),
      ...workloadInsights(people, new Map(people.map(p => [p.id, data.counters.get(p.id)?.cur.open ?? 0]))),
      ...rows.filter(r => r.flags.includes('logger-offline')).map(r => ({ tone: 'warn' as const, title: `${r.name}'s call logger is not syncing`, detail: 'Calls from this phone are missing, so call metrics understate the work.', personId: r.personId })),
      ...outlierInsights(people, new Map(people.map(p => [p.id, new Map(DEPT_METRICS[dept].map(d => [d.key, compute(d, data.counters.get(p.id)?.cur, data.range.workingDays)]))])), DEPT_METRICS[dept].filter(d => HEADLINE[dept].includes(d.key))),
      ...changeInsights(dept, DEPT_METRICS[dept], cur, prev, data.range.workingDays, data.range.prevWorkingDays, 'Team'),
    ].slice(0, 9);

    const targetBars: Bar[] = people.flatMap((p): Bar[] => {
      const a = this.attainment(data.targets.filter(t => t.personId === p.id));
      return a === null ? [] : [{ label: p.name, value: a, personId: p.id, tone: a >= 100 ? 'good' : a < 70 ? 'bad' : 'warn' }];
    });
    const workload: Block = {
      kind: 'stacked', id: `${dept}-workload`, title: 'Workload distribution', subtitle: 'Open leads per person now', fmt: 'n', span: 'half',
      keys: [{ key: 'healthy', label: 'On track' }, { key: 'overdue', label: 'Overdue' }, { key: 'neglected', label: 'Unattended 7d+' }],
      rows: people.map(p => {
        const c = data.counters.get(p.id)?.cur ?? {};
        const overdue = c.overdue ?? 0, neglected = Math.max(0, (c.neglected ?? 0) - overdue);
        return { label: p.name, personId: p.id, values: { healthy: Math.max(0, (c.open ?? 0) - overdue - neglected), overdue, neglected } };
      }).filter(r => Object.values(r.values).some(v => v > 0)),
    };
    const respBars: Block = {
      kind: 'bars', id: `${dept}-sla`, title: 'SLA compliance by person', subtitle: 'Assigned leads touched within 1 working hour', fmt: 'pct', span: 'half',
      bars: people.map(p => {
        const c = data.counters.get(p.id)?.cur ?? {};
        return { label: p.name, personId: p.id, value: pctOf(c.resp_sla_n, c.assigned_n), secondary: c.assigned_n ?? 0 };
      }).filter(b => (b.secondary ?? 0) > 0),
    };

    const sections: Section[] = [
      { id: 'team-key', title: `${deptLabel(dept)} team`, blocks: [{ kind: 'kpis', id: `${dept}-team-kpis`, title: 'Team health', span: 'full', metrics: teamTiles }] },
      { id: 'insights', title: 'What needs attention', blocks: [{ kind: 'insights', id: `${dept}-insights`, title: 'Highlights and risks', span: 'full', items: insights }] },
      { id: 'board', title: 'People', blocks: [board] },
      {
        id: 'team-charts', title: 'Team breakdown', blocks: [
          ...(targetBars.length ? [{ kind: 'bars', id: `${dept}-target-bars`, title: 'Target vs actual', subtitle: 'Achieved against today’s expected pace', fmt: 'pct', span: 'half', bars: targetBars } as Block] : []),
          workload,
          ...(respBars.kind === 'bars' && respBars.bars.length ? [respBars] : []),
          this.trend(`${dept}-team-trend`, 'Team productivity trend', DEPT_SERIES[dept], data, ids, 'half'),
          this.activityCalendar(`${dept}-calendar`, people, data, PRIMARY[dept]),
          ...(dept === 'telecalling' || dept === 'sales'
            ? [this.sourceBars(`${dept}-sources`, await this.store.query<Record<string, number | string>>(Q.leadCohort({ ids: 'NULL', range: data.range, now: Q.nowLiteral() }, Q.idList(ids))), 'half')]
            : []),
        ],
      },
      { id: 'queue', title: 'Unattended and overdue records', blocks: [await this.queue(`${dept}-queue`, 'Leads needing action', people, data.range)] },
    ];
    if (viewer && viewer.role === 'Team Lead' && people.some(p => p.id === viewer.id)) {
      const own = data.targets.filter(t => t.personId === viewer.id);
      sections.push({
        id: 'own', title: 'Your own work', blocks: [
          this.kpis('own-kpis', 'Your activity', HEADLINE[dept].slice(0, 4), data, [viewer.id], people, own.length ? 'half' : 'full'),
          ...(own.length ? [{ kind: 'targets', id: 'own-targets', title: 'Your targets', span: 'half', rows: own, personal: true } as Block] : []),
        ],
      });
    }
    return sections;
  }

  private monthFraction(range: Range) {
    const month = range.today.slice(0, 7);
    const start = `${month}-01`;
    const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const total = workingDaysBetween(start, end);
    return total ? workingDaysBetween(start, range.today) / total : 0;
  }

  /** Achieved against where targets should be by today, across count targets, capped per target. */
  private attainment(rows: TargetRow[]) {
    const counted = rows.filter(r => r.unit === 'count' && r.expected > 0);
    if (!counted.length) return null;
    return Math.round((counted.reduce((s, r) => s + Math.min(1.5, r.achieved / r.expected), 0) / counted.length) * 100);
  }

  // ── Person: progress, gamified ──────────────────────────────────────────

  private async progressSections(person: Person, peers: Person[], data: Data, viewer: Person): Promise<Section[]> {
    const dept = person.dept;
    const deptPeers = peers.filter(p => p.dept === dept);
    const s = this.score(person, data, deptPeers);
    const scores = deptPeers.map(p => ({ id: p.id, s: this.score(p, data, deptPeers).score })).filter(x => x.s !== null).sort((a, b) => b.s! - a.s!);
    const rank = scores.findIndex(x => x.id === person.id);
    const targets = data.targets.filter(t => t.personId === person.id);
    const history = await this.history(person, data.range);
    const primary = PRIMARY[dept];
    const dailyGoal = this.dailyThreshold(primary, targets);
    const streak = this.streak(history, primary, dailyGoal, data.range.today);
    const best = this.best(history, primary, data.range.today);

    const defs = DEPT_METRICS[dept].filter(d => d.better !== 'none');
    const measured = defs.map(d => this.metric(d, data, [person.id], deptPeers)).filter(m => m.value !== null && m.percentile !== null && m.percentile !== undefined);
    const strengths = [...measured].sort((a, b) => b.percentile! - a.percentile!).filter(m => m.percentile! >= 60).slice(0, 3);
    const weaknesses = [...measured].sort((a, b) => a.percentile! - b.percentile!).filter(m => m.percentile! <= 40).slice(0, 3);

    const c = data.counters.get(person.id)?.cur ?? {};
    const firstSteps = await gettingStarted(this.db, person.id).catch(() => null);
    const achievements = this.achievements(person, targets, history, streak, best, c, data.range, firstSteps);
    const hero: ProgressHero = {
      score: s.score, scoreBasis: s.basis, rank: rank >= 0 ? rank + 1 : null, rankOf: scores.length,
      streak: { days: streak, metric: SERIES_LABELS[primary] ?? primary },
      best: { ...best, metric: SERIES_LABELS[primary] ?? primary },
      achievements, strengths, weaknesses, change: this.primaryChange(person, data),
    };
    const met = targets.filter(t => t.achieved >= t.monthly).length;
    const behind = targets.filter(t => t.achieved < t.expected * 0.9).length;
    const attainment = this.attainment(targets);
    const activityPerDay = data.range.workingDays ? ((c.calls ?? 0) + (c.followups_logged ?? 0) + (c.src_added ?? 0) + (c.ver_done ?? 0) + (c.status_changes ?? 0) + (c.manual_logged ?? 0)) / data.range.workingDays : null;
    const shared: MetricOut[] = [
      { key: 'targets_assigned', label: 'Targets assigned', fmt: 'n', better: 'none', value: targets.length, prev: null, snapshot: true },
      { key: 'targets_met', label: 'Targets completed', fmt: 'n', better: 'up', value: met, prev: null, snapshot: true },
      { key: 'targets_behind', label: 'Targets behind pace', fmt: 'n', better: 'down', value: behind, prev: null, snapshot: true, alert: true },
      { key: 'attainment', label: 'Target achievement rate', fmt: 'pct', better: 'up', value: attainment, prev: null, snapshot: true, hint: 'Achieved against where targets should be by today' },
      this.metric(ALL_DEFS.get('ontime')!, data, [person.id], deptPeers),
      { key: 'activity_per_day', label: 'Avg activity per working day', fmt: 'avg', better: 'up', value: activityPerDay, prev: null },
      this.metric(ALL_DEFS.get('first_resp')!, data, [person.id], deptPeers),
      { key: 'change', label: 'Performance vs previous period', fmt: 'pct', better: 'up', value: hero.change, prev: null, hint: `Change in ${ALL_DEFS.get(HEADLINE[dept][0])?.label.toLowerCase()}` },
    ];
    const viewingSelf = viewer.id === person.id;
    const sections: Section[] = [
      { id: 'hero', title: viewingSelf ? `Good to see you, ${person.name.split(' ')[0]}` : person.name, blocks: [{ kind: 'progress', id: 'hero', title: 'Progress', span: 'full', hero }] },
    ];
    if (deptPeers.length > 1) {
      sections.push({ id: 'team-board', title: viewingSelf ? 'Your team' : `${deptLabel(dept)} team`, description: 'Everyone in the department, ranked on the same score.', blocks: [this.leaderboard('dept-board', `${deptLabel(dept)} leaderboard`, dept, deptPeers, data)] });
    }
    if (targets.length) sections.push({ id: 'targets', title: 'Targets', blocks: [{ kind: 'targets', id: 'my-targets', title: 'Today, this week and this month', span: 'full', rows: targets, personal: true }] });
    sections.push(
      { id: 'shared', title: 'At a glance', blocks: [{ kind: 'kpis', id: 'shared-kpis', title: 'Work summary', span: 'full', metrics: shared }] },
      {
        id: 'trend', title: 'Your trend', blocks: [
          this.trend('person-trend', 'Personal productivity', DEPT_SERIES[dept], data, [person.id]),
          { kind: 'radar', id: 'person-radar', title: 'Performance profile', subtitle: s.basis === 'targets' ? 'Target pace per metric (100 = on pace)' : 'Percentile against the department', span: 'third', axes: s.axes },
        ],
      },
      { id: 'actions', title: 'Priority actions', blocks: [await this.queue('person-queue', 'Leads to work next', [person], data.range, 15)] },
    );
    return sections;
  }

  /** The person's daily activity over the last 180 days, for streaks and personal bests. */
  private async history(person: Person, range: Range) {
    const from = addDays(range.today, -179);
    const map = await this.series({ ids: Q.idList([person.id]), range, now: Q.nowLiteral() }, from, range.today, 'day');
    const manual = await this.store.query<{ d: string; n: number }>(
      `SELECT CAST(logged_date AS VARCHAR) AS d, SUM(count_value) AS n FROM task_activity_logs WHERE logged_by = ${Math.trunc(person.id)} AND logged_date >= DATE '${from}' GROUP BY 1`,
    );
    const days = map.get(person.id) ?? new Map<string, Record<string, number>>();
    for (const m of manual) days.set(m.d, { ...(days.get(m.d) ?? {}), tasks: Number(m.n) });
    return days;
  }

  private dailyThreshold(primary: string, targets: TargetRow[]) {
    const metric = primary === 'calls' ? 'call_count' : primary === 'sourced' ? 'properties_sourced' : null;
    const t = metric ? targets.find(x => x.metric === metric) : undefined;
    return t && t.monthly > 0 ? Math.max(1, Math.round(t.monthly / 26)) : 1;
  }

  private streak(history: Map<string, Record<string, number>>, key: string, goal: number, today: string) {
    let day = (history.get(today)?.[key] ?? 0) >= goal ? today : addDays(today, -1);
    let n = 0;
    for (let i = 0; i < 180; i++) {
      if (isWorkingDay(day)) {
        if ((history.get(day)?.[key] ?? 0) >= goal) n++;
        else break;
      }
      day = addDays(day, -1);
    }
    return n;
  }

  private best(history: Map<string, Record<string, number>>, key: string, today: string) {
    let value = 0, date: string | null = null;
    for (const [d, v] of history) {
      if (d === today) continue;
      if ((v[key] ?? 0) > value) { value = v[key]; date = d; }
    }
    return { value, date, today: history.get(today)?.[key] ?? 0 };
  }

  private achievements(person: Person, targets: TargetRow[], history: Map<string, Record<string, number>>, streak: number, best: { value: number; today: number }, c: Counters, range: Range, firstSteps: ChecklistItem[] | null = null): Achievement[] {
    const month = range.today.slice(0, 7);
    const week = taskWeek(range.today);
    const list: Omit<Achievement, 'celebrate'>[] = [];
    const goals = targets.filter(t => t.today.goal > 0);
    list.push({ key: 'daily-goal', period: range.today, title: 'Daily goal met', detail: goals.length ? `All ${goals.length} of today’s goals done` : 'No goals set for today', unlocked: goals.length > 0 && goals.every(t => t.today.achieved >= t.today.goal) });
    for (const t of targets) {
      if (t.week.target > 0) list.push({ key: `weekly-${t.metric}`, period: `${month}-w${week}`, title: `Weekly target: ${t.label}`, detail: `${Math.round(t.week.achieved)} of ${Math.round(t.week.target)} this week`, unlocked: t.week.achieved >= t.week.target });
      list.push({ key: `monthly-${t.metric}`, period: month, title: `Monthly target: ${t.label}`, detail: `${Math.round(t.achieved)} of ${Math.round(t.monthly)} this month`, unlocked: t.achieved >= t.monthly });
    }
    if (person.dept === 'sales' || person.dept === 'telecalling') {
      const bookings = [...history].filter(([d]) => d.startsWith(month)).reduce((s, [, v]) => s + (v.booked ?? 0), 0);
      const visits = [...history].filter(([d]) => d.startsWith(month)).reduce((s, [, v]) => s + (v.sv_sched ?? 0), 0);
      if (person.dept === 'sales') list.push({ key: 'first-booking', period: month, title: 'First booking of the month', detail: bookings ? `${bookings} booking${bookings > 1 ? 's' : ''} this month` : 'No booking yet this month', unlocked: bookings > 0 });
      else list.push({ key: 'first-visit', period: month, title: 'First site visit of the month', detail: visits ? `${visits} visit${visits > 1 ? 's' : ''} scheduled this month` : 'No visit scheduled yet', unlocked: visits > 0 });
    }
    list.push({ key: 'personal-best', period: range.today, title: 'Personal best day', detail: best.value ? `Best so far: ${best.value}` : 'Your first full day sets the bar', unlocked: best.value > 0 && best.today > best.value });
    for (const n of [5, 10, 20]) {
      list.push({ key: `streak-${n}`, period: addDays(range.today, -streak), title: `${n}-day streak`, detail: `${streak} working day${streak === 1 ? '' : 's'} in a row`, unlocked: streak >= n });
    }
    if ((c.responded_n ?? 0) >= 3) {
      const avg = (c.resp_min_sum ?? 0) / (c.responded_n ?? 1);
      list.push({ key: 'fast-responder', period: range.from, title: 'Fast responder', detail: `Average first response ${Math.round(avg)} min`, unlocked: avg <= 15 });
    }
    if ((c.open ?? 0) >= 5) list.push({ key: 'clean-sheet', period: range.today, title: 'Clean sheet', detail: c.overdue ? `${c.overdue} overdue follow-ups` : 'No overdue follow-ups', unlocked: !c.overdue });
    if (firstSteps) {
      const done = firstSteps.filter(i => i.done).length;
      list.push({ key: 'getting-started', period: 'once', title: 'Getting started', detail: `${done} of ${firstSteps.length} first steps`, unlocked: done === firstSteps.length });
    }
    return list.map(a => ({ ...a, celebrate: false }));
  }

  /** Sets `celebrate` on unlocked achievements this viewer has not seen on their own dashboard. */
  private async markCelebrations(viewer: Person, sections: Section[]) {
    const heroes = sections.flatMap(s => s.blocks).filter((b): b is Extract<Block, { kind: 'progress' }> => b.kind === 'progress');
    if (!heroes.length) return;
    const own = sections.some(s => s.id === 'hero' && s.title.startsWith('Good to see you'));
    let seen = new Set<string>();
    if (own) {
      try {
        const rows: { achievement_key: string; period: string }[] = await this.db.query(
          'SELECT achievement_key, period FROM staff_achievements WHERE user_id = ?', [viewer.id]);
        seen = new Set(rows.map(r => `${r.achievement_key}|${r.period}`));
      } catch {
        // Without the table nobody is celebrated, rather than everyone every time.
        seen = new Set(heroes.flatMap(h => h.hero.achievements.map(a => `${a.key}|${a.period}`)));
      }
    }
    for (const h of heroes) {
      h.hero.achievements = h.hero.achievements.map(a => ({ ...a, celebrate: own && a.unlocked && !seen.has(`${a.key}|${a.period}`) }));
    }
  }

  async markSeen(viewer: Viewer, items: { key: string; period: string }[]) {
    const clean = items.filter(i => /^[a-z0-9_-]{1,80}$/.test(i.key) && /^[0-9a-z-]{1,20}$/.test(i.period)).slice(0, 50);
    if (!clean.length) return { saved: 0 };
    await this.db.query(
      `INSERT IGNORE INTO staff_achievements (user_id, achievement_key, period) VALUES ${clean.map(() => '(?, ?, ?)').join(', ')}`,
      clean.flatMap(i => [viewer.id, i.key, i.period]),
    );
    return { saved: clean.length };
  }

  // ── People (business view) ──────────────────────────────────────────────

  private async peopleTab(visible: Person[], range: Range): Promise<Section[]> {
    const data = await this.load(visible, range);
    const sections: Section[] = [];
    for (const d of DEPARTMENTS) {
      const members = visible.filter(p => p.dept === d.key);
      if (!members.length) continue;
      sections.push({ id: `people-${d.key}`, title: d.label, blocks: [this.leaderboard(`board-${d.key}`, `${d.label} leaderboard`, d.key, members, data)] });
    }
    const points = visible.map(p => {
      const c = data.counters.get(p.id)?.cur ?? {};
      return {
        label: p.name, personId: p.id,
        x: (c.calls ?? 0) + (c.touches ?? 0) + (c.src_added ?? 0) + (c.hr_apps ?? 0) + (c.manual_logged ?? 0),
        y: (c.ev_qualified ?? 0) + (c.ev_sv_sched ?? 0) + (c.ev_sv_done ?? 0) * 2 + (c.ev_booked ?? 0) * 5 + (c.src_verified ?? 0) + (c.ver_done ?? 0) + (c.hr_joined ?? 0) * 3,
      };
    }).filter(p => p.x > 0 || p.y > 0);
    sections.unshift({
      id: 'efficiency', title: 'Activity against outcomes', blocks: [{
        kind: 'scatter', id: 'people-scatter', title: 'Employee activity vs outcome', span: 'full',
        subtitle: 'Top-left works smart, bottom-right is busy without results. Outcomes weight visits ×2, bookings ×5, hires ×3.',
        x: { label: 'Activity (calls, touches, listings, applications, task entries)', fmt: 'n' }, y: { label: 'Outcome points', fmt: 'n' }, points,
      }],
    });
    return sections;
  }

  /** Sourcing done in the period, and how far each property type got through validation and verification. */
  private sourcingBlocks(rows: Record<string, number | string>[]): Block[] {
    const STAGES = [
      { key: 'unchecked', label: 'Awaiting validation' }, { key: 'validated', label: 'Validated' },
      { key: 'verifying', label: 'In verification' }, { key: 'verified', label: 'Verified' }, { key: 'not_available', label: 'Not available' },
    ];
    const total = (p: string, k: string) => rows.filter(r => r.p === p).reduce((s, r) => s + Number(r[k] ?? 0), 0);
    // Validated means the owner confirmed it: everything that went on to verification counts too.
    const passed = (p: string) => total(p, 'validated') + total(p, 'verifying') + total(p, 'verified');
    const byType = new Map<string, Record<string, number>>();
    for (const r of rows.filter(r => r.p === 'cur')) {
      const name = String(r.type).replace(/_/g, ' ').trim().toLowerCase();
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      const v = byType.get(label) ?? {};
      for (const k of ['sourced', ...STAGES.map(st => st.key)]) v[k] = (v[k] ?? 0) + Number(r[k] ?? 0);
      byType.set(label, v);
    }
    const tile = (key: string, label: string, value: (p: string) => number | null, fmt: MetricOut['fmt'] = 'n', hint?: string): MetricOut =>
      ({ key, label, fmt, better: 'up', value: value('cur'), prev: value('prev'), hint });
    return [
      { kind: 'kpis', id: 'sourcing-kpis', title: 'Sourcing', span: 'full', metrics: [
        tile('src_done', 'Properties sourced', p => total(p, 'sourced')),
        tile('src_validated', 'Validated', passed, 'n', 'Owner confirmed the property is available, including those sent on to verification'),
        tile('src_verified', 'Verification done', p => total(p, 'verified')),
        tile('src_verified_rate', 'Verified of sourced', p => (total(p, 'sourced') ? pctOf(total(p, 'verified'), total(p, 'sourced')) : null), 'pct'),
      ] },
      {
        kind: 'stacked', id: 'sourcing-types', title: 'Sourcing by property type', subtitle: 'Properties sourced in the period and where each one stands', fmt: 'n', span: 'full',
        keys: STAGES,
        rows: [...byType].sort((a, b) => b[1].sourced - a[1].sourced).slice(0, 10)
          .map(([label, v]) => ({ label, values: Object.fromEntries(STAGES.map(st => [st.key, v[st.key] ?? 0])) })),
      },
    ];
  }

  // ── Business overview (Admin / Manager) ─────────────────────────────────

  private async overview(visible: Person[], range: Range): Promise<Section[]> {
    const data = await this.load(visible, range);
    const ids = visible.map(p => p.id);
    const ctx: Q.Ctx = { ids: Q.idList(ids), range, now: Q.nowLiteral() };
    const cur = this.sum(data, ids, 'cur');
    const prev = this.sum(data, ids, 'prev');
    const [cohort, health, supply, mixRows, forecastCohort, stageRows] = await Promise.all([
      this.store.query<Record<string, number | string>>(Q.leadCohort(ctx)),
      this.store.query<Record<string, number>>(Q.dataHealth(ctx)),
      this.store.query<{ label: string; demand: number; supply: number }>(Q.supplyDemand(ctx)),
      this.store.query<{ label: string; value: number }>(Q.statusMix(ctx)),
      this.store.query<Record<string, number | string>>(Q.leadCohort({ ...ctx, range: { ...range, from: addDays(range.today, -179) } })),
      this.store.query<Record<string, number | string>>(Q.sourcingStages(ctx)),
    ]);
    const total = (rows: Record<string, number | string>[], k: string) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);

    // Department scorecard.
    const deptBars: Bar[] = [];
    const insights: Insight[] = [];
    for (const d of DEPARTMENTS) {
      const members = visible.filter(p => p.dept === d.key);
      if (!members.length) continue;
      const mids = members.map(p => p.id);
      const attainment = this.attainment(data.targets.filter(t => mids.includes(t.personId)));
      const scores = members.map(p => this.score(p, data, members).score).filter((s): s is number => s !== null);
      const value = attainment ?? (scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null);
      if (value !== null) deptBars.push({ label: d.label, value, tone: value >= 100 ? 'good' : value < 70 ? 'bad' : 'warn', secondary: members.length });
      insights.push(...changeInsights(d.key, DEPT_METRICS[d.key].filter(m => HEADLINE[d.key].includes(m.key)), this.sum(data, mids, 'cur'), this.sum(data, mids, 'prev'), range.workingDays, range.prevWorkingDays, 'Business'));
    }
    insights.push(...targetInsights(data.targets, this.monthFraction(range)).slice(0, 3));

    // Funnel and leakage.
    const stages: [string, string][] = [['Leads created', 'leads'], ['Contacted', 'contacted'], ['Qualified', 'qualified'], ['Visit scheduled', 'sv_sched'], ['Visit completed', 'sv_done'], ['Negotiation', 'nego'], ['Booked', 'booked']];
    const funnel = stages.map(([label, k]) => ({ label, value: total(cohort, k) }));
    const leakage: Bar[] = funnel.slice(1).map((s, i) => ({
      label: `${funnel[i].label} → ${s.label}`, value: funnel[i].value ? Math.round(((funnel[i].value - s.value) / funnel[i].value) * 100) : 0,
      tone: funnel[i].value && (funnel[i].value - s.value) / funnel[i].value > 0.6 ? 'bad' : undefined,
    }));
    const worst = [...leakage].filter(l => l.value > 0).sort((a, b) => b.value - a.value)[0];
    if (worst && funnel[0].value >= MIN_FUNNEL) insights.unshift({ tone: 'bad', title: `Biggest leak: ${worst.label}`, detail: `${worst.value}% of leads created in the period stop at this step.` });
    const unanswered = (cur.assigned_n ?? 0) - (cur.resp_sla_n ?? 0);
    if ((cur.assigned_n ?? 0) >= 10 && unanswered / cur.assigned_n > 0.3) {
      insights.unshift({ tone: 'bad', title: `${Math.round((unanswered / cur.assigned_n) * 100)}% of new leads missed the 1-hour response`, detail: `${unanswered} of ${cur.assigned_n} assignments were not touched within a working hour.` });
    }
    const bySource = cohort.filter(r => Number(r.leads) >= 5).map(r => ({ source: String(r.source), rate: Number(r.sv_sched) / Number(r.leads) }));
    if (bySource.length >= 2) {
      const sorted = [...bySource].sort((a, b) => b.rate - a.rate);
      const [hi, lo] = [sorted[0], sorted[sorted.length - 1]];
      if (hi.rate > 0 && hi.rate >= lo.rate * 2) insights.push({ tone: 'good', title: `${hi.source} leads convert best`, detail: `${Math.round(hi.rate * 100)}% reach a site visit against ${Math.round(lo.rate * 100)}% for ${lo.source}.` });
    }
    insights.push(...workloadInsights(visible.filter(p => p.dept === 'telecalling' || p.dept === 'sales'), new Map(visible.map(p => [p.id, data.counters.get(p.id)?.cur.open ?? 0]))));
    if (health[0]?.loggers_stale) insights.push({ tone: 'warn', title: `${health[0].loggers_stale} call logger${health[0].loggers_stale > 1 ? 's' : ''} stopped syncing`, detail: 'Calls from those phones are missing for the last 24 hours.' });

    // Forecast: open pipeline × historical conversion from each stage to booking.
    const conv = (k: string) => { const n = total(forecastCohort, k); return n ? total(forecastCohort, 'booked') / n : 0; };
    const count = (statuses: string[]) => mixRows.filter(m => statuses.includes(m.label)).reduce((s, m) => s + Number(m.value), 0);
    const forecastBars: Bar[] = [
      { label: 'Qualified / shared', value: round1(count(['Qualified', 'Interested', 'Property Shared']) * conv('qualified')) },
      { label: 'Visit scheduled', value: round1(count(['Site Visit Scheduled']) * conv('sv_sched')) },
      { label: 'Visited', value: round1(count(['Site Visit Completed', 'Re Visit Scheduled', 'Re Visit Completed']) * conv('sv_done')) },
      { label: 'Negotiation', value: round1(count(['Negotiation']) * conv('nego')) },
    ];
    const expected = round1(forecastBars.reduce((s, b) => s + b.value, 0));

    const h = health[0] ?? {};
    const crm = pctOf(cur.crm_updated, cur.crm_calls);
    const loggerShare = h.loggers ? 100 - Math.round((Number(h.loggers_stale) / Number(h.loggers)) * 100) : null;
    const healthScore = [crm, loggerShare, cur.open ? 100 - Math.round(((cur.neglected ?? 0) / cur.open) * 100) : null]
      .filter((v): v is number => v !== null);
    // Two rows of four: the numbers the business is run on. The rest live in their own sections.
    const orgKpis = ['calls_out', 'conn_rate', 'first_resp', 'sla', 'qualified', 'sv_sched', 'bookings'];
    const attainment = this.attainment(data.targets);
    const deptMembers = DEPARTMENTS.map(d => ({ d, members: visible.filter(p => p.dept === d.key) })).filter(x => x.members.length);

    return [
      {
        // The opening section needs no heading: the KPI tiles speak for themselves.
        id: 'health', title: 'Business health', hideHeader: true,
        blocks: [
          { kind: 'kpis', id: 'org-kpis', title: 'Company KPIs', span: 'full', metrics: [
            { key: 'attainment', label: 'Company target achievement', fmt: 'pct', better: 'up', value: attainment, prev: null, snapshot: true, hint: 'All active targets, against where they should be by today' },
            ...orgKpis.map(k => this.metric(ALL_DEFS.get(k)!, data, ids)),
          ] },
          this.trend('org-activity', 'Activity and outcomes', ['calls', 'connected', 'qualified', 'sv_sched', 'booked'], data, ids, 'twoThirds'),
          { kind: 'donut', id: 'org-pipeline', title: 'Lead pipeline', subtitle: 'Every lead by its current status', span: 'third', centerLabel: 'Leads', ring: true,
            slices: mixRows.map(m => ({ label: m.label, value: Number(m.value), href: leadsHref({ status: m.label }) })) },
          { kind: 'insights', id: 'org-insights', title: 'Where the business is shining and lacking', span: 'twoThirds', items: dedupe(insights).slice(0, 8) },
          { kind: 'bars', id: 'dept-performance', title: 'Department performance', subtitle: 'Target achievement where targets exist, otherwise average score', fmt: 'pct', span: 'third', bars: deptBars },
        ],
      },
      {
        id: 'conversion', title: 'Conversion', description: 'Leads created in the period and how far they got.',
        blocks: [
          { kind: 'funnel', id: 'org-funnel', title: 'Lead-to-booking funnel', span: 'half', stages: funnel },
          { kind: 'bars', id: 'org-leakage', title: 'Stage-wise leakage', subtitle: 'Share of leads lost between steps', fmt: 'pct', span: 'half', bars: leakage },
          this.sourceBars('org-sources', cohort, 'full'),
        ],
      },
      {
        id: 'lead-work', title: 'Lead metrics', description: 'Follow-ups, how often each lead is contacted, and the properties shared with them.',
        blocks: [
          this.kpis('lead-work-kpis', 'Lead work', ['fu_new', 'fu_old', 'contact_freq', 'unique_leads', 'shares', 'shares_per_lead', 'shares_per_worked', 'share_to_visit'], data, ids),
          this.leaderboard('lead-work-people', 'Lead work by person', 'sales', visible.filter(p => p.dept === 'telecalling' || p.dept === 'sales'), data, visible,
            ['contact_freq', 'fu_new', 'fu_old', 'shares', 'shares_per_lead', 'shares_per_worked']),
          ...this.sourcingBlocks(stageRows),
        ],
      },
      {
        id: 'lead-health', title: 'Lead health',
        blocks: [
          this.kpis('lead-kpis', 'Response and coverage', ['first_resp', 'sla', 'coverage', 'inactivity', 'neglected', 'overdue_now', 'handoff_time', 'handoff_accept'], data, ids),
          { kind: 'bars', id: 'attention-gap', title: 'Attention gap', subtitle: 'Open leads by days since anyone touched them', fmt: 'n', span: 'half', bars: [
            { label: '0–1 days', value: cur.idle_0_1 ?? 0, tone: 'good' }, { label: '2–3 days', value: cur.idle_2_3 ?? 0 },
            { label: '4–7 days', value: cur.idle_4_7 ?? 0, tone: 'warn' }, { label: '8–14 days', value: cur.idle_8_14 ?? 0, tone: 'bad' },
            { label: '15+ days', value: cur.idle_15_plus ?? 0, tone: 'bad' },
          ] },
          ...(await this.sourceQuality(range, 'half')).slice(1),
        ],
      },
      {
        id: 'operations', title: 'Operations',
        blocks: [
          {
            kind: 'stacked', id: 'dept-workload', title: 'Department workload', subtitle: 'Open leads per person, by state', fmt: 'avg', span: 'half',
            keys: [{ key: 'healthy', label: 'On track' }, { key: 'overdue', label: 'Overdue' }, { key: 'neglected', label: 'Unattended 7d+' }],
            rows: deptMembers.map(({ d, members }) => {
              const c = this.sum(data, members.map(p => p.id), 'cur');
              const n = members.length;
              const overdue = (c.overdue ?? 0) / n, neglected = Math.max(0, (c.neglected ?? 0) - (c.overdue ?? 0)) / n;
              return { label: d.label, values: { healthy: round1(Math.max(0, (c.open ?? 0) / n - overdue - neglected)), overdue: round1(overdue), neglected: round1(neglected) } };
            }).filter(r => Object.values(r.values).some(v => v > 0)),
          },
          { kind: 'bars', id: 'sales-ageing', title: 'Negotiation and opportunity ageing', subtitle: 'Open sales leads by days in their current stage', fmt: 'n', span: 'half', bars: [
            { label: '0–7 days', value: cur.age_0_7 ?? 0, tone: 'good' }, { label: '8–14 days', value: cur.age_8_14 ?? 0 },
            { label: '15–30 days', value: cur.age_15_30 ?? 0, tone: 'warn' }, { label: '30+ days', value: cur.age_30_plus ?? 0, tone: 'bad' },
          ] },
          this.trend('org-outcomes', 'Bookings and visits', ['sv_sched', 'sv_done', 'booked'], data, ids, 'half'),
          { kind: 'bars', id: 'forecast', title: `Expected bookings from pipeline · ${expected}`, subtitle: 'Open leads at each stage × the last 180 days’ stage-to-booking rate', fmt: 'avg', span: 'half', bars: forecastBars },
        ],
      },
      {
        id: 'supply', title: 'Sourcing and demand',
        blocks: [
          { kind: 'bars', id: 'supply-demand', title: 'Inventory supply vs customer demand', subtitle: 'Requirements in the last 90 days against available listings', fmt: 'n', span: 'half', valueLabel: 'Requirements', secondaryLabel: 'Listings',
            bars: supply.map(r => ({ label: r.label, value: Number(r.demand), secondary: Number(r.supply), tone: Number(r.supply) < Number(r.demand) / 2 ? 'bad' : undefined })) },
          this.trend('org-sourcing', 'Verified inventory trend', ['sourced', 'verified'], data, ids, 'half'),
        ],
      },
      {
        id: 'workforce', title: 'Workforce',
        blocks: [
          { kind: 'bars', id: 'staffing', title: 'Staffing and capacity', subtitle: 'Open leads per person in each department', fmt: 'avg', span: 'half', valueLabel: 'Open leads per person', secondaryLabel: 'People',
            bars: deptMembers.map(({ d, members }) => ({ label: d.label, value: round1((this.sum(data, members.map(p => p.id), 'cur').open ?? 0) / members.length), secondary: members.length })) },
          { kind: 'bars', id: 'score-spread', title: 'Performance distribution', subtitle: 'People by performance score', fmt: 'n', span: 'half', bars: scoreBuckets(visible.map(p => this.score(p, data, visible.filter(x => x.dept === p.dept)).score)) },
        ],
      },
      {
        id: 'data', title: 'Data quality',
        blocks: [
          { kind: 'kpis', id: 'data-kpis', title: 'Data health', span: 'full', metrics: [
            { key: 'health', label: 'Data health score', fmt: 'score', better: 'up', value: healthScore.length ? Math.round(healthScore.reduce((a, b) => a + b, 0) / healthScore.length) : null, prev: null, snapshot: true, hint: 'CRM updates after calls, loggers syncing, and leads touched in 7 days' },
            { key: 'crm', label: 'CRM update compliance', fmt: 'pct', better: 'up', value: crm, prev: pctOf(prev.crm_updated, prev.crm_calls) },
            { key: 'loggers_stale', label: 'Loggers not syncing (24h)', fmt: 'n', better: 'down', value: Number(h.loggers_stale ?? 0), prev: null, snapshot: true, alert: true },
            { key: 'unowned', label: 'Open leads with no owner', fmt: 'n', better: 'down', value: Number(h.unowned_leads ?? 0), prev: null, snapshot: true, alert: true },
            { key: 'no_source', label: 'Leads with no source', fmt: 'n', better: 'down', value: Number(h.no_source ?? 0), prev: null, snapshot: true },
            { key: 'enquiries', label: 'Website enquiries waiting', fmt: 'n', better: 'down', value: Number(h.enquiries_waiting ?? 0), prev: null, snapshot: true, alert: true },
          ] },
        ],
      },
      { id: 'queue', title: 'Overdue and neglected', blocks: [await this.queue('org-queue', 'Leads needing action across the business', visible, range, 25)] },
    ];
  }
}

const MIN_FUNNEL = 10;
const round1 = (v: number) => Math.round(v * 10) / 10;
function pctOf(a?: number, b?: number) {
  return b ? Math.round(((a ?? 0) / b) * 100) : 0;
}
function dedupe(items: Insight[]) {
  const seen = new Set<string>();
  return items.filter(i => (seen.has(i.title) ? false : (seen.add(i.title), true)));
}
function scoreBuckets(scores: (number | null)[]): Bar[] {
  const edges = [[0, 20], [20, 40], [40, 60], [60, 80], [80, 101]];
  return edges.map(([a, b]) => ({
    label: b > 100 ? '80–100' : `${a}–${b - 1}`,
    value: scores.filter(s => s !== null && s >= a && s < b).length,
    tone: a >= 80 ? 'good' : a < 40 ? 'bad' : undefined,
  }));
}
