import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { extname } from 'path';
import { TaskTemplate } from '../../database/entities/task-template.entity';
import { TaskMetricTarget } from '../../database/entities/task-metric-target.entity';
import { TaskActivityLog } from '../../database/entities/task-activity-log.entity';
import { TaskReceipt } from '../../database/entities/task-receipt.entity';
import { Department } from '../../database/entities/department.entity';
import { activityFeed, dailyProgress, type DailyProgress } from './task-progress';
import { computePace, storedWeeks, type Pace, type PaceStatus } from './task-pace';
import { DEPARTMENT_METRICS, departmentKey, metricDef, trackingOf, type MetricDef } from './task-metrics';
import { istToday } from '../dashboard/range';

export { DEPARTMENT_METRICS };

const ORG_ROLES = ['Admin', 'Super Admin', 'Manager'];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

type Viewer = { sub: number; role: string; department_id?: number | null };

type Member = { id: number; name: string; avatar: string | null; role: string; department_id: number | null; department: string | null };

export type MetricOut = Pace & {
  key: string;
  label: string;
  unit: 'count' | 'amount';
  tracking: 'auto' | 'manual';
  source: string;
};

export type TaskRow = {
  id: number;
  title: string;
  month: string;
  status: string;
  person: Member;
  department_id: number;
  metrics: MetricOut[];
  overall: { pct: number; status: PaceStatus; today: { met: number; total: number }; behind: number };
};

/**
 * Split a monthly target over the four task weeks (1–7, 8–14, 15–21, 22–end);
 * the last week takes the remainder. Overrides are used only when all four are given.
 */
function weeklySplit(monthly: number, overrides?: Record<number, number>): number[] {
  if (overrides && [1, 2, 3, 4].every(w => overrides[w] !== undefined)) return [1, 2, 3, 4].map(w => Number(overrides[w]) || 0);
  const base = Math.floor(monthly / 4);
  return [base, base, base, monthly - base * 3];
}

const STATUS_RANK: Record<PaceStatus, number> = { behind: 0, missed: 0, on_pace: 1, upcoming: 1, ahead: 2, done: 3 };

