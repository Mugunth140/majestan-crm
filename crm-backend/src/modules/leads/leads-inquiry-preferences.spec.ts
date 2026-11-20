import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('LeadsService.updateInquiry preferencesPatch', () => {
  let service: LeadsService;
  let saved: any;
  let query: jest.Mock;

  beforeEach(async () => {
    const stored = { id: 5, lead_id: 1, funder: 'bank', preferences: { bhk: '3', facing: 'east' } };
    const inquiryRepo = {
      findOne: jest.fn(async () => ({ ...stored })),
      save: jest.fn(async (e: any) => { saved = { ...e }; return { ...e }; }),
    };
    query = jest.fn(async (sql: string) => (sql.startsWith('SELECT') ? [{ preferences: '{"bhk":"3","maxBudget":9000000}' }] : undefined));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: getDataSourceToken(), useValue: { getRepository: () => inquiryRepo, query } },
        { provide: getDataSourceToken('site'), useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: TasksService, useValue: {} },
      ],
    }).compile();
    service = module.get<LeadsService>(LeadsService);
  });

  it('merges the patch in one statement and never saves a stale preferences copy', async () => {
    const result = await service.updateInquiry(1, 5, { funder: 'self', preferencesPatch: { maxBudget: 9000000, facing: '' } });

    expect(saved.preferences).toBeUndefined();
    expect(saved.funder).toBe('self');
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('JSON_MERGE_PATCH');
    expect(JSON.parse(params[0])).toEqual({ maxBudget: 9000000, facing: null });
    expect(params[1]).toBe(5);
    expect(result.preferences).toEqual({ bhk: '3', maxBudget: 9000000 });
  });

  it('patches road name and property age like any other preference', async () => {
    await service.updateInquiry(1, 5, { preferencesPatch: { roadName: 'Avinashi Road', propertyAge: '1-5' } });
    expect(JSON.parse(query.mock.calls[0][1][0])).toEqual({ roadName: 'Avinashi Road', propertyAge: '1-5' });

    query.mockClear();
    await service.updateInquiry(1, 5, { preferencesPatch: { roadName: '' } });
    expect(JSON.parse(query.mock.calls[0][1][0])).toEqual({ roadName: null });
  });

  it('leaves preferences to a full replacement when one is sent', async () => {
    await service.updateInquiry(1, 5, { preferences: { bhk: '2' } });
    expect(saved.preferences).toEqual({ bhk: '2' });
    expect(query).not.toHaveBeenCalled();
  });
});
