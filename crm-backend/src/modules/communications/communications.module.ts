import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsappService } from './whatsapp/whatsapp.service';
import { SmsService } from './sms/sms.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [WhatsappService, SmsService],
  exports: [WhatsappService, SmsService],
})
export class CommunicationsModule {}
