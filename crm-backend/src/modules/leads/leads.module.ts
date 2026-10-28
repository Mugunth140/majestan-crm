import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { WebsiteLeadsController } from './website-leads.controller';
import { LeadsService } from './leads.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { MailModule } from '../mail/mail.module';
import { SALES_MAIL_EVENTS } from './mail/sales-mails';

@Module({
  imports: [NotificationsModule, AuthModule, TasksModule, MailModule.forFeature(SALES_MAIL_EVENTS)],
  controllers: [LeadsController, WebsiteLeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
