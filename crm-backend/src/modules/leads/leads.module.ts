import { NinetyNineAcresController } from './ninety-nine-acres.controller';
import { NinetyNineAcresKeyGuard } from './guards/ninety-nine-acres-key.guard';
import { NinetyNineAcresService } from './integrations/ninety-nine-acres.service';
import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { WebsiteLeadsController } from './website-leads.controller';
import { LeadsService } from './leads.service';
import { LeadEventsService } from './lead-events.service';
import { LeadShareService } from './share/lead-share.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { MailModule } from '../mail/mail.module';
import { SALES_MAIL_EVENTS } from './mail/sales-mails';

@Module({
  imports: [NotificationsModule, AuthModule, TasksModule, MailModule.forFeature(SALES_MAIL_EVENTS)],
  controllers: [LeadsController, WebsiteLeadsController, NinetyNineAcresController],
  providers: [LeadsService, LeadEventsService, LeadShareService, NinetyNineAcresKeyGuard, NinetyNineAcresService],
  exports: [LeadsService, LeadEventsService],
})
export class LeadsModule {}
