import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { extname } from 'path';
import { TaskTemplate } from '../../database/entities/task-template.entity';
import { TaskMetricTarget } from '../../database/entities/task-metric-target.entity';
import { TaskMetricProgress } from '../../database/entities/task-metric-progress.entity';
import { TaskActivityLog } from '../../database/entities/task-activity-log.entity';
import { TaskReceipt } from '../../database/entities/task-receipt.entity';
import { Department } from '../../database/entities/department.entity';

// ── Department → Metric Definitions ─────────────────────────────────────────

const DEPARTMENT_METRICS: Record<string, Array<{
  key: string;
  label: string;
  value_type: 'count' | 'amount';
  tracking_type: 'auto' | 'manual';
}>> = {
  telecalling: [
    { key: 'call_count', label: 'Call Count', value_type: 'count', tracking_type: 'auto' },
    { key: 'opportunity', label: 'Opportunity', value_type: 'count', tracking_type: 'auto' },
    { key: 'sv_schedule', label: 'SV Schedule', value_type: 'count', tracking_type: 'auto' },
    { key: 'sv_done', label: 'SV Done', value_type: 'count', tracking_type: 'auto' },
    { key: 'rejection', label: 'Rejection', value_type: 'count', tracking_type: 'auto' },
  ],
  sales: [
    { key: 'call_count', label: 'Call Count', value_type: 'count', tracking_type: 'auto' },
    { key: 'sv_done', label: 'Site Visit Done', value_type: 'count', tracking_type: 'auto' },
    { key: 'rsv_schedule', label: 'RSV Schedule', value_type: 'count', tracking_type: 'auto' },
    { key: 'rsv_done', label: 'RSV Done', value_type: 'count', tracking_type: 'auto' },
    { key: 'prospective', label: 'Prospective', value_type: 'count', tracking_type: 'auto' },
    { key: 'booked', label: 'Booked', value_type: 'count', tracking_type: 'auto' },
    { key: 'dropped', label: 'Dropped', value_type: 'count', tracking_type: 'auto' },
    { key: 'target_amount', label: 'Target Amount', value_type: 'amount', tracking_type: 'manual' },
    { key: 'sourcing', label: 'Sourcing', value_type: 'count', tracking_type: 'auto' },
    { key: 'validation', label: 'Validation', value_type: 'count', tracking_type: 'auto' },
    { key: 'verification', label: 'Verification', value_type: 'count', tracking_type: 'auto' },
  ],
  collection: [
    { key: 'collection_calls', label: 'Collection Calls Made', value_type: 'count', tracking_type: 'manual' },
    { key: 'customers_contacted', label: 'Customers Contacted', value_type: 'count', tracking_type: 'manual' },
    { key: 'payment_followups', label: 'Payment Follow-ups', value_type: 'count', tracking_type: 'manual' },
    { key: 'payment_confirmations', label: 'Payment Confirmations', value_type: 'count', tracking_type: 'manual' },
    { key: 'receipts_uploaded', label: 'Collection Receipts Uploaded', value_type: 'count', tracking_type: 'auto' },
  ],
  designing: [
    { key: 'posters', label: 'Poster', value_type: 'count', tracking_type: 'manual' },
    { key: 'reels', label: 'Reels', value_type: 'count', tracking_type: 'manual' },
    { key: 'videos', label: 'Videos', value_type: 'count', tracking_type: 'manual' },
  ],
  digital: [
    { key: 'listings', label: 'Listing', value_type: 'count', tracking_type: 'manual' },
    { key: 'likes', label: 'Likes', value_type: 'count', tracking_type: 'manual' },
    { key: 'reviews', label: 'Reviews', value_type: 'count', tracking_type: 'manual' },
    { key: 'lead_generation', label: 'Lead Generation', value_type: 'count', tracking_type: 'manual' },
  ],
  hr: [
    { key: 'candidates_sourced', label: 'Candidates Sourced', value_type: 'count', tracking_type: 'manual' },
    { key: 'interviews_scheduled', label: 'Interviews Scheduled', value_type: 'count', tracking_type: 'manual' },
    { key: 'interviews_completed', label: 'Interviews Completed', value_type: 'count', tracking_type: 'manual' },
    { key: 'hires_made', label: 'Hires Made', value_type: 'count', tracking_type: 'manual' },
    { key: 'attendance_issues', label: 'Attendance Issues Resolved', value_type: 'count', tracking_type: 'manual' },
    { key: 'trainings_conducted', label: 'Trainings Conducted', value_type: 'count', tracking_type: 'manual' },
  ],
};

