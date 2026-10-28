import { HrService } from './hr.service';
import { HrCandidateStatus } from '../../database/entities/hr-candidate.entity';

function setup(before: any, after: any) {
  let reads = 0;
  const repo: any = {
    findOne: async () => ({ ...(reads++ === 0 ? before : after) }),
    update: jest.fn().mockResolvedValue({}),
  };
  const events: any = { emitAsync: jest.fn().mockResolvedValue([]) };
  const empty: any = { find: async () => [] };
  const master: any = { getHrSources: async () => [] };
  const users: any = { find: async () => [] };
  const service = new HrService(repo, empty, empty, master, users, events);
  return { service, events };
}

const base = { id: 4, status: HrCandidateStatus.RESUME_SHORTLISTED, interviewDate: null, interviewTime: null, interviewMode: null };

describe('HR domain events for mail', () => {
  it('emits status_changed with from/to when the status changes', async () => {
    const { service, events } = setup(base, { ...base, status: HrCandidateStatus.INTERVIEW_SCHEDULED });
    await service.update(4, { status: HrCandidateStatus.INTERVIEW_SCHEDULED }, { id: 2, role: 'Admin' });
    expect(events.emitAsync).toHaveBeenCalledWith('hr.candidate.status_changed', {
      entityId: 4, actorId: 2, from: HrCandidateStatus.RESUME_SHORTLISTED, to: HrCandidateStatus.INTERVIEW_SCHEDULED,
    });
  });

  it('emits interview_rescheduled when interview details change while scheduled', async () => {
    const scheduled = { ...base, status: HrCandidateStatus.INTERVIEW_SCHEDULED };
    const { service, events } = setup(scheduled, { ...scheduled, interviewTime: '11:00:00' });
    await service.update(4, { interviewTime: '11:00' }, { id: 2, role: 'Admin' });
    expect(events.emitAsync).toHaveBeenCalledWith('hr.candidate.interview_rescheduled', { entityId: 4, actorId: 2 });
  });

  it('emits nothing for unrelated edits', async () => {
    const { service, events } = setup(base, { ...base });
    await service.update(4, { experience: '3 years' }, { id: 2, role: 'Admin' });
    expect(events.emitAsync).not.toHaveBeenCalled();
  });
});
