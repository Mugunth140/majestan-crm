import { DataSource } from 'typeorm';
import { Lead } from '../../database/entities/lead.entity';
import { User } from '../../database/entities/user.entity';
import { RoutingHistory } from '../../database/entities/routing-history.entity';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Moves a lead into the sales pipeline without touching its owner: records the
 * routing history and notifies the sales team. Assignment is left as-is so a
 * lead already handed to a sales person keeps that person.
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
  const saved = await dataSource.getRepository(Lead).save(lead);

  const rh = dataSource.getRepository(RoutingHistory).create({
    lead_id: lead.id,
    event_type: 'Auto-transferred',
    from_user_id: ownerId,
    to_user_id: ownerId,
    actioned_by_id: actionedById,
    feedback,
    department: 'sales',
  });
  await dataSource.getRepository(RoutingHistory).save(rh);

  const salesDeptUsers = await dataSource
    .getRepository(User)
    .createQueryBuilder('u')
    .leftJoinAndSelect('u.department', 'dept')
    .leftJoinAndSelect('u.role', 'role')
    .where('LOWER(dept.name) LIKE :deptName', { deptName: '%sales%' })
    .andWhere('u.is_active = 1')
    .getMany();

  for (const u of salesDeptUsers) {
    await notificationsService.createNotification(
      u.id,
      'New Lead in Sales Queue',
      `Lead #${lead.id} has been transferred to Sales — ${lead.status}`,
      'lead_transferred',
      lead.id,
      'lead',
    );
  }

  return saved;
}