// ── Lead Status → Metric Auto-Increment Map ──────────────────────────────────

const LEAD_STATUS_METRIC_MAP: Record<string, Array<{ dept: string; metricKey: string }>> = {
  'Contacted': [
    { dept: 'telecalling', metricKey: 'call_count' },
    { dept: 'sales', metricKey: 'call_count' },
  ],
  'RNR': [
    { dept: 'telecalling', metricKey: 'call_count' },
    { dept: 'sales', metricKey: 'call_count' },
  ],
  'Qualified': [
    { dept: 'telecalling', metricKey: 'opportunity' },
    { dept: 'sales', metricKey: 'validation' },
  ],
  'Interested': [
    { dept: 'telecalling', metricKey: 'opportunity' },
  ],
  'Site Visit Scheduled': [
    { dept: 'telecalling', metricKey: 'sv_schedule' },
  ],
  'Site Visit Completed': [
    { dept: 'telecalling', metricKey: 'sv_done' },
    { dept: 'sales', metricKey: 'sv_done' },
  ],
  'Re Visit Scheduled': [
    { dept: 'sales', metricKey: 'rsv_schedule' },
  ],
  'Re Visit Completed': [
    { dept: 'sales', metricKey: 'rsv_done' },
  ],
  'Negotiation': [
    { dept: 'sales', metricKey: 'prospective' },
  ],
  'Booking Advance': [
    { dept: 'sales', metricKey: 'booked' },
  ],
  'Agreement': [
    { dept: 'sales', metricKey: 'booked' },
  ],
  'Closed Won': [
    { dept: 'sales', metricKey: 'booked' },
  ],
  'Dropped': [
    { dept: 'telecalling', metricKey: 'rejection' },
    { dept: 'sales', metricKey: 'dropped' },
  ],
  'Not Interested': [
    { dept: 'telecalling', metricKey: 'rejection' },
  ],
  'Lost': [
    { dept: 'telecalling', metricKey: 'rejection' },
    { dept: 'sales', metricKey: 'dropped' },
  ],
  'Property Shared': [
    { dept: 'sales', metricKey: 'verification' },
  ],
};

// ── Weekly Split Utilities ───────────────────────────────────────────────────

/**
 * Compute how many Mon-Sun calendar weeks overlap with the given month.
 * Returns an array of week numbers [1, 2, 3, 4] or [1, 2, 3, 4, 5].
 * Also returns the ISO week number for "today" within the month (1-based).
 */
function getWeeksInMonth(yearMonth: string): { totalWeeks: number; currentWeek: number } {
  const [year, month] = yearMonth.split('-').map(Number);
  const today = new Date();

  // We use a fixed 4-week split to match business targets (1-7, 8-14, 15-21, 22-end)
  // This groups the "extra 2-3 days" of the month into Week 4 automatically.
  let currentWeek = 1;
  
  if (today.getFullYear() === year && (today.getMonth() + 1) === month) {
    const d = today.getDate();
    if (d <= 7) currentWeek = 1;
    else if (d <= 14) currentWeek = 2;
    else if (d <= 21) currentWeek = 3;
    else currentWeek = 4;
  } else {
    // If checking a past month, default to its last week. If future, week 1.
    const monthDate = new Date(year, month - 1, 1);
    if (monthDate < today) {
      currentWeek = 4;
    } else {
      currentWeek = 1;
    }
  }

  return { totalWeeks: 4, currentWeek };
}

