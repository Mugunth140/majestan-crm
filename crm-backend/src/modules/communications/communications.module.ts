import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { WhatsappService } from './whatsapp/whatsapp.service';
import { SmsService } from './sms/sms.service';
import { WhatsappWebhookController } from './whatsapp/whatsapp-webhook.controller';
import { WhatsappWebhookService } from './whatsapp/whatsapp-webhook.service';
import { WhatsappController } from './whatsapp/whatsapp.controller';
import { WhatsappSendService } from './whatsapp/whatsapp-send.service';
import { WhatsappAutomationService } from './whatsapp/whatsapp-automation.service';

@Global()
@Module({
  imports: [HttpModule, NotificationsModule, AuthModule],
  controllers: [WhatsappWebhookController, WhatsappController],
  providers: [
    WhatsappService,
    SmsService,
    WhatsappWebhookService,
    WhatsappSendService,
    WhatsappAutomationService,
  ],
  exports: [WhatsappService, SmsService, WhatsappSendService],
})
export class CommunicationsModule {}
