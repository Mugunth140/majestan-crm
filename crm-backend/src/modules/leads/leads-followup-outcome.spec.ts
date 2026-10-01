import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('LeadsService addFollowUp outcome', () => {
  let service: LeadsService;
  let savedRows: any[];

  beforeEach(async () => {
    savedRows = [];
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: getDataSourceToken(),
          useValue: {
            query: jest.fn(),
            getRepository: jest.fn().mockImplementation(() => ({
              findOne: jest.fn().mockResolvedValue({ id: 7, rnr_consecutive_count: 0 }),
              save: jest.fn().mockImplementation(async (row: any) => {
                savedRows.push(row);
                return { id: 11, ...row };
              }),
            })),
          },
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

  it('persists the outcome on the follow-up row', async () => {
    await service.addFollowUp(7, {
      followUpDate: '2026-09-30',
      outcome: 'Not Interested',
      notes: 'Already bought elsewhere',
    });

    expect(savedRows).toHaveLength(1);
    expect(savedRows[0]).toMatchObject({
      outcome: 'Not Interested',
      notes: 'Already bought elsewhere',
    });
  });
});
