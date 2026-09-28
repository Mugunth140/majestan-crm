import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { Lead } from '../../database/entities/lead.entity';
import { LeadFollowUp } from '../../database/entities/lead-follow-up.entity';
import { LeadInquiry } from '../../database/entities/lead-inquiry.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { getDataSourceToken } from '@nestjs/typeorm';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('LeadsService.updateLead data preservation', () => {
  let service: LeadsService;
  let savedLead: any;
  let findOneImpl: jest.Mock;

  const existing = () => ({
    id: 1,
    name: 'Keep Me',
    mobile_number: '9876543210',
    email: 'keep@example.com',
    whatsapp_number: null,
    city: 'Coimbatore',
    address: null,
    lead_source: 'Website',
    commission: null,
    is_referral: false,
    referred_by_name: null,
    referred_by_contact: null,
  });

  beforeEach(async () => {
    savedLead = null;
    findOneImpl = jest.fn(async () => null);

    const leadRepo = { findOne: findOneImpl };
    const inquiryRepo = { findOne: jest.fn(async () => null), create: (o: any) => ({ ...o }) };
    const manager = {
      getRepository: (entity: any) => {
        if (entity === Lead) return leadRepo;
        if (entity === LeadInquiry) return inquiryRepo;
        if (entity === LeadFollowUp) return { create: (o: any) => ({ ...o }) };
        throw new Error('unexpected repository');
      },
      save: jest.fn(async (_entity: any, e?: any) => {
        savedLead = { ...(Array.isArray(e) ? e[0] : e) };
        return savedLead;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: getDataSourceToken(),
          useValue: { transaction: jest.fn(async (cb: any) => cb(manager)) },
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

  it('leaves absent fields untouched on partial payloads', async () => {
    findOneImpl.mockResolvedValueOnce(existing());

    await service.updateLead(1, { email: 'new@example.com' });

    expect(savedLead.name).toBe('Keep Me');
    expect(savedLead.mobile_number).toBe('9876543210');
    expect(savedLead.email).toBe('new@example.com');
    expect(savedLead.city).toBe('Coimbatore');
  });

  it('normalizes a +91 mobile instead of false-conflicting or storing it raw', async () => {
    findOneImpl
      .mockResolvedValueOnce(existing())
      .mockResolvedValueOnce(null); // conflict check: no other lead

    await service.updateLead(1, { mobile: '+91 99999 99999', name: 'Keep Me' });

    expect(findOneImpl).toHaveBeenNthCalledWith(2, { where: { mobile_number: '9999999999' } });
    expect(savedLead.mobile_number).toBe('9999999999');
  });

  it('skips the conflict check when the number is unchanged', async () => {
    findOneImpl.mockResolvedValueOnce(existing());

    await service.updateLead(1, { mobile: '+91 98765 43210', name: 'Keep Me' });

    expect(findOneImpl).toHaveBeenCalledTimes(1);
    expect(savedLead.mobile_number).toBe('9876543210');
  });

  it('still rejects a move onto another lead’s number', async () => {
    findOneImpl
      .mockResolvedValueOnce(existing())
      .mockResolvedValueOnce({ id: 2, mobile_number: '9999999999' });

    await expect(service.updateLead(1, { mobile: '9999999999' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(savedLead).toBeNull();
  });
});
