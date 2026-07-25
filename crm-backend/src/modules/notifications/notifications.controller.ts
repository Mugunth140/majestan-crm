import { Controller, Get, Delete, Patch, Param, Req, Sse, MessageEvent, UseGuards } from '@nestjs/common';
import { Observable, interval } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Req() req: any) {
    const userId: number = req.user.sub;
    const data = await this.notificationsService.getNotificationsForUser(userId);
    return { success: true, data };
  }

  @Sse('stream')
  stream(@Req() req: any): Observable<MessageEvent> {
    const userId: number = req.user.sub;

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

  @Patch('read-all')
  async markAllRead(@Req() req: any) {
    const userId: number = req.user.sub;
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }

  @Patch(':id/read')
  async markOneRead(@Param('id') id: string, @Req() req: any) {
    const userId: number = req.user.sub;
    await this.notificationsService.markAsRead(Number(id), userId);
    return { success: true };
  }

  @Delete('all')
  async deleteAll(@Req() req: any) {
    const userId: number = req.user.sub;
    await this.notificationsService.deleteAllNotificationsForUser(userId);
    return { success: true };
  }

  @Delete(':id')
  async deleteOne(@Param('id') id: string, @Req() req: any) {
    const userId: number = req.user.sub;
    await this.notificationsService.deleteNotification(Number(id), userId);
    return { success: true };
  }
}

