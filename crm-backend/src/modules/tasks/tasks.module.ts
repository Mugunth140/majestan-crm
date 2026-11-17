import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaceAlertsService } from './pace-alerts.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService, PaceAlertsService],
  exports: [TasksService],
})
export class TasksModule {}
