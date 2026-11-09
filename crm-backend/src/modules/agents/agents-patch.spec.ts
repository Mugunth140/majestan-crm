import { describe, expect, it, mock } from 'bun:test';
import { ForbiddenException } from '@nestjs/common';
import { AgentsService } from './agents.service';

const setup = (agent: Record<string, unknown>) => {
  const saved: Record<string, unknown>[] = [];
  const repo = {
    findOne: mock(async () => ({ ...agent })),
    find: mock(async () => []),
    save: mock(async (a: Record<string, unknown>) => { saved.push({ ...a }); return a; }),
  };
  const recordEvents = { record: mock(async () => {}), recordChanges: mock(async () => {}) };
  const svc = new AgentsService({ getRepository: () => repo } as never, undefined, recordEvents as never);
  return { svc, saved, recordEvents };
};

describe('AgentsService.patchAgent', () => {
  it('stops staff from reassigning their agent', async () => {
    const { svc, saved } = setup({ id: 4, assigned_staff_id: 3, status: 'New', mobile_number: '9000000003' });
    await expect(svc.patchAgent(4, { assigned_staff_id: 5 }, { id: 3, role: 'Staff' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(saved).toHaveLength(0);
  });

  it('clears a field sent as null and records the edit and the status change', async () => {
    const { svc, saved, recordEvents } = setup({ id: 4, assigned_staff_id: 3, status: 'New', city: 'Madurai', mobile_number: '9000000003' });
    await svc.patchAgent(4, { city: null, status: 'Contacted' }, { id: 1, role: 'Admin' });
    expect(saved[0].city).toBeNull();
    expect(saved[0].status).toBe('Contacted');
    expect(recordEvents.recordChanges.mock.calls[0]).toEqual(['agent', 4, 1, expect.anything(), expect.anything(), ['city']] as never);
    expect(recordEvents.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'status_changed', from: 'New', to: 'Contacted' }));
  });
});

describe('AgentsService.findByMobile', () => {
  it('names the agent and their owner, and nothing else', async () => {
    const { svc } = setup({ id: 9, name: 'Rajesh Kumar', mobile_number: '9000000001', email: 'r@x.in', assigned_staff: { name: 'Tele Staff' } });
    expect(await svc.findByMobile(' 9000000001 ')).toEqual({ id: 9, name: 'Rajesh Kumar', existingStaff: 'Tele Staff' });
    expect(await svc.findByMobile('  ')).toBeNull();
  });
});
