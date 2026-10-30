import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { HrService } from './hr.service';
import { CreateHrFollowUpDto } from './dto/create-hr-follow-up.dto';
import { UpdateHrFollowUpDto } from './dto/update-hr-follow-up.dto';
import { HrFollowUp } from '../../database/entities/hr-follow-up.entity';
import { toHrFollowUpPayload } from '../../../../crm-frontend/src/lib/hr-follow-up';
import { matchesHrActionFilter } from '../../../../crm-frontend/src/lib/hr-action-required';

const now = new Date('2026-10-30T08:00:00Z');
const pipe = new ValidationPipe({ whitelist: true, transform: true });

describe('HR follow-up form to Action Required contract', () => {
  let service: HrService;
  let history: HrFollowUp[];
  beforeEach(() => {
    history = [];
    const candidates = { find: async () => [{ id: 7, status: 'New Application' }] };
    const followUps = {
      create: (data: Partial<HrFollowUp>) => ({ id: 1, created_at: now, ...data }),
      save: async (data: HrFollowUp) => { history.push(data); return data; },
      find: async () => history,
      update: async (id: number, data: Partial<HrFollowUp>) => { Object.assign(history.find(item => item.id === id)!, data); },
    };
    service = new HrService(candidates as never, followUps as never, {} as never,
      { getHrSources: async () => [] } as never, {} as never);
  });

  async function create(nextFollowUpDate: string) {
    const payload = toHrFollowUpPayload({ nextFollowUpDate, nextFollowUpTime: '10:30', notes: 'Discuss interview' }, now);
    const validated = await pipe.transform(payload, { type: 'body', metatype: CreateHrFollowUpDto });
    await service.addFollowUp(7, validated);
    return (await service.findAll())[0];
  }

  it.each([['Overdue', '2026-10-29'], ['Today', '2026-10-30'], ['Tomorrow', '2026-10-31'], ['All Scheduled', '2026-11-02']])('retains a saved schedule through validation, persistence and the %s queue', async (filter, date) => {
    const candidate = await create(date);
    expect(history[0]).toMatchObject({ hr_candidate_id: 7, next_follow_up_date: date, next_follow_up_time: '10:30', follow_up_date: '2026-10-30' });
    expect(matchesHrActionFilter(candidate, filter, 'pending', now)).toBe(true);
  });

  it('records contact dates for completed today and yesterday', async () => {
    const candidate = await create('2026-11-02');
    expect(matchesHrActionFilter(candidate, 'Today', 'completed', now)).toBe(true);
    expect(matchesHrActionFilter(candidate, 'Yesterday', 'pending', new Date('2026-10-31T08:00:00Z'))).toBe(true);
  });

  it('reschedules through the shared editor without losing the original contact date', async () => {
    await create('2026-10-30');
    const payload = toHrFollowUpPayload({ nextFollowUpDate: '2026-10-31', nextFollowUpTime: '14:00' });
    await service.updateFollowUp(7, 1, await pipe.transform(payload, { type: 'body', metatype: UpdateHrFollowUpDto }));
    const candidate = (await service.findAll())[0];
    expect(matchesHrActionFilter(candidate, 'Today', 'pending', now)).toBe(false);
    expect(matchesHrActionFilter(candidate, 'Tomorrow', 'pending', now)).toBe(true);
    expect(candidate.lastFollowedUpDate).toBe('2026-10-30');
  });

  it('clears schedules through the API without leaving a stale due date', async () => {
    await create('2026-10-30');
    const payload = toHrFollowUpPayload({ nextFollowUpDate: '', nextFollowUpTime: '' });
    await service.updateFollowUp(7, 1, await pipe.transform(payload, { type: 'body', metatype: UpdateHrFollowUpDto }));
    const candidate = (await service.findAll())[0];
    expect(candidate.nextFollowUpDate).toBeNull();
    expect(matchesHrActionFilter(candidate, 'Today', 'pending', now)).toBe(false);
  });
});
