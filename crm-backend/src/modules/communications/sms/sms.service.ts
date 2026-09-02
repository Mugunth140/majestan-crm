import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly method: 'GET' | 'POST';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiUrl = this.configService.get<string>('SMS_API_URL', '');
    this.apiKey = this.configService.get<string>('SMS_API_KEY', '');
    this.senderId = this.configService.get<string>('SMS_SENDER_ID', '');
    this.method = this.configService.get<'GET'|'POST'>('SMS_API_METHOD', 'POST');
  }

  async sendSms(to: string, message: string, templateId?: string): Promise<boolean> {
    if (!this.apiUrl) {
      this.logger.warn('SMS API URL not configured. Skipping SMS.');
      return false;
    }

    try {
      if (this.method === 'GET') {
        // Replace placeholders in the URL if it's a GET based API
        // Example: https://api.local-sms.com/send?apikey={api_key}&phone={to}&msg={message}
        let formattedUrl = this.apiUrl
          .replace('{api_key}', encodeURIComponent(this.apiKey))
          .replace('{to}', encodeURIComponent(to))
          .replace('{message}', encodeURIComponent(message))
          .replace('{sender}', encodeURIComponent(this.senderId));
          
        if (templateId) {
          formattedUrl = formattedUrl.replace('{template_id}', encodeURIComponent(templateId));
        }

        await lastValueFrom(this.httpService.get(formattedUrl));
      } else {
        // Standard POST payload
        const payload = {
          apikey: this.apiKey,
          sender: this.senderId,
          to: to,
          message: message,
          ...(templateId && { template_id: templateId })
        };

        await lastValueFrom(this.httpService.post(this.apiUrl, payload));
      }

      this.logger.log(`SMS sent to ${to}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send SMS to ${to}: ${error?.response?.data || error.message}`);
      return false;
    }
  }
}
