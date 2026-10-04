import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { LeadRoutingService } from './lead-routing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

const CLAIM_ROLES = ['Staff', 'Team Lead', 'Manager'];
const ASSIGN_ROLES = ['Team Lead', 'Manager', 'Admin'];

describe('claim/assign role rules', () => {
  let service: LeadRoutingService;
  let managerQueryMock: jest.Mock;
  let dataSourceQueryMock: jest.Mock;

  beforeEach(async () => {
    managerQueryMock = jest.fn().mockResolvedValue({ affectedRows: 1 });
    dataSourceQueryMock = jest.fn().mockResolvedValue({ affectedRows: 1 });

    const leadRow = { id: 7, assigned_staff_id: null, department: 'telecalling' };
    const userRow = { id: 3, name: 'Claimer', department_id: null };

    const repoFor = (entity: any) => {
      const name = entity?.name ?? '';
      return {
        findOne: async () =>
          name === 'Lead' ? { ...leadRow } : name === 'User' ? { ...userRow } : null,
        create: (x: any) => ({ ...x }),
        save: async (x: any) => ({ ...x }),
      };
    };

    const qbStub = () => {
      const stub: any = {};
      stub.leftJoin = () => stub;
      stub.andWhere = () => stub;
      stub.where = () => stub;
      stub.getMany = async () => [];
      return stub;
    };

    const manager = {
      query: managerQueryMock,
      getRepository: (e: any) => repoFor(e),
      save: async (x: any) => ({ ...x }),
      createQueryBuilder: () => qbStub(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadRoutingService,
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction: async (fn: any) => fn(manager),
            query: dataSourceQueryMock,
            getRepository: (e: any) => repoFor(e),
          },
        },
        {
          provide: getDataSourceToken('site'),
          useValue: { query: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: NotificationsService,
          useValue: { createNotification: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<LeadRoutingService>(LeadRoutingService);
  });

  it.each(CLAIM_ROLES)('claim allows role %s', async (role) => {
    await expect(service.claimLead(7, 3, role)).resolves.toBeDefined();
  });

  it('claim forbids a role outside Staff/Team Lead/Manager', async () => {
    await expect(service.claimLead(7, 3, 'Viewer')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('claim no longer acknowledges website enquiries (event-driven resolution)', async () => {
    await service.claimLead(7, 3, 'Staff');
    const ackCalls = managerQueryMock.mock.calls.filter(([sql]: any[]) =>
      String(sql).includes('acknowledged_at'),
    );
    expect(ackCalls).toHaveLength(0);
  });

  it.each(ASSIGN_ROLES)('assign allows role %s', async (role) => {
    await expect(service.assignLead(7, 5, 3, role)).resolves.toBeDefined();
  });

  it('assign forbids Staff', async () => {
    await expect(service.assignLead(7, 5, 3, 'Staff')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assign no longer acknowledges website enquiries (event-driven resolution)', async () => {
    await service.assignLead(7, 5, 3, 'Manager');
    const ackCalls = dataSourceQueryMock.mock.calls.filter(([sql]: any[]) =>
      String(sql).includes('acknowledged_at'),
    );
    expect(ackCalls).toHaveLength(0);
  });
});
