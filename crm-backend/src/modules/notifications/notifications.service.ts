import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Notification } from '../../database/entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Browsers pick up new notifications from the stream's 5-second poll; this
  // only signals in-process listeners, so it no longer reloads the whole list.
  private async notifyClient(userId: number) {
    this.eventEmitter.emit(`notification.user_${userId}`, { userId });
  }

  async createNotification(
    userId: number,
    title: string,
    message: string,
    type: string,
    entityId?: number,
    entityType?: string,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      user_id: userId,
      title,
      message,
      type,
      entity_id: entityId ?? null,
      entity_type: entityType ?? null,
      is_read: false,
    });
    const saved = await this.notificationRepo.save(notification);
    await this.notifyClient(userId);
    return saved;
  }

  /** The newest notifications (old ones are pruned daily; see pruneOld). */
  async getNotificationsForUser(userId: number, limit = 300): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /** Read notifications go after 30 days, unread ones after 90. Returns how many were removed. */
  async pruneOld(): Promise<number> {
    const result = await this.notificationRepo.query(
      `DELETE FROM notifications
        WHERE (is_read = 1 AND created_at < NOW() - INTERVAL 30 DAY)
           OR created_at < NOW() - INTERVAL 90 DAY`,
    );
    return Number(result?.affectedRows ?? 0);
  }

  async markAsRead(id: number, userId: number): Promise<void> {
    await this.notificationRepo.update({ id, user_id: userId }, { is_read: true });
    await this.notifyClient(userId);
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepo.update({ user_id: userId }, { is_read: true });
    await this.notifyClient(userId);
  }

  async deleteNotification(id: number, userId: number): Promise<void> {
    await this.notificationRepo.delete({ id, user_id: userId });
    await this.notifyClient(userId);
  }

  async deleteAllNotificationsForUser(userId: number): Promise<void> {
    await this.notificationRepo.delete({ user_id: userId });
    await this.notifyClient(userId);
  }

  async getNewNotificationsSince(userId: number, since: Date): Promise<{ notifications: Notification[]; unread_count: number }> {
    const notifications = await this.notificationRepo
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .andWhere('n.created_at > :since', { since })
      .orderBy('n.created_at', 'DESC')
      .getMany();

    const unread_count = await this.notificationRepo.count({ where: { user_id: userId, is_read: false } });

    return { notifications, unread_count };
  }
}
