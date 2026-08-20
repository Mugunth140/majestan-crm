import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('lead.assigned')
  async handleLeadAssignedEvent(payload: { userId: number; leadId: number; leadName: string }) {
    try {
      await this.notificationsService.createNotification(
        payload.userId,
        'New Lead Assigned',
        `You have been assigned a new lead: ${payload.leadName}.`,
        'assignment',
        payload.leadId,
        'lead'
      );
    } catch (error) {
      this.logger.error('Failed to create notification for lead.assigned', error);
    }
  }

  @OnEvent('user.password_changed')
  async handlePasswordChangedEvent(payload: { userId: number }) {
    try {
      await this.notificationsService.createNotification(
        payload.userId,
        'Security Alert',
        'Your password was recently changed. If you did not make this change, please contact support immediately.',
        'security',
        payload.userId,
        'user'
      );
    } catch (error) {
      this.logger.error('Failed to create notification for user.password_changed', error);
    }
  }
}
