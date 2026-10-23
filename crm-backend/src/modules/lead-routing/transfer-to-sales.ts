import { DataSource } from 'typeorm';
import { Lead } from '../../database/entities/lead.entity';
import { User } from '../../database/entities/user.entity';
import { RoutingHistory } from '../../database/entities/routing-history.entity';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Moves a lead into the sales pipeline without touching its owner. The lead and
 * routing history commit together; sales notifications are best-effort after
 * the commit. Assignment is left as-is so a lead already handed to a sales
 * person keeps that person.
 */
export async function transferLeadToSales(
  dataSource: DataSource,
  notificationsService: NotificationsService,
  lead: Lead,
  actionedById: number | null,
  feedback?: string,
): Promise<Lead> {
  const ownerId = lead.assigned_staff_id ?? null;

  lead.department = 'sales';
  const saved = await dataSource.transaction(async (manager) => {
    const updated = await manager.getRepository(Lead).save(lead);

    const rh = manager.getRepository(RoutingHistory).create({
      lead_id: lead.id,
      event_type: 'Auto-transferred',
      from_user_id: ownerId,
      to_user_id: ownerId,
      actioned_by_id: actionedById,
      feedback,
      department: 'sales',
    });
    await manager.getRepository(RoutingHistory).save(rh);

    return updated;
  });

  // The handoff is committed; a notification failure must not turn a successful
  // move into a 500. Send after commit and log failures per recipient.
  try {
    const owner = ownerId == null
      ? null
      : await dataSource.getRepository(User).findOne({
          where: { id: ownerId },
          select: { id: true, name: true },
        });

    const salesDeptUsers = await dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.department', 'dept')
      .leftJoinAndSelect('u.role', 'role')
      .where('LOWER(dept.name) LIKE :deptName', { deptName: '%sales%' })
      .andWhere('u.is_active = 1')
      .getMany();

    const assignment = ownerId == null
      ? 'Added to the Sales queue.'
      : owner?.name
        ? `Still assigned to ${owner.name}.`
        : 'Still assigned to its current owner.';
    const message = `Lead #${lead.id} moved to the Sales pipeline — ${lead.status}. ${assignment}`;

    for (const u of salesDeptUsers) {
      try {
        await notificationsService.createNotification(
          u.id,
          'Lead moved to Sales',
          message,
          'lead_transferred',
          lead.id,
          'lead',
        );
      } catch (err) {
        console.error('Sales transfer notification failed (non-fatal):', err?.message);
      }
    }
  } catch (err) {
    console.error('Sales transfer notifications failed (non-fatal):', err?.message);
  }

  return saved;
}
