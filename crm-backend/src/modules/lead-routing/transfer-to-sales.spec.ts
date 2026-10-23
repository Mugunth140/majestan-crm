import { DataSource } from 'typeorm';
import { Lead } from '../../database/entities/lead.entity';
import { User } from '../../database/entities/user.entity';
import { RoutingHistory } from '../../database/entities/routing-history.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { transferLeadToSales } from './transfer-to-sales';

function createHarness(salesUsers: Array<{ id: number }> = [{ id: 3 }]) {
  const lead = {
    id: 7,
    department: 'telecalling',
    assigned_staff_id: 12,
    status: 'Negotiation',
  } as unknown as Lead;

  const leadSave = jest.fn(async (l: Lead) => l);
  const historyCreate = jest.fn((h: Partial<RoutingHistory>) => h);
  const historySave = jest.fn(async (h: Partial<RoutingHistory>) => h);
  const ownerFindOne = jest.fn(async () => ({ id: 12, name: 'Dhanushree' }));
  const queryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => salesUsers),
  };

  const dataSource: any = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Lead) return { save: leadSave };
      if (entity === RoutingHistory) return { create: historyCreate, save: historySave };
      if (entity === User) return { findOne: ownerFindOne, createQueryBuilder: jest.fn(() => queryBuilder) };
      throw new Error('unexpected entity');
    }),
  };
  dataSource.transaction = jest.fn(async (callback: (manager: any) => Promise<unknown>) => callback(dataSource));

  const notifications = { createNotification: jest.fn(async () => undefined) };

  return {
    lead,
    leadSave,
    historyCreate,
    historySave,
    ownerFindOne,
    dataSource: dataSource as DataSource,
    transaction: dataSource.transaction as jest.Mock,
    notifications,
  };
}

describe('transferLeadToSales', () => {
  afterEach(() => jest.restoreAllMocks());

  it('commits the lead and history together, keeping the current owner', async () => {
    const h = createHarness();

    const saved = await transferLeadToSales(
      h.dataSource,
      h.notifications as unknown as NotificationsService,
      h.lead,
      12,
      'status changed',
    );

    expect(saved.department).toBe('sales');
    expect(saved.assigned_staff_id).toBe(12);
    expect(h.transaction).toHaveBeenCalledTimes(1);
    expect(h.leadSave).toHaveBeenCalledWith(h.lead);
    expect(h.historyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: 7,
        event_type: 'Auto-transferred',
        from_user_id: 12,
        to_user_id: 12,
        actioned_by_id: 12,
        feedback: 'status changed',
        department: 'sales',
      }),
    );
    expect(h.historySave).toHaveBeenCalled();
    expect(h.notifications.createNotification).toHaveBeenCalledWith(
      3,
      'Lead moved to Sales',
      expect.stringContaining('Still assigned to Dhanushree'),
      'lead_transferred',
      7,
      'lead',
    );
  });

  it('tells sales an unassigned lead is in the queue', async () => {
    const h = createHarness();
    h.lead.assigned_staff_id = null as unknown as number;

    await transferLeadToSales(
      h.dataSource,
      h.notifications as unknown as NotificationsService,
      h.lead,
      12,
      'status changed',
    );

    expect(h.ownerFindOne).not.toHaveBeenCalled();
    const message = h.notifications.createNotification.mock.calls[0][2];
    expect(message).toContain('Added to the Sales queue');
    expect(message).not.toContain('Still assigned');
  });

  it('does not reject when one sales notification fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const h = createHarness([{ id: 3 }, { id: 4 }]);
    h.notifications.createNotification
      .mockRejectedValueOnce(new Error('notify down'))
      .mockResolvedValueOnce(undefined);

    const saved = await transferLeadToSales(
      h.dataSource,
      h.notifications as unknown as NotificationsService,
      h.lead,
      12,
      'status changed',
    );

    expect(saved.department).toBe('sales');
    expect(h.historySave).toHaveBeenCalled();
    expect(h.notifications.createNotification).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('does not notify sales when the history write fails', async () => {
    const h = createHarness();
    h.historySave.mockRejectedValue(new Error('history down'));

    await expect(
      transferLeadToSales(
        h.dataSource,
        h.notifications as unknown as NotificationsService,
        h.lead,
        12,
        'status changed',
      ),
    ).rejects.toThrow('history down');

    expect(h.transaction).toHaveBeenCalledTimes(1);
    expect(h.notifications.createNotification).not.toHaveBeenCalled();
  });
});
