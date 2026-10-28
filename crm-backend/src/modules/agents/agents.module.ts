import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { PARTNER_MAIL_EVENTS } from './mail/partner-mails';

@Module({
  imports: [AuthModule, MailModule.forFeature(PARTNER_MAIL_EVENTS)],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
