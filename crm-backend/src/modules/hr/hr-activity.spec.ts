import { HrService } from './hr.service';
import { HrCandidateStatus } from '../../database/entities/hr-candidate.entity';

function setup(before: any, after: any) {
  let reads = 0;
  const repo: any = {
    findOne: async () => ({ ...(reads++ === 0 ? before : after) }),
    find: async () => [{ id: 4, assignedStaffId: before.assignedStaffId ?? null }],
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    save: async (row: any) => ({ id: 9, ...row }),
    create: (row: any) => row,
  };
  const empty: any = { find: async () => [] };
  const master: any = { getHrSources: async () => [] };
  const users: any = {
    find: async () => [{ id: 5, name: 'Priya' }, { id: 6, name: 'Arun' }],
    findOne: async () => null,
  };
  const recordEvents: any = { record: jest.fn(async () => {}), recordChanges: jest.fn(async () => {}) };
  const service = new HrService(repo, empty, empty, master, users, undefined, recordEvents);
  // Assignment checks look up the HR department; both test staff are in it.
  jest.spyOn(service, 'getAssignableStaff').mockResolvedValue([
    { id: 5, name: 'Priya', department: { id: 1, name: 'HR' } }, { id: 6, name: 'Arun', department: { id: 1, name: 'HR' } },
  ]);
  return { service, recordEvents };
}

const base = { id: 4, name: 'Nandini', status: HrCandidateStatus.NEW_APPLICATION, interviewDate: null, interviewTime: null, assignedStaffId: 5 };
const admin = { id: 2, role: 'Admin' };

describe('HR candidate activity', () => {
  it('records field edits with dates compared by day', async () => {
    const { service, recordEvents } = setup(
      { ...base, interviewDate: new Date(2026, 10, 4) },
      { ...base, interviewDate: '2026-11-04', position: 'Executive' },
    );
    await service.update(4, { position: 'Executive' }, admin);
    const [entity, id, actorId, before, after] = recordEvents.recordChanges.mock.calls[0];
    expect([entity, id, actorId]).toEqual(['hr', 4, 2]);
    expect(before.interviewDate).toBe(after.interviewDate);
    expect(after.position).toBe('Executive');
  });

  it('records a status change', async () => {
    const { service, recordEvents } = setup(base, { ...base, status: HrCandidateStatus.SELECTED });
    await service.update(4, { status: HrCandidateStatus.SELECTED }, admin);
    expect(recordEvents.record).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'hr', type: 'status_changed', from: HrCandidateStatus.NEW_APPLICATION, to: HrCandidateStatus.SELECTED,
    }));
  });

  it('records a reassignment by name', async () => {
    const { service, recordEvents } = setup(base, { ...base, assignedStaffId: 6 });
    await service.assignCandidates([4], 6, admin);
    expect(recordEvents.record).toHaveBeenCalledWith([expect.objectContaining({ entity: 'hr', entityId: 4, type: 'assigned', from: 'Priya', to: 'Arun' })]);
  });

  it('skips candidates already assigned to that person', async () => {
    const { service, recordEvents } = setup(base, base);
    await service.assignCandidates([4], 5, admin);
    expect(recordEvents.record).not.toHaveBeenCalled();
  });

  it('records creation and document uploads', async () => {
    const { service, recordEvents } = setup(base, base);
    await service.create({ name: 'Nandini', mobile: '9876543210', department: 'Sales', position: 'Executive' } as any, admin);
    expect(recordEvents.record).toHaveBeenCalledWith(expect.objectContaining({ entity: 'hr', entityId: 9, type: 'created', actorId: 2 }));
    await service.saveDocument(4, 'resume', 'hr-private://x', admin);
    expect(recordEvents.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'document_uploaded', field: 'resume' }));
  });
});
