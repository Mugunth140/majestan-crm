import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { MailOutboxStatus } from '../../database/entities/mail-outbox.entity';
import { DraftActionDto, PreviewMailDto, SendMailDto, SuppressionDto } from './dto/mail.dto';
import { MailService } from './mail.service';

/** One API for every module's email. Permissions are checked per email type in MailService. */
@Controller('api/v1/mail')
@UseGuards(JwtAuthGuard)
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get('events')
  catalog(@Query('entityType') entityType: string, @Request() req: any) {
    return this.mail.catalog(entityType, req.user);
  }

  @Get('history')
  history(@Query('entityType') entityType: string, @Query('entityId', ParseIntPipe) entityId: number) {
    return this.mail.history(entityType, entityId);
  }

  @Post('preview')
  @HttpCode(200) // read-only: renders, stores nothing
  preview(@Body() body: PreviewMailDto, @Request() req: any) {
    return this.mail.preview(body.event, body.entityId, body.note ?? null, req.user);
  }

  @Post('send')
  send(@Body() body: SendMailDto, @Request() req: any) {
    return this.mail.send(body.event, body.entityId, body.note ?? null, body.hash ?? null, req.user);
  }

  @Get('outbox')
  list(@Query('status') status: MailOutboxStatus | undefined, @Query('module') module: string | undefined,
    @Query('page') page: string | undefined, @Request() req: any) {
    return this.mail.list({ status, module, page: page ? Number(page) : 1 }, req.user);
  }

  @Get('outbox/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mail.findOne(id);
  }

  @Post('outbox/:id/preview')
  @HttpCode(200)
  previewDraft(@Param('id', ParseIntPipe) id: number, @Body() body: DraftActionDto, @Request() req: any) {
    return this.mail.previewDraft(id, body.note ?? null, req.user);
  }

  @Post('outbox/:id/confirm')
  confirm(@Param('id', ParseIntPipe) id: number, @Body() body: DraftActionDto, @Request() req: any) {
    return this.mail.confirm(id, body.note ?? null, body.hash ?? null, req.user);
  }

  @Post('outbox/:id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.mail.cancel(id, req.user);
  }

  @Post('outbox/:id/retry')
  retry(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.mail.retry(id, req.user);
  }

  @Get('suppressions')
  suppressions(@Request() req: any) {
    return this.mail.listSuppressions(req.user);
  }

  @Post('suppressions')
  addSuppression(@Body() body: SuppressionDto, @Request() req: any) {
    return this.mail.addSuppression(body.email, body.reason, body.note ?? null, req.user);
  }

  @Delete('suppressions/:id')
  removeSuppression(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.mail.removeSuppression(id, req.user);
  }
}
