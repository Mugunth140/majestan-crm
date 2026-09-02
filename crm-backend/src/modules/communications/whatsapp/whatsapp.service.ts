import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

export interface WhatsappTemplateOptions {
  name: string;
  languageCode?: string;
  components?: any[];
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiUrl: string;
  private readonly token: string;
  private readonly phoneNumberId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.token = this.configService.get<string>('WHATSAPP_API_TOKEN', '');
    this.phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
    const version = this.configService.get<string>('WHATSAPP_API_VERSION', 'v19.0');
    this.apiUrl = `https://graph.facebook.com/${version}/${this.phoneNumberId}/messages`;
  }

  /**
   * Send a free-form text message (only works if within 24h conversation window)
   */
  async sendTextMessage(to: string, message: string): Promise<boolean> {
    if (!this.token || !this.phoneNumberId) {
      this.logger.warn('WhatsApp API not configured. Skipping message.');
      return false;
    }

    try {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: message },
      };

      await lastValueFrom(
        this.httpService.post(this.apiUrl, payload, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`WhatsApp text message sent to ${to}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send WhatsApp to ${to}: ${error?.response?.data?.error?.message || error.message}`);
      return false;
    }
  }

  /**
   * Send a pre-approved template message (required for initiating conversations)
   */
  async sendTemplateMessage(to: string, template: WhatsappTemplateOptions): Promise<boolean> {
    if (!this.token || !this.phoneNumberId) {
      this.logger.warn('WhatsApp API not configured. Skipping template message.');
      return false;
    }

    try {
      const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.languageCode || 'en' },
          components: template.components || [],
        },
      };

      await lastValueFrom(
        this.httpService.post(this.apiUrl, payload, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`WhatsApp template '${template.name}' sent to ${to}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send WhatsApp template to ${to}: ${error?.response?.data?.error?.message || error.message}`);
      return false;
    }
  }
}
