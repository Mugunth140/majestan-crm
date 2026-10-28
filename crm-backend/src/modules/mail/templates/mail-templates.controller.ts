import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { SavedTemplateDto, TemplatePreviewDto, TemplateTextDto } from '../dto/mail.dto';
import { MailTemplatesService } from './mail-templates.service';

/** Roles that may edit email wording (Super Admin always passes RolesGuard). */
const EDITORS = ['Admin', 'Manager', 'Team Lead'];

/** Reading is open to signed-in staff (the composer needs it); changes are limited to EDITORS. */
@Controller('api/v1/mail/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MailTemplatesController {
  constructor(private readonly templates: MailTemplatesService) {}

  @Get('entities')
  entities() {
    return this.templates.entities();
  }

  @Get()
  catalog(@Query('entityType') entityType: string) {
    return this.templates.catalog(entityType);
  }

  @Post('preview')
  @HttpCode(200)
  preview(@Body() body: TemplatePreviewDto) {
    return this.templates.previewWithSamples(body.entityType, body);
  }

  @Put('system/:eventKey')
  @Roles(...EDITORS)
  saveSystem(@Param('eventKey') eventKey: string, @Body() body: TemplateTextDto, @Request() req: any) {
    return this.templates.saveEventOverride(eventKey, body, req.user.id);
  }

  @Delete('system/:eventKey')
  @Roles(...EDITORS)
  resetSystem(@Param('eventKey') eventKey: string) {
    return this.templates.resetEventOverride(eventKey);
  }

  @Post('saved')
  @Roles(...EDITORS)
  createSaved(@Body() body: SavedTemplateDto, @Request() req: any) {
    return this.templates.createSaved(body.entityType, body, req.user.id);
  }

  @Put('saved/:id')
  @Roles(...EDITORS)
  updateSaved(@Param('id', ParseIntPipe) id: number, @Body() body: SavedTemplateDto, @Request() req: any) {
    return this.templates.updateSaved(id, body, req.user.id);
  }

  @Delete('saved/:id')
  @Roles(...EDITORS)
  deleteSaved(@Param('id', ParseIntPipe) id: number) {
    return this.templates.deleteSaved(id);
  }
}
