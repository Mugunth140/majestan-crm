import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { In, Repository } from 'typeorm';
import { MasterService } from '../master/master.service';
import { HrImportRowDto, normalizeCandidateMobile } from './dto/bulk-import-hr.dto';
import { HrCandidate, HrCandidateStatus } from '../../database/entities/hr-candidate.entity';
import { HrFollowUp } from '../../database/entities/hr-follow-up.entity';
import { summarizeHrFollowUps } from './hr-follow-up-summary';
import { HrContactLog } from '../../database/entities/hr-contact-log.entity';
import { CreateHrCandidateDto } from './dto/create-hr-candidate.dto';
import { UpdateHrCandidateDto } from './dto/update-hr-candidate.dto';
import { toDateOnly, toTimeOnly } from './mail/candidate-mail-data';

/** What makes an interview invitation different: used to detect a reschedule. */
function interviewSignature(c: Partial<HrCandidate>) {
  return [toDateOnly(c.interviewDate), toTimeOnly(c.interviewTime), c.interviewMode ?? null, c.interviewLocation?.trim() || null, c.interviewLink?.trim() || null].join('|');
}

@Injectable()
export class HrService {
  constructor(
    @InjectRepository(HrCandidate)
    private repo: Repository<HrCandidate>,
    @InjectRepository(HrFollowUp)
    private fuRepo: Repository<HrFollowUp>,
    @InjectRepository(HrContactLog)
    private contactLogRepo: Repository<HrContactLog>,
    private readonly master: MasterService,
    @InjectRepository(User) private readonly users: Repository<User>,
    // Domain events for the central mail service (docs/mail-service-design.md).
    @Optional() private readonly events?: EventEmitter2,
  ) {}

  async findAll() { 
    const candidates = await this.repo.find({ order: { createdAt: 'DESC' } });
    const allFollowUps = await this.fuRepo.find({ order: { created_at: 'DESC' } });

    const names = await this.assigneeNames(candidates.map(candidate => candidate.assignedStaffId));
    const sources = new Map((await this.master.getHrSources()).map(source => [source.id, source.name]));
    const followUpsByCandidate = new Map<number, HrFollowUp[]>();
    for (const followUp of allFollowUps) {
      const history = followUpsByCandidate.get(followUp.hr_candidate_id) || [];
      history.push(followUp);
      followUpsByCandidate.set(followUp.hr_candidate_id, history);
    }
    return candidates.map(candidate => {
      const summary = summarizeHrFollowUps(followUpsByCandidate.get(candidate.id) || []);

      return {
        ...candidate,
        recruitmentSource: sources.get(candidate.hrSourceId ?? 0) || candidate.recruitmentSource,
        assignedStaff: names.get(candidate.assignedStaffId ?? 0) || null,
        ...summary
      };
    });
  }
  async findOne(id: number) {
    const candidate = await this.repo.findOne({ where: { id } });
    if (candidate) {
      const followUps = await this.fuRepo.find({ where: { hr_candidate_id: id }, order: { created_at: 'DESC' } });
      (candidate as any).follow_ups = followUps;
      // Device-synced call logs (prismark call logger) with staff relation.
      // id DESC breaks created_at ties deterministically (bulk syncs share
      // second precision) — same contract as leads.
      const contactLogs = await this.contactLogRepo.find({
        where: { hr_candidate_id: id },
        relations: { sent_by: true },
        order: { created_at: 'DESC', id: 'DESC' },
      });
      (candidate as any).contact_logs = contactLogs;
    }
    if (!candidate) {
      throw new NotFoundException(`Candidate with ID ${id} not found`);
    }
    const names = await this.assigneeNames([candidate.assignedStaffId]);
    candidate.assignedStaff = names.get(candidate.assignedStaffId ?? 0) || null;
    if (candidate.hrSourceId) {
      const source = (await this.master.getHrSources()).find(source => source.id === candidate.hrSourceId);
      if (source) candidate.recruitmentSource = source.name;
    }
    return candidate;
  }

