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
      .mockResolvedValueOnce([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: getDataSourceToken(),
          useValue: { query: queryMock, getRepository: jest.fn() }
        },
        {
          provide: getDataSourceToken('siteConnection'),
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
});