import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { LeadRoutingService } from './lead-routing.service';
import { NotificationsService } from '../notifications/notifications.service';

jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

describe('LeadRoutingService.siteVisitComplete', () => {
  it('is a no-op when the lead already moved to sales', async () => {
    const createNotification = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadRoutingService,
        {
          provide: getDataSourceToken(),
          useValue: {
            getRepository: () => ({
              findOne: async () => ({
                id: 806,
                department: 'sales',
                status: 'Negotiation',
                assigned_staff_id: 12,
              }),
            }),
          },
        },
        { provide: getDataSourceToken('site'), useValue: {} },
        { provide: NotificationsService, useValue: { createNotification } },
      ],
    }).compile();

    const service = module.get<LeadRoutingService>(LeadRoutingService);

    await expect(service.siteVisitComplete(806, 12, 'site visit done')).resolves.toBeUndefined();
    expect(createNotification).not.toHaveBeenCalled();
  });
});
