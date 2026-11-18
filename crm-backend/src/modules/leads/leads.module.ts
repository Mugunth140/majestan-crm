import { MagicbricksController, NinetyNineAcresController } from './portal-leads.controller';
import { MagicbricksKeyGuard, NinetyNineAcresKeyGuard } from './guards/portal-key.guard';
import { PortalLeadsService } from './integrations/portal-leads.service';
import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { WebsiteLeadsController } from './website-leads.controller';
import { LeadsService } from './leads.service';
import { LeadEventsService } from './lead-events.service';
import { LeadShareService } from './share/lead-share.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { SALES_MAIL_EVENTS } from './mail/sales-mails';

@Module({
  imports: [NotificationsModule, AuthModule, MailModule.forFeature(SALES_MAIL_EVENTS)],
  controllers: [LeadsController, WebsiteLeadsController, NinetyNineAcresController, MagicbricksController],
  providers: [LeadsService, LeadEventsService, LeadShareService, NinetyNineAcresKeyGuard, MagicbricksKeyGuard, PortalLeadsService],
  exports: [LeadsService, LeadEventsService],
})
export class LeadsModule {}