  private async assigneeNames(ids: (number | null | undefined)[]) {
    const unique = [...new Set(ids.filter((id): id is number => typeof id === 'number' && id > 0))];
    if (!unique.length) return new Map<number, { id: number; name: string }>();
    const users = await this.users.find({ where: { id: In(unique) }, select: { id: true, name: true } });
    return new Map(users.map(user => [user.id, { id: user.id, name: user.name }]));
  }

  async getAssignableStaff() {
    const users = await this.users.find({
      where: { is_active: true }, relations: { department: true },
      select: { id: true, name: true, is_active: true, department: { id: true, name: true } }, order: { name: 'ASC' },
    });
    return users.filter(user => {
      const department = (user.department?.name || '').toLowerCase().replace(/department/g, '').replace(/[^a-z]/g, '');
      return user.is_active && ['hr', 'humanresources', 'humanresource'].includes(department);
    }).map(user => ({ id: user.id, name: user.name, department: { id: user.department.id, name: user.department.name } }));
  }

  private assertMayAssign(actor: { id?: number; role?: string } | undefined, target: number | null) {
    if (!actor) return;
    if (['Super Admin', 'Admin', 'Manager', 'Team Lead'].includes(actor.role || '')) return;
    if (actor.role === 'Staff' && target === Number(actor.id)) return;
    throw new ForbiddenException('Your role cannot assign candidates to another staff member');
  }

  async assignCandidates(ids: number[], target: number | null, actor?: { id?: number; role?: string }) {
    this.assertMayAssign(actor, target);
    if (target !== null && !(await this.getAssignableStaff()).some(staff => staff.id === target)) {
      throw new BadRequestException('Choose an active staff member from the HR department');
    }
    const candidates = await this.repo.find({ where: { id: In(ids) }, select: { id: true } });
    if (candidates.length !== new Set(ids).size) throw new NotFoundException('One or more candidates were not found');
    await this.repo.update({ id: In(ids) }, { assignedStaffId: target });
    return { success: true, assigned: ids.length };
  }

  private async resolveReferences<T extends Partial<CreateHrCandidateDto>>(data: T, current?: HrCandidate, actor?: { id?: number; role?: string }): Promise<T> {
    const resolved = { ...data };
    // City is manual text again; remove the old city-master link when edited.
    if (data.city !== undefined) resolved.cityId = null;
    if (data.hrSourceId != null) {
      const source = (await this.master.getHrSources()).find(item => item.id === data.hrSourceId
        && (item.is_active || current?.hrSourceId === data.hrSourceId));
      if (!source) throw new BadRequestException('Choose an active HR source');
      resolved.recruitmentSource = source.name;
    } else if (data.hrSourceId === null && data.recruitmentSource === undefined) {
      resolved.recruitmentSource = '';
    }
    if (data.assignedStaffId !== undefined && data.assignedStaffId !== (current?.assignedStaffId ?? null)) {
      this.assertMayAssign(actor, data.assignedStaffId);
      if (data.assignedStaffId !== null && !(await this.getAssignableStaff()).some(staff => staff.id === data.assignedStaffId)) {
        throw new BadRequestException('Choose an active staff member from the HR department');
      }
    }
    return resolved;
  }

  async create(data: CreateHrCandidateDto, actor?: { id?: number; role?: string }) {
    const { interviewDate, ...rest } = await this.resolveReferences(data, undefined, actor);
    const saved = await this.repo.save(this.repo.create({ ...rest, ...this.interviewFields(rest), interviewDate: interviewDate ? new Date(interviewDate) : null } as Partial<HrCandidate>));
    await this.events?.emitAsync('hr.candidate.created', { entityId: saved.id, actorId: actor?.id ?? null });
    return saved;
  }
  async update(id: number, data: UpdateHrCandidateDto, actor?: { id?: number; role?: string }) {
    const current = await this.findOne(id);
    const { interviewDate, ...rest } = await this.resolveReferences(data, current, actor);
    await this.repo.update(id, {
      ...rest,
      ...this.interviewFields(rest),
      ...(interviewDate !== undefined ? { interviewDate: interviewDate ? new Date(interviewDate) : null } : {}),
    } as Partial<HrCandidate>);
    const updated = await this.findOne(id);
    await this.emitChanges(current, updated, actor);
    return updated;
  }

