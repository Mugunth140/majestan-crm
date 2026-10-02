import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('acknowledgeEnquiry', () => {
  let service: LeadsService;
  let queryMock: jest.Mock;
  const LEAD = { id: 7, assigned_staff_id: 3 };

  beforeEach(async () => {
    queryMock = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: getDataSourceToken(),
          useValue: {
            query: queryMock,
            getRepository: (e: any) => (e.name === 'Lead'
              ? { findOne: async () => ({ ...LEAD }) }
              : {}),
          },
        },
        { provide: getDataSourceToken('site'), useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: TasksService, useValue: {} },
      ],
    }).compile();
    service = module.get<LeadsService>(LeadsService);
  });

  it('acknowledges open website enquiries for the assigned owner', async () => {
    queryMock.mockResolvedValueOnce({ affectedRows: 2 });
    const result = await service.acknowledgeEnquiry(7, 3);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('acknowledged_at'), [7]);
    expect(result).toEqual(expect.objectContaining({ acknowledged: 2 }));
  });

  it('forbids anyone who is not the assigned staff member', async () => {
    await expect(service.acknowledgeEnquiry(7, 9)).rejects.toBeInstanceOf(ForbiddenException);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('is a no-op success when nothing is open', async () => {
    queryMock.mockResolvedValueOnce({ affectedRows: 0 });
    const result = await service.acknowledgeEnquiry(7, 3);
    expect(result).toEqual(expect.objectContaining({ acknowledged: 0 }));
  });
});