@Injectable()
export class TasksService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  getDepartmentMetrics(deptName: string): MetricDef[] | null {
    const key = departmentKey(deptName);
    return key ? DEPARTMENT_METRICS[key] : null;
  }

  /** The current month in India time, YYYY-MM. */
  getCurrentMonth(): string {
    return istToday().slice(0, 7);
  }

  private shiftMonth(month: string, by: number): string {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    return d.toISOString().slice(0, 7);
  }

  private monthOf(raw?: string) {
    if (raw === undefined || raw === '') return this.getCurrentMonth();
    if (!MONTH.test(raw)) throw new BadRequestException('Month must look like 2026-11');
    return raw;
  }

  private isOrg = (user: Viewer) => ORG_ROLES.includes(user.role);

  /** The viewer with their department as stored now, not as it was when they signed in. */
  private async viewer(user: Viewer): Promise<Viewer> {
    const [row]: { department_id: number | null }[] = await this.dataSource.query('SELECT department_id FROM users WHERE id = ?', [user.sub]);
    return { ...user, department_id: row?.department_id ?? null };
  }

  /** Active people the viewer can see targets for. */
  private async members(user: Viewer): Promise<Member[]> {
    const where = this.isOrg(user) ? '' : user.role === 'Team Lead' ? 'AND (u.department_id = ? OR u.id = ?)' : 'AND u.id = ?';
    const params = this.isOrg(user) ? [] : user.role === 'Team Lead' ? [user.department_id ?? -1, user.sub] : [user.sub];
    const rows: { id: number; name: string; avatar: string | null; role: string | null; department_id: number | null; department: string | null }[] =
      await this.dataSource.query(
        `SELECT u.id, u.name, u.avatar_url AS avatar, r.name AS role, u.department_id, d.name AS department
           FROM users u LEFT JOIN roles r ON r.id = u.role_id LEFT JOIN departments d ON d.id = u.department_id
          WHERE u.is_active = 1 ${where} ORDER BY u.name, u.id`, params);
    return rows.map(r => ({ ...r, id: Number(r.id), role: r.role ?? 'Staff', department_id: r.department_id === null ? null : Number(r.department_id) }));
  }

  private assertCanSee(template: TaskTemplate, user: Viewer) {
    if (this.isOrg(user)) return;
    if (user.role === 'Team Lead' && (template.department_id === Number(user.department_id) || template.assigned_to === user.sub)) return;
    if (template.assigned_to === user.sub) return;
    throw new ForbiddenException('Access denied');
  }

  private assertCanManage(departmentId: number, user: Viewer) {
    if (this.isOrg(user)) return;
    if (user.role === 'Team Lead' && departmentId === Number(user.department_id)) return;
    throw new ForbiddenException(user.role === 'Team Lead' ? 'Team Leads can set targets for their own department only' : 'Only managers and team leads set targets');
  }

  private metricsOf(template: TaskTemplate, progress: DailyProgress, today: string): MetricOut[] {
    return (template.metricTargets ?? [])
      .filter(t => Number(t.monthly_target) > 0)
      .map(t => {
        const def = metricDef(t.metric_key);
        const tracking = trackingOf(t.metric_key, t.tracking_type);
        const pace = computePace({ monthly: Number(t.monthly_target), weeks: storedWeeks(t) }, progress.get(template.id)?.get(t.metric_key), template.month, today);
        return {
          key: t.metric_key, label: def?.label ?? t.metric_label,
          unit: t.metric_value_type === 'amount' ? 'amount' : 'count', tracking,
          source: def?.source ?? (tracking === 'auto' ? 'Counted automatically' : 'Logged by hand from the Tasks page'),
          ...pace,
        };
      });
  }

  private row(template: TaskTemplate, person: Member, progress: DailyProgress, today: string): TaskRow {
    const metrics = this.metricsOf(template, progress, today);
    const pct = metrics.length ? Math.round(metrics.reduce((s, m) => s + Math.min(100, m.pct), 0) / metrics.length) : 0;
    // A person reads as their typical metric, not their worst: the median status.
    const ranks = metrics.map(m => STATUS_RANK[m.status]).sort((a, b) => a - b);
    const mid = ranks.length ? ranks[Math.floor((ranks.length - 1) / 2)] : 1;
    const statuses = metrics.map(m => m.status);
    const status: PaceStatus = metrics.length && statuses.every(s => s === 'done') ? 'done'
      : statuses.includes('missed') ? 'missed'
      : statuses.length && statuses.every(s => s === 'upcoming') ? 'upcoming'
      : mid === 0 ? 'behind' : mid === 2 || mid === 3 ? 'ahead' : 'on_pace';
    const withGoal = metrics.filter(m => m.today.goal > 0);
    return {
      id: template.id, title: template.title, month: template.month, status: template.status,
      person, department_id: template.department_id, metrics,
      overall: { pct, status, today: { met: withGoal.filter(m => m.today.remaining === 0).length, total: withGoal.length }, behind: statuses.filter(s => s === 'behind').length },
    };
  }

  // ── Board ─────────────────────────────────────────────────────────────────

  /** Everyone's targets for a month, with live progress, scoped to the viewer. */
  async board(user: Viewer, rawMonth?: string) {
    user = await this.viewer(user);
    const month = this.monthOf(rawMonth);
    const today = istToday();
    const people = await this.members(user);
    const byId = new Map(people.map(p => [p.id, p]));
    const templates = people.length ? await this.dataSource.getRepository(TaskTemplate).find({
      where: { assigned_to: In(people.map(p => p.id)), month },
      relations: { metricTargets: true },
    }) : [];
    const progress = await dailyProgress(this.dataSource, templates);
    const rows = templates
      .filter(t => byId.has(t.assigned_to))
      .map(t => this.row(t, byId.get(t.assigned_to)!, progress, today))
      .sort((a, b) => a.overall.pct - b.overall.pct || a.person.name.localeCompare(b.person.name));

    const withTargets = new Set(templates.map(t => t.assigned_to));
    const departments: { id: number; name: string; metrics: boolean }[] = await this.dataSource.query('SELECT id, name FROM departments ORDER BY name');
    const deptHasMetrics = new Map(departments.map(d => [Number(d.id), !!this.getDepartmentMetrics(d.name)]));
    // People who could be given targets this month but have none yet.
    const without = user.role === 'Staff' ? [] : people.filter(p =>
      !withTargets.has(p.id) && p.department_id !== null && deptHasMetrics.get(p.department_id) && !ORG_ROLES.includes(p.role) && p.id !== user.sub);

    const copyable = without.length ? await this.dataSource.getRepository(TaskTemplate).count({
      where: { assigned_to: In(without.map(p => p.id)), month: this.shiftMonth(month, -1) },
    }) : 0;
    const months: { month: string }[] = await this.dataSource.query(
      `SELECT DISTINCT month FROM task_templates WHERE assigned_to IN (?) ORDER BY month DESC LIMIT 24`, [people.length ? people.map(p => p.id) : [-1]]);
    const current = this.getCurrentMonth();
    const monthList = [...new Set([this.shiftMonth(current, 1), current, ...months.map(m => m.month)])].sort().reverse();
    const visibleDepts = new Set(people.map(p => p.department_id));

    return {
      month, today, current,
      months: monthList,
      departments: departments.filter(d => visibleDepts.has(Number(d.id))).map(d => ({ id: Number(d.id), name: d.name, hasMetrics: deptHasMetrics.get(Number(d.id)) ?? false })),
      rows,
      without,
      can: {
        create: user.role !== 'Staff' && (month === current || month === this.shiftMonth(current, 1)),
        copy: user.role !== 'Staff' && (month === current || month === this.shiftMonth(current, 1)) && copyable > 0,
        delete: user.role === 'Admin' || user.role === 'Super Admin',
      },
    };
  }

  // GET /api/v1/tasks/my — the viewer's own targets this month
  async getMyTasks(user: Viewer) {
    user = await this.viewer(user);
    const month = this.getCurrentMonth();
    const [me] = (await this.members({ ...user, role: 'Staff' }));
    const templates = await this.dataSource.getRepository(TaskTemplate).find({
      where: { assigned_to: user.sub, month },
      relations: { metricTargets: true },
    });
    if (!me) return [];
    const progress = await dailyProgress(this.dataSource, templates);
    return templates.map(t => this.row(t, me, progress, istToday()));
  }

  // GET /api/v1/tasks/:id
  async getTaskById(id: number, user: Viewer) {
    user = await this.viewer(user);
    const template = await this.dataSource.getRepository(TaskTemplate).findOne({
      where: { id },
      relations: { createdBy: true, department: true, metricTargets: true, receipts: true },
    });
    if (!template) throw new NotFoundException('Task not found');
    this.assertCanSee(template, user);
    const [person] = await this.dataSource.query(
      `SELECT u.id, u.name, u.avatar_url AS avatar, r.name AS role, u.department_id, d.name AS department
         FROM users u LEFT JOIN roles r ON r.id = u.role_id LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = ?`, [template.assigned_to]);
    const progress = await dailyProgress(this.dataSource, [template]);
    const current = this.getCurrentMonth();
    return {
      ...this.row(template, { ...person, id: Number(person.id), role: person.role ?? 'Staff' }, progress, istToday()),
      department: template.department?.name ?? null,
      created_by: template.createdBy ? { id: template.createdBy.id, name: template.createdBy.name } : null,
      created_at: template.created_at,
      receipts: (template.receipts ?? []).sort((a, b) => +b.created_at - +a.created_at)
        .map(r => ({ id: r.id, file_name: r.file_name, file_url: r.file_url, upload_date: r.upload_date, uploaded_by: r.uploaded_by })),
      can: {
        edit: user.role !== 'Staff' && template.month >= current && (this.isOrg(user) || template.department_id === Number(user.department_id)),
        log: template.month === current && (user.role !== 'Staff' || template.assigned_to === user.sub),
        delete: user.role === 'Admin' || user.role === 'Super Admin',
      },
    };
  }

  // GET /api/v1/tasks/:id/activity — what was counted, newest first
  async getActivity(id: number, user: Viewer) {
    user = await this.viewer(user);
    const template = await this.dataSource.getRepository(TaskTemplate).findOne({ where: { id }, relations: { metricTargets: true } });
    if (!template) throw new NotFoundException('Task not found');
    this.assertCanSee(template, user);
    return activityFeed(this.dataSource, template);
  }

  // ── Setting targets ───────────────────────────────────────────────────────

  // GET /api/v1/tasks/setup?month= — what the viewer can set targets for
  async setup(user: Viewer, rawMonth?: string) {
    user = await this.viewer(user);
    if (user.role === 'Staff') throw new ForbiddenException('Staff cannot set targets');
    const current = this.getCurrentMonth();
    const month = this.monthOf(rawMonth);
    this.plannable(month);
    const people = (await this.members(user)).filter(p => !ORG_ROLES.includes(p.role) && p.department_id !== null);
    const taken = new Set(people.length
      ? (await this.dataSource.getRepository(TaskTemplate).find({ where: { assigned_to: In(people.map(p => p.id)), month } })).map(t => t.assigned_to)
      : []);
    const departments: { id: number; name: string }[] = await this.dataSource.query('SELECT id, name FROM departments ORDER BY name');
    return {
      month,
      months: [current, this.shiftMonth(current, 1)],
      departments: departments
        .filter(d => this.isOrg(user) || Number(d.id) === Number(user.department_id))
        .map(d => ({ id: Number(d.id), name: d.name, metrics: this.getDepartmentMetrics(d.name) ?? [] }))
        .filter(d => d.metrics.length)
        .map(d => ({
          ...d,
          people: people.filter(p => p.department_id === d.id).map(p => ({ id: p.id, name: p.name, avatar: p.avatar, role: p.role, taken: taken.has(p.id) })),
        })),
    };
  }


  private plannable(month: string) {
    const current = this.getCurrentMonth();
    if (month !== current && month !== this.shiftMonth(current, 1)) {
      throw new BadRequestException('Targets can be set for this month or next month');
    }
  }

  private async department(id: number) {
    const dept = await this.dataSource.getRepository(Department).findOne({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    const metrics = this.getDepartmentMetrics(dept.name);
    if (!metrics) throw new BadRequestException(`No targets are defined for ${dept.name}`);
    return { dept, metrics };
  }

  private targetRows(templateId: number, metrics: { key: string; monthly_target: number | string; weekly_overrides?: Record<number, number> }[], catalog: MetricDef[]) {
    return metrics.flatMap(m => {
      const def = catalog.find(d => d.key === m.key);
      const monthly = Number(m.monthly_target) || 0;
      if (!def || monthly <= 0) return [];
      const [w1, w2, w3, w4] = weeklySplit(monthly, m.weekly_overrides);
      return [{
        task_template_id: templateId, metric_key: def.key, metric_label: def.label, metric_value_type: def.value_type,
        monthly_target: monthly, week1_target: w1, week2_target: w2, week3_target: w3, week4_target: w4, week5_target: 0,
        tracking_type: def.tracking_type, carry_forward_amount: 0,
      }];
    });
  }

  // POST /api/v1/tasks — set the same targets for one or more people
  async createTaskTemplate(body: any, user: Viewer) {
    user = await this.viewer(user);
    if (user.role === 'Staff') throw new ForbiddenException('Staff cannot set targets');
    const { department_id, title, metrics } = body ?? {};
    const assignees: number[] = [...new Set<number>((Array.isArray(body?.assignees) ? body.assignees : [body?.assigned_to]).map(Number).filter(Boolean))];
    if (!department_id || !assignees.length || !Array.isArray(metrics)) {
      throw new BadRequestException('Choose a department, at least one person and the targets');
    }
    this.assertCanManage(Number(department_id), user);
    const month = this.monthOf(body.month);
    this.plannable(month);
    const { dept, metrics: catalog } = await this.department(Number(department_id));
    if (!this.targetRows(0, metrics, catalog).length) throw new BadRequestException('Give at least one target above zero');

    const people: { id: number; name: string; department_id: number | null }[] = await this.dataSource.query(
      'SELECT id, name, department_id FROM users WHERE id IN (?) AND is_active = 1', [assignees]);
    const existing = await this.dataSource.getRepository(TaskTemplate).find({ where: { assigned_to: In(assignees), month } });
    const taken = new Set(existing.map(t => t.assigned_to));
    const skipped: { id: number; name: string; reason: string }[] = [];
    const created: number[] = [];

    await this.dataSource.transaction(async manager => {
      for (const id of assignees) {
        const person = people.find(p => Number(p.id) === id);
        if (!person) { skipped.push({ id, name: `#${id}`, reason: 'Not an active user' }); continue; }
        if (Number(person.department_id) !== Number(department_id)) { skipped.push({ id, name: person.name, reason: `Not in ${dept.name}` }); continue; }
        if (taken.has(id)) { skipped.push({ id, name: person.name, reason: `Already has targets for ${month}` }); continue; }
        const saved = await manager.getRepository(TaskTemplate).save(manager.getRepository(TaskTemplate).create({
          title: title || `${dept.name} targets – ${month}`, department_id: Number(department_id), assigned_to: id,
          created_by: user.sub, month, status: 'active',
        }));
        await manager.getRepository(TaskMetricTarget).save(this.targetRows(saved.id, metrics, catalog).map(r => manager.getRepository(TaskMetricTarget).create(r)));
        created.push(saved.id);
      }
    });
    return { month, created, skipped };
  }

  // PATCH /api/v1/tasks/:id — change a person's targets; a target of 0 removes it
  async updateTargets(id: number, body: any, user: Viewer) {
    user = await this.viewer(user);
    const template = await this.dataSource.getRepository(TaskTemplate).findOne({ where: { id }, relations: { metricTargets: true } });
    if (!template) throw new NotFoundException('Task not found');
    this.assertCanManage(template.department_id, user);
    if (template.month < this.getCurrentMonth()) throw new BadRequestException('Past months are closed');
    const { metrics: catalog } = await this.department(template.department_id);
    const metrics: { key: string; monthly_target: number }[] = Array.isArray(body?.metrics) ? body.metrics : [];

    await this.dataSource.transaction(async manager => {
      const repo = manager.getRepository(TaskMetricTarget);
      if (typeof body?.title === 'string' && body.title.trim()) await manager.getRepository(TaskTemplate).update(id, { title: body.title.trim() });
      for (const m of metrics) {
        const current = template.metricTargets?.find(t => t.metric_key === m.key);
        const [row] = this.targetRows(id, [m], catalog);
        if (!row) { if (current) await repo.remove(current); continue; }
        await repo.save(current ? Object.assign(current, row) : repo.create(row));
      }
    });
    return this.getTaskById(id, user);
  }

  // POST /api/v1/tasks/copy — give everyone without targets last month's again
  async copyPreviousMonth(body: any, user: Viewer) {
    user = await this.viewer(user);
    if (user.role === 'Staff') throw new ForbiddenException('Staff cannot set targets');
    const month = this.monthOf(body?.month);
    this.plannable(month);
    const people = await this.members(user);
    const ids = people.map(p => p.id);
    if (!ids.length) return { month, created: [], skipped: [] };
    const repo = this.dataSource.getRepository(TaskTemplate);
    const previous = await repo.find({ where: { assigned_to: In(ids), month: this.shiftMonth(month, -1) }, relations: { metricTargets: true } });
    const taken = new Set((await repo.find({ where: { assigned_to: In(ids), month } })).map(t => t.assigned_to));
    const created: number[] = [];
    await this.dataSource.transaction(async manager => {
      for (const t of previous) {
        const person = people.find(p => p.id === t.assigned_to);
        // Someone who moved department keeps the old targets behind.
        if (taken.has(t.assigned_to) || !person || person.department_id !== t.department_id) continue;
        if (!this.isOrg(user) && t.department_id !== Number(user.department_id)) continue;
        const saved = await manager.getRepository(TaskTemplate).save(manager.getRepository(TaskTemplate).create({
          title: t.title.replace(/\d{4}-\d{2}/, month), department_id: t.department_id, assigned_to: t.assigned_to,
          created_by: user.sub, month, status: 'active',
        }));
        await manager.getRepository(TaskMetricTarget).save((t.metricTargets ?? []).map(m => manager.getRepository(TaskMetricTarget).create({
          ...m, id: undefined, task_template_id: saved.id, carry_forward_amount: 0,
          tracking_type: trackingOf(m.metric_key, m.tracking_type),
        })));
        created.push(saved.id);
      }
    });
    return { month, created, skipped: [] };
  }

  // DELETE /api/v1/tasks/:id — Admin only
  async deleteTaskTemplate(id: number, user: Viewer) {
    if (user.role !== 'Admin' && user.role !== 'Super Admin') throw new ForbiddenException('Only Admin can delete targets');
    const repo = this.dataSource.getRepository(TaskTemplate);
    const template = await repo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Task not found');
    await repo.remove(template);
    return { success: true };
  }

  // GET /api/v1/tasks/:id/progress
  async getTaskProgress(id: number, user: Viewer) {
    return this.getTaskById(id, user);
  }

  // POST /api/v1/tasks/:id/log — hand-logged progress for work the CRM cannot see
  async logManualProgress(id: number, body: any, user: Viewer) {
    user = await this.viewer(user);
    const template = await this.dataSource.getRepository(TaskTemplate).findOne({ where: { id }, relations: { metricTargets: true } });
    if (!template) throw new NotFoundException('Task not found');
    this.assertCanSee(template, user);
    if (template.month !== this.getCurrentMonth()) throw new BadRequestException('Progress can only be logged for this month');

    const { metric_key, count_value, note } = body ?? {};
    const value = Number(count_value);
    if (!metric_key || !Number.isFinite(value) || value === 0) throw new BadRequestException('Choose a target and a number other than zero');
    const target = template.metricTargets?.find(t => t.metric_key === metric_key);
    if (!target) throw new BadRequestException(`'${metric_key}' is not one of these targets`);
    if (trackingOf(target.metric_key, target.tracking_type) === 'auto') {
      throw new BadRequestException(`${target.metric_label} is counted automatically`);
    }
    const repo = this.dataSource.getRepository(TaskActivityLog);
    await repo.save(repo.create({
      task_template_id: id, metric_key, logged_by: user.sub, count_value: value, logged_date: istToday(), note: note || null,
    }));
    return { success: true };
  }

  // ── Receipt Upload ──────────────────────────────────────────────────────────

  async uploadReceipt(templateId: number, file: Express.Multer.File, user: Viewer) {
    user = await this.viewer(user);
    const template = await this.dataSource.getRepository(TaskTemplate).findOne({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Task not found');
    this.assertCanSee(template, user);

    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('File too large (max 10MB)');

    const ext = extname(file.originalname).toLowerCase();
    const fileKey = `tasks/T${String(templateId).padStart(5, '0')}/receipts/receipt_${Date.now()}${ext}`;
    const publicUrl = `${process.env.R2_PUBLIC_URL || ''}/${fileKey}`;
    await this.s3Client.write(fileKey, file.buffer, { type: file.mimetype });

    const repo = this.dataSource.getRepository(TaskReceipt);
    return repo.save(repo.create({
      task_template_id: templateId, uploaded_by: user.sub, file_name: file.originalname,
      file_url: publicUrl, file_key: fileKey, upload_date: istToday(),
    }));
  }

  async deleteReceipt(templateId: number, receiptId: number, user: Viewer) {
    const receipt = await this.dataSource.getRepository(TaskReceipt).findOne({ where: { id: receiptId, task_template_id: templateId } });
    if (!receipt) throw new NotFoundException('Receipt not found');
    if (user.role === 'Staff' && receipt.uploaded_by !== user.sub) throw new ForbiddenException('Access denied');
    try {
      await this.s3Client.delete(receipt.file_key);
    } catch (e) {
      console.error('Failed to delete receipt from R2:', e);
    }
    await this.dataSource.getRepository(TaskReceipt).remove(receipt);
    return { success: true };
  }

  // ── Metrics definition endpoint ─────────────────────────────────────────────

  getMetricsForDepartment(deptName: string) {
    const metrics = this.getDepartmentMetrics(deptName);
    if (!metrics) throw new NotFoundException(`No targets are defined for ${deptName}`);
    return metrics;
  }

  // ── S3 Client ──────────────────────────────────────────────────────────────

  private _s3Client: any = null;
  private get s3Client() {
    if (!this._s3Client) {
      const { S3Client } = require('bun');
      this._s3Client = new S3Client({
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        bucket: process.env.R2_BUCKET_NAME || '',
        region: 'auto',
      });
    }
    return this._s3Client;
  }
}