  /** Empty strings from the form clear the optional interview columns. */
  private interviewFields(data: Partial<CreateHrCandidateDto>) {
    const fields: Partial<HrCandidate> = {};
    if (data.interviewTime !== undefined) fields.interviewTime = data.interviewTime || null;
    if (data.interviewMode !== undefined) fields.interviewMode = data.interviewMode || null;
    if (data.interviewLocation !== undefined) fields.interviewLocation = data.interviewLocation?.trim() || null;
    if (data.interviewLink !== undefined) fields.interviewLink = data.interviewLink?.trim() || null;
    return fields;
  }

  private async emitChanges(before: HrCandidate, after: HrCandidate, actor?: { id?: number }) {
    if (!this.events) return;
    const base = { entityId: after.id, actorId: actor?.id ?? null };
    if (before.status !== after.status) {
      await this.events.emitAsync('hr.candidate.status_changed', { ...base, from: before.status, to: after.status });
    } else if (after.status === HrCandidateStatus.INTERVIEW_SCHEDULED && interviewSignature(before) !== interviewSignature(after)) {
      await this.events.emitAsync('hr.candidate.interview_rescheduled', base);
    }
  }

  async bulkImport(rows: HrImportRowDto[], actor?: { id?: number; role?: string }) {
    const [sources, staff] = await Promise.all([this.master.getHrSources(), this.getAssignableStaff()]);
    const sourceMap = new Map(sources.filter(source => source.is_active).map(source => [source.id, source]));
    const staffMap = new Map(staff.map(user => [user.id, user]));
    const candidates = rows.map((row, index) => {
      const rowNumber = row.rowNumber ?? index + 2;
      const source = sourceMap.get(row.hrSourceId);
      if (!source) throw new BadRequestException(`Row ${rowNumber}: HR Source id ${row.hrSourceId} is unknown or inactive`);
      if (row.staffId != null) {
        if (!staffMap.has(row.staffId)) throw new BadRequestException(`Row ${rowNumber}: Staff ID ${row.staffId} must belong to an active user in the HR department`);
        this.assertMayAssign(actor, row.staffId);
      }
      return {
        name: row.name.trim(), mobile: normalizeCandidateMobile(row.mobile), position: row.role.trim(),
        department: '', experience: row.experience ?? '', cityId: null, city: row.location.trim(), state: '',
        hrSourceId: row.hrSourceId, recruitmentSource: source.name, assignedStaffId: row.staffId ?? null,
        status: HrCandidateStatus.NEW_APPLICATION,
      };
    });
    return this.repo.manager.transaction(async manager => {
      const existing = await manager.find(HrCandidate, { select: { mobile: true } });
      const seen = new Set(existing.map(candidate => normalizeCandidateMobile(candidate.mobile)));
      const fresh = candidates.filter(candidate => {
        if (seen.has(candidate.mobile)) return false;
        seen.add(candidate.mobile);
        return true;
      });
      if (fresh.length) await manager.save(HrCandidate, fresh, { chunk: 100 });
      return { success: true, created: fresh.length, skipped: candidates.length - fresh.length, total: candidates.length,
        assigned: fresh.filter(candidate => candidate.assignedStaffId !== null).length };
    });
  }
  async remove(id: number) {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  async addFollowUp(id: number, data: Partial<HrFollowUp>) {
    const fu = this.fuRepo.create({ ...data, hr_candidate_id: id });
    return this.fuRepo.save(fu);
  }
  async updateFollowUp(id: number, fuId: number, data: Partial<HrFollowUp>) {
    await this.fuRepo.update(fuId, data);
    return { success: true };
  }
  async deleteFollowUp(id: number, fuId: number) {
    await this.fuRepo.delete(fuId);
    return { success: true };
  }
}