/**
 * Split a monthly target into weekly targets.
 * weeklyOverrides: optional map of week number (1-5) to override value.
 */
function computeWeeklyTargets(
  monthlyTarget: number,
  totalWeeks: number,
  weeklyOverrides?: Record<number, number>,
): Record<number, number> {
  const result: Record<number, number> = {};
  if (weeklyOverrides && Object.keys(weeklyOverrides).length === totalWeeks) {
    return weeklyOverrides;
  }
  const base = Math.floor(monthlyTarget / totalWeeks);
  const remainder = monthlyTarget - base * (totalWeeks - 1);
  for (let w = 1; w <= 5; w++) {
    if (w <= totalWeeks) {
      result[w] = w === totalWeeks ? remainder : base;
    } else {
      result[w] = 0;
    }
  }
  return result;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TasksService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  getDepartmentMetrics(deptName: string) {
    // Normalize: lowercase, trim, strip trailing " department" / " dept"
    const key = deptName.toLowerCase().trim()
      .replace(/\s+department$/i, '')
      .replace(/\s+dept$/i, '')
      .trim();
    // Handle "digital marketing" → 'digital'
    if (key.includes('digital')) return DEPARTMENT_METRICS['digital'] || null;
    // Handle "hr" variants
    if (key === 'human resources' || key === 'human resource') return DEPARTMENT_METRICS['hr'] || null;
    return DEPARTMENT_METRICS[key] || null;
  }

  getCurrentMonth(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  // ── Task Template CRUD ────────────────────────────────────────────────────

  // GET /api/v1/tasks  — list all templates (role-scoped)
  async getTaskTemplates(user: any): Promise<TaskTemplate[]> {
    const repo = this.dataSource.getRepository(TaskTemplate);
    const qb = repo.createQueryBuilder('t')
      .leftJoinAndSelect('t.assignedTo', 'assignedTo')
      .leftJoinAndSelect('t.createdBy', 'createdBy')
      .leftJoinAndSelect('t.department', 'department')
      .leftJoinAndSelect('t.metricTargets', 'metricTargets');

    if (user.role === 'Staff') {
      qb.where('t.assigned_to = :uid', { uid: user.sub });
    } else if (user.role === 'Team Lead') {
      qb.where('assignedTo.department_id = :deptId', { deptId: user.department_id });
    }
    // Admin and Manager see all

    qb.orderBy('t.created_at', 'DESC');
    return qb.getMany();
  }

  // GET /api/v1/tasks/my — staff: own tasks for current month
  async getMyTasks(user: any) {
    const month = this.getCurrentMonth();
    const templates = await this.dataSource.getRepository(TaskTemplate).find({
      where: { assigned_to: user.sub, month },
      relations: { metricTargets: true, metricProgress: true },
    });
    // Attach computed progress for each template
    return Promise.all(templates.map(t => this.enrichWithProgress(t, month)));
  }

  // GET /api/v1/tasks/:id
  async getTaskById(id: number, user: any) {
    const template = await this.dataSource.getRepository(TaskTemplate).findOne({
      where: { id },
      relations: { assignedTo: true, createdBy: true, department: true, metricTargets: true },
    });
    if (!template) throw new NotFoundException('Task not found');

    // Staff can only see their own
    if (user.role === 'Staff' && template.assigned_to !== user.sub) {
      throw new ForbiddenException('Access denied');
    }
    // Team Lead can only see their department
    if (user.role === 'Team Lead' && template.department_id !== user.department_id) {
      throw new ForbiddenException('Access denied');
    }

    const month = template.month;
    return this.enrichWithProgress(template, month);
  }

  // POST /api/v1/tasks — create a task template
  async createTaskTemplate(body: any, user: any) {
    // Only Admin, Manager, Team Lead can create
    if (user.role === 'Staff') throw new ForbiddenException('Staff cannot create tasks');

    const { department_id, assigned_to, title, metrics } = body;
    // metrics: Array<{ key: string; monthly_target: number; weekly_overrides?: Record<number,number> }>

    if (!department_id || !assigned_to || !metrics || !Array.isArray(metrics)) {
      throw new BadRequestException('Missing required fields: department_id, assigned_to, metrics[]');
    }

    // Team Lead can only assign within their department
    if (user.role === 'Team Lead') {
      if (Number(department_id) !== Number(user.department_id)) {
        throw new ForbiddenException('Team Lead can only create tasks for their own department');
      }
    }

    const month = this.getCurrentMonth();

    // Check unique constraint: one template per staff per month
    const existing = await this.dataSource.getRepository(TaskTemplate).findOne({
      where: { assigned_to: Number(assigned_to), month },
    });
    if (existing) {
      throw new ConflictException(`A task template already exists for this staff member for ${month}`);
    }

    // Get department to find its name (for metric validation)
    const dept = await this.dataSource.getRepository(Department).findOne({ where: { id: Number(department_id) } });
    if (!dept) throw new NotFoundException('Department not found');

    const validMetrics = this.getDepartmentMetrics(dept.name);
    if (!validMetrics) throw new BadRequestException(`No metrics defined for department: ${dept.name}`);

    const { totalWeeks } = getWeeksInMonth(month);

    return this.dataSource.transaction(async (manager) => {
      // Create template
      const templateRepo = manager.getRepository(TaskTemplate);
      const template = templateRepo.create({
        title: title || `${dept.name} Tasks – ${month}`,
        department_id: Number(department_id),
        assigned_to: Number(assigned_to),
        created_by: user.sub,
        month,
        status: 'active',
      });
      const saved = await templateRepo.save(template);

      // Create metric targets
      const targetRepo = manager.getRepository(TaskMetricTarget);
      for (const m of metrics) {
        const metaDef = validMetrics.find(vm => vm.key === m.key);
        if (!metaDef) continue; // skip unknown metric keys

        const monthlyTarget = Number(m.monthly_target) || 0;
        const weeklyTargets = computeWeeklyTargets(monthlyTarget, totalWeeks, m.weekly_overrides);

        const target = targetRepo.create({
          task_template_id: saved.id,
          metric_key: m.key,
          metric_label: metaDef.label,
          metric_value_type: metaDef.value_type,
          monthly_target: monthlyTarget,
          week1_target: weeklyTargets[1],
          week2_target: weeklyTargets[2],
          week3_target: weeklyTargets[3],
          week4_target: weeklyTargets[4],
          week5_target: weeklyTargets[5],
          tracking_type: metaDef.tracking_type,
          carry_forward_amount: 0,
        });
        await targetRepo.save(target);
      }

      return templateRepo.findOne({
        where: { id: saved.id },
        relations: { metricTargets: true, assignedTo: true, department: true },
      });
    });
  }

  // DELETE /api/v1/tasks/:id — Admin only
  async deleteTaskTemplate(id: number, user: any) {
    if (user.role !== 'Admin') throw new ForbiddenException('Only Admin can delete tasks');
    const repo = this.dataSource.getRepository(TaskTemplate);
    const template = await repo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Task not found');
    await repo.remove(template);
    return { success: true };
  }

  // ── Progress ───────────────────────────────────────────────────────────────

  // GET /api/v1/tasks/:id/progress
  async getTaskProgress(id: number, user: any) {
    const template = await this.dataSource.getRepository(TaskTemplate).findOne({
      where: { id },
      relations: { metricTargets: true, assignedTo: true, department: true },
    });
    if (!template) throw new NotFoundException('Task not found');

    if (user.role === 'Staff' && template.assigned_to !== user.sub) {
      throw new ForbiddenException('Access denied');
    }
    if (user.role === 'Team Lead' && template.department_id !== user.department_id) {
      throw new ForbiddenException('Access denied');
    }

    return this.enrichWithProgress(template, template.month);
  }

  private async enrichWithProgress(template: TaskTemplate, month: string) {
    let progressRows = template.metricProgress;
    if (!progressRows) {
      progressRows = await this.dataSource.getRepository(TaskMetricProgress).find({
        where: { task_template_id: template.id, month },
      });
    }

    const { totalWeeks, currentWeek } = getWeeksInMonth(month);

    const metrics = (template.metricTargets || []).map(target => {
      const weeklyProgress: Record<number, number> = {};
      for (let w = 1; w <= totalWeeks; w++) {
        const row = progressRows.find(p => p.metric_key === target.metric_key && p.week_number === w);
        weeklyProgress[w] = row ? Number(row.achieved_count) : 0;
      }

      // Compute overdue: sum of shortfalls from completed weeks
      let overdueAmount = 0;
      for (let w = 1; w < currentWeek; w++) {
        const weekTarget = Number(target[`week${w}_target` as keyof TaskMetricTarget]) || 0;
        const achieved = weeklyProgress[w] || 0;
        if (achieved < weekTarget) {
          overdueAmount += weekTarget - achieved;
        }
      }

      const totalAchieved = Object.values(weeklyProgress).reduce((a, b) => a + b, 0);
      const currentWeekTarget = Number(target[`week${currentWeek}_target` as keyof TaskMetricTarget]) || 0;
      const currentWeekAchieved = weeklyProgress[currentWeek] || 0;
      const effectiveTarget = currentWeekTarget + overdueAmount; // current week + overdue

      return {
        metric_key: target.metric_key,
        metric_label: target.metric_label,
        metric_value_type: target.metric_value_type,
        tracking_type: target.tracking_type,
        monthly_target: Number(target.monthly_target),
        carry_forward_amount: Number(target.carry_forward_amount),
        total_achieved: totalAchieved,
        current_week: currentWeek,
        total_weeks: totalWeeks,
        current_week_target: currentWeekTarget,
        current_week_achieved: currentWeekAchieved,
        effective_week_target: effectiveTarget,
        overdue_amount: overdueAmount,
        weekly_progress: weeklyProgress,
        week_targets: {
          1: Number(target.week1_target),
          2: Number(target.week2_target),
          3: Number(target.week3_target),
          4: Number(target.week4_target),
          5: Number(target.week5_target),
        },
        month_completion_pct: target.monthly_target > 0
          ? Math.min(100, Math.round((totalAchieved / Number(target.monthly_target)) * 100))
          : 0,
      };
    });

    return {
      ...template,
      metrics,
      current_week: currentWeek,
      total_weeks: totalWeeks,
      month,
    };
  }

  // POST /api/v1/tasks/:id/log — manual progress entry
  async logManualProgress(id: number, body: any, user: any) {
    const template = await this.dataSource.getRepository(TaskTemplate).findOne({
      where: { id },
      relations: { metricTargets: true },
    });
    if (!template) throw new NotFoundException('Task not found');

    // Only the assigned staff (or their TL/manager/admin) can log
    if (user.role === 'Staff' && template.assigned_to !== user.sub) {
      throw new ForbiddenException('Access denied');
    }

    const { metric_key, count_value, note } = body;
    if (!metric_key || count_value === undefined) {
      throw new BadRequestException('metric_key and count_value are required');
    }

    const target = template.metricTargets?.find(t => t.metric_key === metric_key);
    if (!target) throw new BadRequestException(`metric_key '${metric_key}' not found in this task`);
    if (target.tracking_type === 'auto') {
      throw new BadRequestException(`Metric '${metric_key}' is auto-tracked and cannot be logged manually`);
    }

    const today = new Date();
    const loggedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Save activity log
    const logRepo = this.dataSource.getRepository(TaskActivityLog);
    const log = logRepo.create({
      task_template_id: id,
      metric_key,
      logged_by: user.sub,
      count_value: Number(count_value),
      logged_date: loggedDate,
      note: note || null,
    });
    await logRepo.save(log);

    // Update progress row
    const { currentWeek } = getWeeksInMonth(template.month);
    await this.upsertProgress(id, metric_key, currentWeek, template.month, Number(count_value), 'manual');

    return { success: true };
  }

  // ── Auto-Increment (called from leads.service and receipt upload) ──────────

  /**
   * Called when a lead's status changes.
   * lead: { id, department, assigned_staff_id, status (NEW status) }
   */
  async autoIncrementFromLeadStatus(lead: any, newStatus: string) {
    if (!lead.assigned_staff_id) return;

    const mappings = LEAD_STATUS_METRIC_MAP[newStatus];
    if (!mappings) return;

    const month = this.getCurrentMonth();
    const { currentWeek } = getWeeksInMonth(month);

    for (const mapping of mappings) {
      // Only fire if lead.department matches the mapping dept
      const leadDept = (lead.department || '').toLowerCase().trim();
      if (!leadDept.includes(mapping.dept) && mapping.dept !== leadDept) continue;

      // Find the active task template for this staff + this month
      const template = await this.dataSource.getRepository(TaskTemplate).findOne({
        where: { assigned_to: lead.assigned_staff_id, month, status: 'active' },
        relations: { metricTargets: true },
      });
      if (!template) continue;

      const target = template.metricTargets?.find(t => t.metric_key === mapping.metricKey);
      if (!target) continue;

      await this.upsertProgress(template.id, mapping.metricKey, currentWeek, month, 1, 'auto');
    }
  }

  /**
   * Called when a new lead is created and assigned to sales staff (sourcing metric).
   */
  async autoIncrementSourcing(staffId: number) {
    const month = this.getCurrentMonth();
    const { currentWeek } = getWeeksInMonth(month);

    const template = await this.dataSource.getRepository(TaskTemplate).findOne({
      where: { assigned_to: staffId, month, status: 'active' },
      relations: { metricTargets: true },
    });
    if (!template) return;

    const target = template.metricTargets?.find(t => t.metric_key === 'sourcing');
    if (!target) return;

    await this.upsertProgress(template.id, 'sourcing', currentWeek, month, 1, 'auto');
  }

  /**
   * Called when a collection receipt is uploaded.
   */
  async autoIncrementReceiptsUploaded(staffId: number, templateId: number) {
    const month = this.getCurrentMonth();
    const { currentWeek } = getWeeksInMonth(month);
    await this.upsertProgress(templateId, 'receipts_uploaded', currentWeek, month, 1, 'auto');
  }

  private async upsertProgress(
    templateId: number,
    metricKey: string,
    weekNumber: number,
    month: string,
    increment: number,
    source: 'auto' | 'manual',
  ) {
    const repo = this.dataSource.getRepository(TaskMetricProgress);
    let row = await repo.findOne({
      where: { task_template_id: templateId, metric_key: metricKey, week_number: weekNumber, month },
    });
    if (row) {
      row.achieved_count = Number(row.achieved_count) + increment;
      row.source = source;
      await repo.save(row);
    } else {
      const newRow = repo.create({
        task_template_id: templateId,
        metric_key: metricKey,
        week_number: weekNumber,
        month,
        achieved_count: increment,
        source,
      });
      await repo.save(newRow);
    }
  }

  // ── Receipt Upload ──────────────────────────────────────────────────────────

  async uploadReceipt(templateId: number, file: Express.Multer.File, user: any) {
    const template = await this.dataSource.getRepository(TaskTemplate).findOne({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException('Task not found');

    if (user.role === 'Staff' && template.assigned_to !== user.sub) {
      throw new ForbiddenException('Access denied');
    }

    if (!file) throw new BadRequestException('No file uploaded');
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) throw new BadRequestException('File too large (max 10MB)');

    const ext = extname(file.originalname).toLowerCase();
    const fileKey = `tasks/T${String(templateId).padStart(5, '0')}/receipts/receipt_${Date.now()}${ext}`;
    const publicUrl = `${process.env.R2_PUBLIC_URL || ''}/${fileKey}`;

    await this.s3Client.write(fileKey, file.buffer, { type: file.mimetype });

    const today = new Date();
    const uploadDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const receipt = this.dataSource.getRepository(TaskReceipt).create({
      task_template_id: templateId,
      uploaded_by: user.sub,
      file_name: file.originalname,
      file_url: publicUrl,
      file_key: fileKey,
      upload_date: uploadDate,
    });
    await this.dataSource.getRepository(TaskReceipt).save(receipt);

    // Auto-increment receipts_uploaded metric
    await this.autoIncrementReceiptsUploaded(template.assigned_to, templateId);

    return receipt;
  }

  async deleteReceipt(templateId: number, receiptId: number, user: any) {
    const receipt = await this.dataSource.getRepository(TaskReceipt).findOne({
      where: { id: receiptId, task_template_id: templateId },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    if (user.role === 'Staff' && receipt.uploaded_by !== user.sub) {
      throw new ForbiddenException('Access denied');
    }

    try {
      await this.s3Client.delete(receipt.file_key);
    } catch (e) {
      console.error('Failed to delete receipt from R2:', e);
    }
    await this.dataSource.getRepository(TaskReceipt).remove(receipt);

    // Decrement receipts_uploaded (but not below 0)
    const month = this.getCurrentMonth();
    const { currentWeek } = getWeeksInMonth(month);
    const repo = this.dataSource.getRepository(TaskMetricProgress);
    const row = await repo.findOne({
      where: { task_template_id: templateId, metric_key: 'receipts_uploaded', week_number: currentWeek, month },
    });
    if (row && Number(row.achieved_count) > 0) {
      row.achieved_count = Number(row.achieved_count) - 1;
      await repo.save(row);
    }

    return { success: true };
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  async getDashboard(user: any) {
    const month = this.getCurrentMonth();

    let qb = this.dataSource.getRepository(TaskTemplate)
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.department', 'dept')
      .leftJoinAndSelect('t.assignedTo', 'staff')
      .leftJoinAndSelect('t.metricTargets', 'targets')
      .leftJoinAndSelect('t.metricProgress', 'progress')
      .where('t.month = :month AND t.status = :status', { month, status: 'active' });

    if (user.role === 'Team Lead') {
      qb = qb.andWhere('staff.department_id = :deptId', { deptId: user.department_id });
    } else if (user.role === 'Staff') {
      qb = qb.andWhere('t.assigned_to = :uid', { uid: user.sub });
    }

    const templates = await qb.getMany();

    // Group by department
    const byDept: Record<string, { dept_name: string; dept_id: number; staff: any[] }> = {};
    for (const t of templates) {
      const deptKey = String(t.department_id);
      if (!byDept[deptKey]) {
        byDept[deptKey] = {
          dept_name: t.department?.name || '',
          dept_id: t.department_id,
          staff: [],
        };
      }

      const enriched = await this.enrichWithProgress(t, month);
      byDept[deptKey].staff.push({
        staff_id: t.assigned_to,
        staff_name: t.assignedTo?.name,
        template_id: t.id,
        metrics: enriched.metrics,
      });
    }

    // Compute dept-level aggregates
    const departments = Object.values(byDept).map(dept => {
      let totalTarget = 0;
      let totalAchieved = 0;
      for (const s of dept.staff) {
        for (const m of s.metrics) {
          if (m.metric_value_type === 'count') {
            totalTarget += m.monthly_target || 0;
            totalAchieved += m.total_achieved || 0;
          }
        }
      }
      return {
        ...dept,
        total_target: totalTarget,
        total_achieved: totalAchieved,
        completion_pct: totalTarget > 0 ? Math.min(100, Math.round((totalAchieved / totalTarget) * 100)) : 0,
      };
    });

    return { month, departments };
  }

  // ── Metrics definition endpoint ─────────────────────────────────────────────

  getMetricsForDepartment(deptName: string) {
    const metrics = this.getDepartmentMetrics(deptName);
    if (!metrics) throw new NotFoundException(`No metrics configured for department: ${deptName}`);
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
