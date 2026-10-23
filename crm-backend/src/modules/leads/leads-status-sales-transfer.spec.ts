import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { LeadsService } from './leads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { Lead } from '../../database/entities/lead.entity';
import { SALES_PIPELINE_STATUSES } from './lead-statuses';
import { transferLeadToSales } from '../lead-routing/transfer-to-sales';

jest.mock('bun', () => ({ S3Client: class {} }), { virtual: true });
jest.mock('../lead-routing/transfer-to-sales', () => ({
  transferLeadToSales: jest.fn(),
}));

describe('LeadsService.updateLeadStatus — sales pipeline handover', () => {
  let service: LeadsService;
  let lead: Partial<Lead>;
  let save: jest.Mock;
  let tasksService: { autoIncrementFromLeadStatus: jest.Mock };
  const transferMock = transferLeadToSales as jest.Mock;

  beforeEach(async () => {
    lead = { id: 42, department: 'telecalling', assigned_staff_id: 7, status: 'Interested' };
    save = jest.fn(async (l) => l);
    tasksService = { autoIncrementFromLeadStatus: jest.fn(async () => {}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: getDataSourceToken(),
          useValue: {
            getRepository: jest.fn(() => ({
              findOne: jest.fn(async () => lead),
              save,
            })),
          },
        },
        { provide: getDataSourceToken('site'), useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: TasksService, useValue: tasksService },
      ],
    }).compile();

    service = module.get(LeadsService);
    transferMock.mockReset();
    transferMock.mockImplementation(async (_ds, _ns, moved) => {
      moved.department = 'sales';
      return moved;
    });
  });

  it.each(SALES_PIPELINE_STATUSES)('moves a telecalling lead to sales for "%s"', async (status) => {
    const result = await service.updateLeadStatus(42, { status_name: status }, 3);

    expect(transferMock).toHaveBeenCalledTimes(1);
    expect(transferMock.mock.calls[0][2]).toMatchObject({ id: 42, status });
    expect(transferMock.mock.calls[0][3]).toBe(3);
    expect(result.transferredToSales).toBe(true);
  });

  it('credits the telecalling owner, not the sales pipeline, on transfer', async () => {
    await service.updateLeadStatus(42, { status_name: 'Site Visit Completed' }, 3);

    expect(tasksService.autoIncrementFromLeadStatus).toHaveBeenCalledWith(
      expect.objectContaining({ department: 'telecalling', assigned_staff_id: 7 }),
      'Site Visit Completed',
    );
  });

  it('keeps a telecalling lead in telecalling before the site visit', async () => {
    const result = await service.updateLeadStatus(42, { status_name: 'Site Visit Scheduled' }, 3);

    expect(transferMock).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
    expect(result.transferredToSales).toBe(false);
  });

  it('does not transfer a lead already in sales', async () => {
    lead.department = 'sales';

    const result = await service.updateLeadStatus(42, { status_name: 'Negotiation' }, 3);

    expect(transferMock).not.toHaveBeenCalled();
    expect(result.transferredToSales).toBe(false);
  });
});
