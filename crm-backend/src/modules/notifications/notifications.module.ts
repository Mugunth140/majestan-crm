import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification } from '../../database/entities/notification.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsListener } from './notifications.listener';
import { FollowUpRemindersService } from './follow-up-reminders.service';
import { FirstContactRemindersService } from './first-contact-reminders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsListener, FollowUpRemindersService, FirstContactRemindersService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
