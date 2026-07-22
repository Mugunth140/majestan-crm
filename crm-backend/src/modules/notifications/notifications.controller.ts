import { Controller, Get, Delete, Param, Req, Sse, MessageEvent } from '@nestjs/common';
import { Observable, interval } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { NotificationsService } from './notifications.service';

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Req() req: any) {
    // TODO: add auth guard
    const user = req.user;
    const userId: number = user?.sub ?? user?.id ?? 0;
    const data = await this.notificationsService.getNotificationsForUser(userId);
    return { success: true, data };
  }

  @Sse('stream')
  stream(@Req() req: any): Observable<MessageEvent> {
    // TODO: add auth guard
    const user = req.user;
    const userId: number = user?.sub ?? user?.id ?? 0;

    // Track the last check time; poll every 5 seconds for new notifications
    let lastChecked = new Date();

    return interval(5000).pipe(
      switchMap(async () => {
        const since = lastChecked;
        lastChecked = new Date();
        return this.notificationsService.getNewNotificationsSince(userId, since);
      }),
      map((result): MessageEvent => ({
        data: {
          notifications: result.notifications,
          unread_count: result.unread_count,
        },
      })),
    );
  }

  @Delete('all')
  async deleteAll(@Req() req: any) {
    // TODO: add auth guard
    const user = req.user;
    const userId: number = user?.sub ?? user?.id ?? 0;
    await this.notificationsService.deleteAllNotificationsForUser(userId);
    return { success: true };
  }

  @Delete(':id')
  async deleteOne(@Param('id') id: string, @Req() req: any) {
    // TODO: add auth guard
    const user = req.user;
    const userId: number = user?.sub ?? user?.id ?? 0;
    await this.notificationsService.deleteNotification(Number(id), userId);
    return { success: true };
  }
}

