import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { Lead } from '../../database/entities/lead.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('LeadsService duplicate pre-checks', () => {
  let service: LeadsService;
  let leadRepo: any;
  let findOneImpl: jest.Mock;
  let qbGetManyImpl: jest.Mock;

  beforeEach(async () => {
    findOneImpl = jest.fn(async () => null);
    qbGetManyImpl = jest.fn(async () => []);
    leadRepo = {
      findOne: findOneImpl,
      createQueryBuilder: () => ({
        leftJoinAndSelect: function () { return this; },
        where: function () { return this; },
        getMany: qbGetManyImpl,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: getDataSourceToken(),
          useValue: { getRepository: (entity: any) => {
            if (entity === Lead) return leadRepo;
            throw new Error('unexpected repository');
          } },
        },
        {
          provide: getDataSourceToken('site'),
          useValue: {},
        },
        {
          provide: NotificationsService,
          useValue: {},
        },
        {
          provide: TasksService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  it('finds an existing lead after +91 normalization', async () => {
    findOneImpl.mockResolvedValueOnce({
      id: 12, name: 'Old Buyer', status: 'New Lead',
      assigned_staff: { name: 'Asha' },
    });

    const result = await service.checkMobileExists('+91 98765 43210');

    expect(findOneImpl).toHaveBeenCalledWith({
      where: { mobile_number: '9876543210' },
      relations: { assigned_staff: true },
    });
    expect(result.exists).toBe(true);
    expect(result.lead).toEqual({
      id: 12, displayId: 'L00012', name: 'Old Buyer',
      status: 'New Lead', staff: 'Asha',
    });
  });

  it('returns exists:false when no lead matches', async () => {
    const result = await service.checkMobileExists('9999999999');
    expect(result).toEqual({ exists: false, lead: null });
  });

  it('does not flag the lead being edited (excludeId)', async () => {
    findOneImpl.mockResolvedValueOnce({
      id: 7, name: 'Self', status: 'New Lead', assigned_staff: null,
    });
    const result = await service.checkMobileExists('9876543210', 7);
    expect(result).toEqual({ exists: false, lead: null });
  });

  it('skips the query for blank input', async () => {
    const result = await service.checkMobileExists('   ');
    expect(findOneImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ exists: false, lead: null });
  });

  it('bulk check maps stored numbers and dedupes input', async () => {
    qbGetManyImpl.mockResolvedValueOnce([
      { id: 3, name: 'A', status: 'New Lead', mobile_number: '1111111111', assigned_staff: null },
    ]);

    const result = await service.bulkCheckMobiles(['+91 11111 11111', '1111111111', '2222222222']);

    expect(result.existing['1111111111']).toEqual({
      id: 3, displayId: 'L00003', name: 'A',
      status: 'New Lead', staff: 'Unassigned',
    });
    expect(result.existing['2222222222']).toBeUndefined();
  });

  it('bulk check returns empty map for empty input', async () => {
    const result = await service.bulkCheckMobiles([]);
    expect(result).toEqual({ existing: {} });
    expect(qbGetManyImpl).not.toHaveBeenCalled();
  });
});
