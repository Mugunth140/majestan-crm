import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiUrl: string;
  private readonly authKey: string;
  private readonly senderId: string;
  private readonly route: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiUrl = this.configService.get<string>('SMS_API_URL', 'http://sms.maximaa.biz/api/sendhttp.php');
    this.authKey = this.configService.get<string>('SMS_API_KEY', '');
    this.senderId = this.configService.get<string>('SMS_SENDER_ID', 'FISHMX');
    this.route = this.configService.get<string>('SMS_ROUTE', '2');
  }

  async sendSms(to: string, message: string, templateId?: string): Promise<boolean> {
    if (!this.apiUrl || !this.authKey) {
      this.logger.warn('SMS API URL or Auth Key not configured. Skipping SMS.');
      return false;
    }

    try {
      // Build the payload required by maximaa.biz sendhttp.php API
      const payload = new URLSearchParams({
        authkey: this.authKey,
        mobiles: to,
        message: message,
        sender: this.senderId,
        route: this.route,
      });

      if (templateId) {
        payload.append('DLT_TE_ID', templateId);
      }

      // The old CRM used POST for this specific provider
      const response = await lastValueFrom(
        this.httpService.post(this.apiUrl, payload, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      );
      
      this.logger.log(`SMS dispatched to ${to}. Response: ${typeof response.data === 'object' ? JSON.stringify(response.data) : response.data}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send SMS to ${to}: ${error?.response?.data || error.message}`);
      return false;
    }
  }
}
