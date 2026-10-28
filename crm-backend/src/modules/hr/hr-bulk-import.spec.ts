import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { HrService } from './hr.service';
import { BulkImportHrDto } from './dto/bulk-import-hr.dto';
import { HrCandidate, HrCandidateStatus } from '../../database/entities/hr-candidate.entity';
const row = { name: 'Nandini Rao', mobile: '9876543210', role: 'Sales Executive', experience: '2 years', location: 'Peelamedu, Coimbatore', hrSourceId: 3, staffId: 12, rowNumber: 2 };
const actor = { id: 1, role: 'Admin' };
describe('HR bulk import and assignment', () => {
  let service: HrService; let repo: any; let manager: any; let master: any; let users: any;
  beforeEach(() => {
    manager = { find: jest.fn().mockResolvedValue([]), save: jest.fn().mockResolvedValue([]) };
    repo = { manager: { transaction: jest.fn(async run => run(manager)) }, create: jest.fn(value => value), save: jest.fn(async value => value), update: jest.fn(), findOne: jest.fn(), find: jest.fn() };
    master = { getHrSources: jest.fn().mockResolvedValue([{ id: 3, name: 'Nithra', is_active: true }, { id: 4, name: 'Old source', is_active: false }]) };
    users = { find: jest.fn().mockResolvedValue([
      { id: 12, name: 'Kavya', is_active: true, department: { id: 5, name: 'HR Department' } },
      { id: 13, name: 'Arjun', is_active: true, department: { id: 2, name: 'Sales' } },
      { id: 14, name: 'Inactive staff', is_active: false, department: { id: 5, name: 'HR' } },
    ]) };
    service = new HrService(repo, { find: async () => [] } as any, { find: async () => [] } as any, master, users);
  });
  it('maps manual Location and HR source and auto assigns imported candidates to HR staff', async () => {
    expect(await service.bulkImport([row], actor)).toEqual({ success: true, created: 1, skipped: 0, total: 1, assigned: 1 });
    expect(manager.save).toHaveBeenCalledWith(HrCandidate, [expect.objectContaining({ position: 'Sales Executive', department: '', city: 'Peelamedu, Coimbatore', cityId: null, state: '', hrSourceId: 3, recruitmentSource: 'Nithra', assignedStaffId: 12, status: HrCandidateStatus.NEW_APPLICATION })], { chunk: 100 });
  });
  it.each([13, 14, 999])('rejects a non-HR, inactive or missing Staff ID %s before saving any candidate', async staffId => {
    await expect(service.bulkImport([row, { ...row, staffId, rowNumber: 3 }], actor)).rejects.toThrow('Row 3: Staff ID');
    expect(repo.manager.transaction).not.toHaveBeenCalled();
  });
  it.each([4, 999])('rejects an inactive or unknown HR source %s before writing', async hrSourceId => {
    await expect(service.bulkImport([{ ...row, hrSourceId }], actor)).rejects.toThrow('HR Source id');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('keeps rows without Staff ID unassigned', async () => {
    expect(await service.bulkImport([{ ...row, staffId: undefined }], actor)).toMatchObject({ created: 1, assigned: 0 });
    expect(manager.save.mock.calls[0][1][0].assignedStaffId).toBeNull();
  });
  it('skips existing candidates without changing their assignment', async () => {
    manager.find.mockResolvedValue([{ mobile: '+91 98765 43210' }]);
    expect(await service.bulkImport([row], actor)).toMatchObject({ created: 0, skipped: 1, assigned: 0 });
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('filters the assignee list to active HR users and returns only directory fields', async () => {
    expect(await service.getAssignableStaff()).toEqual([{ id: 12, name: 'Kavya', department: { id: 5, name: 'HR Department' } }]);
  });
  it('supports bulk assignment and unassignment', async () => {
    repo.find.mockResolvedValue([{ id: 21 }, { id: 22 }]);
    expect(await service.assignCandidates([21, 22], 12, actor)).toMatchObject({ assigned: 2 });
    expect(repo.update).toHaveBeenLastCalledWith(expect.any(Object), { assignedStaffId: 12 });
    await service.assignCandidates([21, 22], null, actor);
    expect(repo.update).toHaveBeenLastCalledWith(expect.any(Object), { assignedStaffId: null });
  });
  it('rejects bulk assignment to a Sales user or when a candidate does not exist', async () => {
    await expect(service.assignCandidates([21], 13, actor)).rejects.toThrow('HR department');
    repo.find.mockResolvedValue([]);
    await expect(service.assignCandidates([21], 12, actor)).rejects.toThrow('not found');
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('prevents ordinary staff from assigning another person through import or update', async () => {
    await expect(service.bulkImport([row], { id: 15, role: 'Staff' })).rejects.toThrow('cannot assign');
    repo.findOne.mockResolvedValue({ id: 21, assignedStaffId: null });
    await expect(service.update(21, { assignedStaffId: 12 }, { id: 15, role: 'Staff' })).rejects.toThrow('cannot assign');
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('keeps manual city input and resolves HR source IDs on the candidate form', async () => {
    const saved = await service.create({ name: row.name, mobile: row.mobile, department: 'Sales', position: row.role, city: 'New location not in masters', state: 'Tamil Nadu', hrSourceId: 3, assignedStaffId: 12 }, actor);
    expect(saved).toMatchObject({ city: 'New location not in masters', cityId: null, state: 'Tamil Nadu', recruitmentSource: 'Nithra', hrSourceId: 3, assignedStaffId: 12 });
  });
  it('rejects manual candidate assignment to a non-HR staff member', async () => {
    await expect(service.create({ name: row.name, mobile: row.mobile, department: 'Sales', position: row.role, assignedStaffId: 13 }, actor)).rejects.toThrow('HR department');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
describe('HR import validation', () => {
  it('converts source/staff IDs to numbers and preserves zero experience', () => {
    const dto = plainToInstance(BulkImportHrDto, { candidates: [{ ...row, hrSourceId: '3', staffId: '12', experience: 0 }] });
    expect(validateSync(dto)).toEqual([]);
    expect(dto.candidates[0]).toMatchObject({ hrSourceId: 3, staffId: 12, experience: '0' });
  });
  it.each([{ name: '' }, { mobile: '123' }, { role: '' }, { location: '' }, { hrSourceId: 0 }, { staffId: -1 }, { staffId: 'unknown' }])('rejects malformed rows: %o', invalid => {
    expect(validateSync(plainToInstance(BulkImportHrDto, { candidates: [{ ...row, ...invalid }] })).length).toBeGreaterThan(0);
  });
  it('accepts a blank optional Staff ID and rejects empty/oversized batches', () => {
    expect(validateSync(plainToInstance(BulkImportHrDto, { candidates: [{ ...row, staffId: '' }] }))).toEqual([]);
    expect(validateSync(plainToInstance(BulkImportHrDto, { candidates: [] })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(BulkImportHrDto, { candidates: Array.from({ length: 501 }, () => row) })).length).toBeGreaterThan(0);
  });
});
