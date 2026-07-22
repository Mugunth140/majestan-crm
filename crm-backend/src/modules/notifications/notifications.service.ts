import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../database/entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

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
    });
    return this.notificationRepo.save(notification);
  }

  async getNotificationsForUser(userId: number): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async deleteNotification(id: number, userId: number): Promise<void> {
    await this.notificationRepo.delete({ id, user_id: userId });
  }

  async deleteAllNotificationsForUser(userId: number): Promise<void> {
    await this.notificationRepo.delete({ user_id: userId });
  }

  async getNewNotificationsSince(userId: number, since: Date): Promise<{ notifications: Notification[]; unread_count: number }> {
    const notifications = await this.notificationRepo
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .andWhere('n.created_at > :since', { since })
      .orderBy('n.created_at', 'DESC')
      .getMany();

    const unread_count = await this.notificationRepo.count({ where: { user_id: userId } });

    return { notifications, unread_count };
  }
}
