import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { simplifyTemplate, type Template } from './whatsapp-templates';

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
  private readonly accountId: string;
  private readonly graphUrl: string;
  private templateCache: { at: number; data: Template[] } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.token = this.configService.get<string>('WHATSAPP_API_TOKEN', '');
    this.phoneNumberId = this.configService.get<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
      '',
    );
    const version = this.configService.get<string>(
      'WHATSAPP_API_VERSION',
      'v23.0',
    );
    this.accountId = this.configService.get<string>(
      'WHATSAPP_BUSINESS_ACCOUNT_ID',
      '',
    );
    this.graphUrl = `https://graph.facebook.com/${version}`;
    this.apiUrl = `${this.graphUrl}/${this.phoneNumberId}/messages`;
  }

  /** Whether the CRM can send through the Cloud API and list templates. */
  isConfigured(): boolean {
    return Boolean(this.token && this.phoneNumberId && this.accountId);
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /** Meta's own error text, so staff see why a send was refused. */
  private reason(error: unknown): string {
    const e = error as {
      response?: {
        data?: { error?: { error_user_msg?: string; message?: string } };
      };
      message?: string;
    };
    return (
      e?.response?.data?.error?.error_user_msg ||
      e?.response?.data?.error?.message ||
      e?.message ||
      'WhatsApp request failed'
    );
  }

  /** Approved templates, cached for five minutes. */
  async templates(force = false): Promise<Template[]> {
    if (!this.isConfigured())
      throw new ServiceUnavailableException(
        'WhatsApp is not set up on the CRM server',
      );
    if (
      !force &&
      this.templateCache &&
      Date.now() - this.templateCache.at < 300_000
    )
      return this.templateCache.data;
    const data: Template[] = [];
    let url: string | null =
      `${this.graphUrl}/${this.accountId}/message_templates?status=APPROVED&limit=100&fields=name,language,status,category,components,parameter_format`;
    try {
      for (let page = 0; url && page < 10; page++) {
        const response = await lastValueFrom(
          this.httpService.get(url, { headers: this.headers() }),
        );
        const body = (response?.data ?? {}) as {
          data?: unknown[];
          paging?: { next?: string };
        };
        for (const raw of body.data ?? []) {
          const template = simplifyTemplate(raw);
          if (template) data.push(template);
        }
        url = body.paging?.next ?? null;
      }
    } catch (error) {
      this.logger.error(
        `Could not load WhatsApp templates: ${this.reason(error)}`,
      );
      throw new BadGatewayException(
        `Could not load WhatsApp templates: ${this.reason(error)}`,
      );
    }
    data.sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.language.localeCompare(b.language),
    );
    this.templateCache = { at: Date.now(), data };
    return data;
  }

  /** The approved template with this name (any language), or null. */
  async approved(name: string): Promise<Template | null> {
    return (await this.templates()).find((t) => t.name === name) ?? null;
  }

  /** Uploads a file to Meta (kept 30 days) and returns its media id for a document message. */
  async uploadMedia(
    file: Buffer,
    filename: string,
    mime = 'application/pdf',
  ): Promise<string> {
    if (!this.isConfigured())
      throw new ServiceUnavailableException(
        'WhatsApp is not set up on the CRM server',
      );
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mime);
    form.append(
      'file',
      new Blob([new Uint8Array(file)], { type: mime }),
      filename,
    );
    const response = await fetch(
      `${this.graphUrl}/${this.phoneNumberId}/media`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
        body: form,
        signal: AbortSignal.timeout(60_000),
      },
    ).catch((error: unknown) => {
      throw new BadGatewayException(
        `Could not upload the file to WhatsApp: ${this.reason(error)}`,
      );
    });
    const body = (await response.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string; error_user_msg?: string };
    };
    if (!response.ok || !body.id)
      throw new BadGatewayException(
        `Could not upload the file to WhatsApp: ${body.error?.error_user_msg || body.error?.message || response.status}`,
      );
    return body.id;
  }

  /** Send a message body (text or template) and return Meta's message id; throws with Meta's reason. */
  async deliver(to: string, message: Record<string, unknown>): Promise<string> {
    if (!this.isConfigured())
      throw new ServiceUnavailableException(
        'WhatsApp is not set up on the CRM server',
      );
    try {
      const response = await lastValueFrom(
        this.httpService.post(
          this.apiUrl,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            ...message,
          },
          { headers: this.headers() },
        ),
      );
      const id = (response?.data as { messages?: { id?: string }[] })
        ?.messages?.[0]?.id;
      if (!id) throw new Error('WhatsApp did not return a message id');
      return id;
    } catch (error) {
      this.logger.warn(
        `WhatsApp send to …${to.slice(-4)} failed: ${this.reason(error)}`,
      );
      throw new BadGatewayException(this.reason(error));
    }
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
      this.logger.error(
        `Failed to send WhatsApp to ${to}: ${error?.response?.data?.error?.message || error.message}`,
      );
      return false;
    }
  }

  /**
   * Send a pre-approved template message (required for initiating conversations)
   */
  async sendTemplateMessage(
    to: string,
    template: WhatsappTemplateOptions,
  ): Promise<boolean> {
    if (!this.token || !this.phoneNumberId) {
      this.logger.warn(
        'WhatsApp API not configured. Skipping template message.',
      );
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
      this.logger.error(
        `Failed to send WhatsApp template to ${to}: ${error?.response?.data?.error?.message || error.message}`,
      );
      return false;
    }
  }
}
