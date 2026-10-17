import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('LeadsService', () => {
  let service: LeadsService;
  let queryMock: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn()
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([])
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
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  it('should filter out unassigned leads for Admin users', async () => {
    await service.getLeads({ role: 'Admin', id: 99 });
    
    const countQuery = queryMock.mock.calls[0][0];
    expect(countQuery).toContain('l.assigned_staff_id IS NOT NULL');
  });

  it('should filter by latest follow-up priority', async () => {
    await service.getLeads({ role: 'Admin', id: 99 }, { priority: 'High' });

    const countQuery = queryMock.mock.calls[0][0];
    const params = queryMock.mock.calls[0][1];
    expect(countQuery).toContain('LOWER(latest_f.priority) = ?');
    expect(countQuery).toContain('next_follow_up_date, next_follow_up_time, priority,');
    expect(params).toContain('high');
  });

  it('should filter by budget overlap against inquiry preferences', async () => {
    await service.getLeads({ role: 'Admin', id: 99 }, { minBudget: '1000000', maxBudget: '5000000' });

    const countQuery = queryMock.mock.calls[0][0];
    const params = queryMock.mock.calls[0][1];
    expect(countQuery).toContain("$.minBudget");
    expect(countQuery).toContain("$.maxBudget");
    expect(params).toContain(1000000);
    expect(params).toContain(5000000);
  });

  it('should ignore non-numeric budget bounds', async () => {
    await service.getLeads({ role: 'Admin', id: 99 }, { minBudget: 'abc' });

    const countQuery = queryMock.mock.calls[0][0];
    expect(countQuery).not.toContain('$.minBudget');
  });

  it('keeps leads with an open same-day schedule in the Today follow-up queue', async () => {
    await service.getLeads({ role: 'Admin', id: 99 }, { tab: 'Action Required', actionFilter: 'Today', todayViewMode: 'pending' });

    const countQuery = queryMock.mock.calls[0][0];
    expect(countQuery).toContain('DATE(latest_f.next_follow_up_date) =');
    expect(countQuery).not.toContain('NOT EXISTS');
  });

  it('excludes leads with an open same-day schedule from Today followed-up', async () => {
    await service.getLeads({ role: 'Admin', id: 99 }, { tab: 'Action Required', actionFilter: 'Today', todayViewMode: 'completed' });

    const countQuery = queryMock.mock.calls[0][0];
    expect(countQuery).toContain('DATE(f.follow_up_date) =');
    expect(countQuery).toContain(`AND (latest_f.next_follow_up_date IS NULL OR DATE(latest_f.next_follow_up_date) !=`);
  });

  it('excludes Not Interested and Dropped leads from follow-up queues', async () => {
    await service.getLeads({ role: 'Admin', id: 99 }, { tab: 'Action Required', actionFilter: 'Today' });

    const countQuery = queryMock.mock.calls[0][0];
    const params = queryMock.mock.calls[0][1];
    expect(countQuery).toContain('l.status NOT IN (?, ?)');
    expect(params).toContain('Not Interested');
    expect(params).toContain('Dropped');
  });

  it('respects an explicit status filter over the queue exclusion', async () => {
    await service.getLeads({ role: 'Admin', id: 99 }, { tab: 'Action Required', actionFilter: 'Today', status: 'Not Interested' });

    const countQuery = queryMock.mock.calls[0][0];
    expect(countQuery).toContain('l.status = ?');
    expect(countQuery).not.toContain('NOT IN');
  });

  it('leaves the unfiltered leads list untouched by the queue exclusion', async () => {
    await service.getLeads({ role: 'Admin', id: 99 }, {});

    const countQuery = queryMock.mock.calls[0][0];
    expect(countQuery).not.toContain('NOT IN');
  });

  it('searches lead by formatted ID with L prefix (e.g. L00025)', async () => {
    await service.getLeads({ role: 'Admin', id: 99 }, { search: 'L00025' });

    const countQuery = queryMock.mock.calls[0][0];
    const params = queryMock.mock.calls[0][1];
    expect(countQuery).toContain('l.id = ?');
    expect(params).toContain(25);
  });

  it('searches lead by ID with hash prefix (e.g. #25)', async () => {
    await service.getLeads({ role: 'Admin', id: 99 }, { search: '#25' });

    const countQuery = queryMock.mock.calls[0][0];
    const params = queryMock.mock.calls[0][1];
    expect(countQuery).toContain('l.id = ?');
    expect(params).toContain(25);
  });

  it('returns filter dropdown options for the whole scope, ignoring the user filters', async () => {
    queryMock.mockReset();
    queryMock
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce([
        { kind: 'status', value: 'Contacted' },
        { kind: 'status', value: 'New Lead' },
        { kind: 'status', value: 'New Lead' },
        { kind: 'source', value: 'Website' },
        { kind: 'category', value: 'Residential' },
        { kind: 'type', value: 'Villa' },
        { kind: 'staff', value: 'Anita' },
        { kind: 'status', value: '' },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.getLeads(
      { role: 'Admin', id: 99 },
      { dept: 'sales', tab: 'Unqualified', status: 'Contacted', staff: 'Anita' },
    );

    // Second query is the options query; it is scoped (role + tab + pipeline)...
    const optionsQuery = queryMock.mock.calls[1][0];
    const optionsParams = queryMock.mock.calls[1][1];
    expect(optionsQuery).toContain('l.assigned_staff_id IS NOT NULL');
    expect(optionsQuery).toContain('l.department = ?');
    expect(optionsQuery).toContain('l.is_unqualified = 1');
    expect(optionsParams).toEqual(['sales', 'sales', 'sales', 'sales', 'sales']);
    // ...but not narrowed by the user's own filters.
    expect(optionsQuery).not.toContain('l.status = ?');
    expect(optionsQuery).not.toContain('s.name = ?');
    // Deduped, sorted, empty values dropped.
    expect(result.meta.filterOptions).toEqual({
      statuses: ['Contacted', 'New Lead'],
      sources: ['Website'],
      categories: ['Residential'],
      types: ['Villa'],
      staff: ['Anita'],
    });
  });
});