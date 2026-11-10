import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'crypto';
import { parseWebhook, validSignature } from './whatsapp-webhook';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

const sameText = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

// Public: Meta calls these. GET proves we own the URL; POST delivers messages,
// signed with the App Secret (checked against the raw body).
@Controller('api/v1/whatsapp/webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly webhook: WhatsappWebhookService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN', '');
    if (
      !expected ||
      mode !== 'subscribe' ||
      typeof token !== 'string' ||
      !sameText(token, expected) ||
      typeof challenge !== 'string'
    )
      throw new ForbiddenException('Webhook verification failed');
    return challenge;
  }

  @Post()
  @HttpCode(200)
  async receive(@Req() req: Request & { rawBody?: Buffer }) {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET', '');
    if (
      !validSignature(req.rawBody, req.headers['x-hub-signature-256'], secret)
    ) {
      this.logger.warn(
        secret
          ? 'Rejected a WhatsApp webhook with a bad signature'
          : 'WHATSAPP_APP_SECRET is not set; rejecting WhatsApp webhooks',
      );
      throw new ForbiddenException('Invalid signature');
    }
    // Errors bubble up as 500 so Meta retries; stored messages are de-duplicated by id.
    await this.webhook.handle(parseWebhook(req.body));
    return { received: true };
  }
}
