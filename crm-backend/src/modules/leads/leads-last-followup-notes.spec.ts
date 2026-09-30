import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

// getLeads() is raw SQL through dataSource.query, so there is no live database
// here: these tests lock the shape of the emitted SQL (the latest_actual_f
// sub-select has to carry `notes` on the same ROW_NUMBER partition that picks
// the last follow-up) and the shape of the row mapping that Task 3's
// "Last Followup" tooltip reads.
describe('LeadsService.getLeads — last follow-up notes', () => {
  let service: LeadsService;
  let queryMock: jest.Mock;

  // The data query is the second query issued: first comes COUNT(*).
  const dataSql = () =>
    queryMock.mock.calls.map((c) => c[0] as string).find((sql) => sql.includes('latest_actual_f.follow_up_date as lastFollowedUpDate'));

  // The `latest_actual_f` derived table body, without its join condition.
  const latestActualSubSelect = (sql: string) =>
    (sql.match(/LEFT JOIN \(\s*SELECT lead_id, follow_up_date[\s\S]*?\) latest_actual_f ON/) || [''])[0];

  beforeEach(async () => {
    queryMock = jest.fn()
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: getDataSourceToken(),
          useValue: { query: queryMock, getRepository: jest.fn() }
        },
        {
          provide: getDataSourceToken('site'),
          useValue: {}
        },
        {
          provide: NotificationsService,
          useValue: {}
        },
        {
          provide: TasksService,
          useValue: {}
        }
      ]
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  it('selects notes from the latest dated follow-up', async () => {
    await service.getLeads();

    const sql = dataSql();
    expect(sql).toBeDefined();
    // The notes must ride on the same partition that picks the last follow-up.
    expect(sql).toContain('latest_actual_f.notes as lastFollowedUpNotes');
    // Pinned inside the sub-select: this is the partition that defines "last
    // follow-up", so a predicate hoisted to the outer WHERE would change which
    // rows qualify.
    expect(latestActualSubSelect(sql!)).toContain('WHERE follow_up_date IS NOT NULL');
    // `notes` must also be projected by the sub-select itself, otherwise
    // MySQL rejects latest_actual_f.notes as an unknown column.
    expect(latestActualSubSelect(sql!)).toContain('follow_up_time, notes');
    // The next-follow-up sub-select is untouched by this feature.
    expect(sql).toContain('next_follow_up_date, next_follow_up_time, priority,');
  });

  it('breaks same-date ties by recency so the tooltip shows the newest notes', async () => {
    await service.getLeads();

    // Two follow-ups logged on the same day would otherwise be ordered
    // arbitrarily, so the "Last Followup" column could surface the wrong notes.
    expect(latestActualSubSelect(dataSql()!)).toContain(
      'ORDER BY follow_up_date DESC, created_at DESC, id DESC',
    );
  });

  it('maps lastFollowedUpNotes onto every row', async () => {
    queryMock.mockReset();
    queryMock
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([
        {
          rawId: 1,
          name: 'With notes',
          lastFollowedUpDate: '2026-09-20',
          lastFollowedUpNotes: 'Spoke to owner, wants a viewing.'
        },
        {
          rawId: 2,
          name: 'No follow-up notes',
          lastFollowedUpDate: '2026-09-21',
          lastFollowedUpNotes: null
        }
      ]);

    const result = await service.getLeads();

    expect(result.data).toHaveLength(2);
    expect(result.data[0].lastFollowedUpNotes).toBe('Spoke to owner, wants a viewing.');
    // Null when the join yields nothing (or the notes column is empty).
    expect(result.data[1].lastFollowedUpNotes).toBeNull();
    // The lead-level notes field is unrelated to follow-ups and stays empty —
    // asserted on the row that HAS follow-up notes, so repointing `notes` at
    // the follow-up value would fail here rather than silently ship.
    expect(result.data[1].notes).toBe('');
    expect(result.data[0].notes).toBe('');
  });
});
