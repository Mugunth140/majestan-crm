import { DataSource } from 'typeorm';
import { Lead } from '../../database/entities/lead.entity';
import { User } from '../../database/entities/user.entity';
import { RoutingHistory } from '../../database/entities/routing-history.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { transferLeadToSales } from './transfer-to-sales';

describe('transferLeadToSales', () => {
  it('moves the lead to sales and keeps its current owner', async () => {
    const lead = {
      id: 7,
      department: 'telecalling',
      assigned_staff_id: 12,
      status: 'Negotiation',
    } as unknown as Lead;

    const leadSave = jest.fn(async (l: Lead) => l);
    const historyCreate = jest.fn((h: Partial<RoutingHistory>) => h);
    const historySave = jest.fn(async (h: Partial<RoutingHistory>) => h);
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => [{ id: 3 }]),
    };
    const dataSource = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Lead) return { save: leadSave };
        if (entity === RoutingHistory) return { create: historyCreate, save: historySave };
        return { createQueryBuilder: jest.fn(() => queryBuilder) };
      }),
    } as unknown as DataSource;
    const notifications = {
      createNotification: jest.fn(async () => {}),
    } as unknown as NotificationsService;

    const saved = await transferLeadToSales(dataSource, notifications, lead, 12, 'status changed');

    expect(saved.department).toBe('sales');
    expect(saved.assigned_staff_id).toBe(12);
    expect(leadSave).toHaveBeenCalledWith(lead);
    expect(historyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: 7,
        event_type: 'Auto-transferred',
        from_user_id: 12,
        to_user_id: 12,
        actioned_by_id: 12,
        department: 'sales',
      }),
    );
    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
  });
});
