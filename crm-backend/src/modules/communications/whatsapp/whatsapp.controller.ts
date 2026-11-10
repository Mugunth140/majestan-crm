import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { WhatsappService } from './whatsapp.service';
import {
  WhatsappSendService,
  type WhatsappUser,
} from './whatsapp-send.service';

export class SendWhatsappDto {
  @IsOptional() @IsString() @MaxLength(4096) text?: string;
  @IsOptional() @IsString() @MaxLength(512) template_name?: string;
  @IsOptional() @IsString() @MaxLength(32) template_language?: string;
  /** Template values keyed "body:1", "header:1", "body:name"… */
  @IsOptional() @IsObject() values?: Record<string, unknown>;
}

@Controller('api/v1/whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly sender: WhatsappSendService,
  ) {}

  /** Approved templates; `refresh=1` skips the five-minute cache after approving a new one. */
  @Get('templates')
  async templates(@Query('refresh') refresh?: string) {
    return {
      success: true,
      data: await this.whatsapp.templates(refresh === '1'),
    };
  }

  /** Whether the API is set up and free text is allowed for this lead right now. */
  @Get('leads/:id/window')
  async window(
    @Request() req: { user: WhatsappUser },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return { success: true, data: await this.sender.window(req.user, id) };
  }

  @Post('leads/:id/send')
  async send(
    @Request() req: { user: WhatsappUser },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SendWhatsappDto,
  ) {
    return { success: true, data: await this.sender.send(req.user, id, body) };
  }
}
