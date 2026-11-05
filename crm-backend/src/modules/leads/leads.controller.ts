import { Body, Controller, Get, Post, Put, Delete, Param, Query, UseInterceptors, UploadedFile, BadRequestException, UseGuards, Request, StreamableFile, Header, ParseIntPipe, ParseEnumPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LeadsService } from './leads.service';
import { LeadEventsService } from './lead-events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetLeadsQueryDto } from './dto/get-leads-query.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { BulkCreateLeadsDto } from './dto/bulk-create-leads.dto';
import { BulkCheckMobilesDto } from './dto/bulk-check-mobiles.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { ScheduleVisitDto } from './dto/schedule-visit.dto';
import { UpdateLeadInquiryDto } from './dto/update-lead-inquiry.dto';
import { CreateLeadContactLogDto } from './dto/create-lead-contact-log.dto';
import { CreateLeadFollowUpDto } from './dto/create-lead-follow-up.dto';
import { UpdateLeadFollowUpDto } from './dto/update-lead-follow-up.dto';
import { RolesGuard } from '../auth/roles.guard';
import { LeadShareService } from './share/lead-share.service';
import { LogShareDto, ShareListingsDto } from './dto/share-listings.dto';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly leadEvents: LeadEventsService,
    private readonly share: LeadShareService,
  ) {}

  @Get('cities')
  async getCities() {
    const data = await this.leadsService.getCities();
    return { success: true, data };
  }

  @Get('sublocations')
  async getSublocations(@Query('city_id') cityId: string) {
    const data = await this.leadsService.getSublocations(Number(cityId));
    return { success: true, data };
  }

  @Get('check-mobile')
  async checkMobile(@Query('mobile') mobile: string, @Query('excludeId') excludeId?: string) {
    const data = await this.leadsService.checkMobileExists(
      mobile ?? '',
      excludeId ? Number(excludeId) : undefined,
    );
    return { success: true, ...data };
  }

  @Get()
  async getLeads(@Request() req: any, @Query() query: GetLeadsQueryDto) {
    const result = await this.leadsService.getLeads(req.user, query);
    return { success: true, ...result };
  }

  @Get(':id')
  async getLead(@Param('id') id: string, @Request() req: any) {
    const data = await this.leadsService.getLeadById(Number(id), req.user);
    return { success: true, data };
  }

  @Post('bulk')
  async bulkCreateLeads(@Body() body: BulkCreateLeadsDto, @Request() req: any) {
    const result = await this.leadsService.bulkCreateLeads(body.leads, req.user);
    return { success: true, ...result };
  }

  @Post('bulk/check')
  async bulkCheckMobiles(@Body() body: BulkCheckMobilesDto) {
    const result = await this.leadsService.bulkCheckMobiles(body.mobiles ?? []);
    return { success: true, ...result };
  }

  @Post()
  async createLead(@Body() body: CreateLeadDto) {
    const result = await this.leadsService.createLead(body);
    return {
      success: true,
      isExistingCustomer: result.isExistingCustomer,
      existingStaff: result.existingStaff,
      data: result.lead,
    };
  }

  @Put(':id/visit')
  async scheduleVisit(@Param('id') id: string, @Body() body: ScheduleVisitDto, @Request() req: any) {
    const inquiry = await this.leadsService.scheduleVisit(Number(id), body, req.user?.id ?? null);
    return { success: true, data: inquiry };
  }

  @Put(':id/status')
  async updateLeadStatus(@Param('id') id: string, @Body() body: UpdateLeadStatusDto, @Request() req: any) {
    const { lead, transferredToSales } = await this.leadsService.updateLeadStatus(
      Number(id),
      body,
      req.user?.id ?? null,
    );
    return { success: true, data: lead, transferredToSales };
  }

  @Get(':id/timeline')
  async getTimeline(@Param('id') id: string) {
    const data = await this.leadEvents.timeline(Number(id));
    return { success: true, data };
  }

  @Get(':id/auto-match')
  async autoMatchProperties(@Param('id') id: string, @Query('inquiryId') inquiryId?: string) {
    const data = await this.leadsService.autoMatchProperties(Number(id), inquiryId ? Number(inquiryId) : undefined);
    return { success: true, data };
  }

  /** A listing's customer brochure, to download or send on WhatsApp. */
  @Header('Cache-Control', 'private, no-store')
  @Get(':id/share/pdf/:kind/:listingId')
  async sharePdf(
    @Param('id', ParseIntPipe) id: number,
    @Param('kind', new ParseEnumPipe({ property: 'property', project: 'project' })) kind: 'property' | 'project',
    @Param('listingId', ParseIntPipe) listingId: number,
    @Request() req: any,
  ) {
    await this.share.assertAccess(id, req.user);
    const { buffer, filename } = await this.share.pdf({ kind, id: listingId });
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      length: buffer.length,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
  }

  @Post(':id/share/email-draft')
  async shareEmailDraft(@Param('id', ParseIntPipe) id: number, @Body() body: ShareListingsDto, @Request() req: any) {
    return { success: true, data: await this.share.emailDraft(id, body.items, req.user) };
  }

  @Post(':id/share/log')
  async logShare(@Param('id', ParseIntPipe) id: number, @Body() body: LogShareDto, @Request() req: any) {
    return { success: true, data: await this.share.log(id, body.channel, body.items, req.user) };
  }

  @Post(':id/inquiries')
  async addInquiry(@Param('id') id: string, @Body() body: UpdateLeadInquiryDto, @Request() req: any) {
    const data = await this.leadsService.addInquiry(Number(id), body, req.user?.id ?? null);
    return { success: true, data };
  }

  @Put(':id/inquiries/:inquiryId')
  async updateInquiry(
    @Param('id') id: string,
    @Param('inquiryId') inquiryId: string,
    @Body() body: UpdateLeadInquiryDto,
    @Request() req: any,
  ) {
    const data = await this.leadsService.updateInquiry(Number(id), Number(inquiryId), body, req.user?.id ?? null);
    return { success: true, data };
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id/inquiries/:inquiryId')
  async deleteInquiry(@Param('id') id: string, @Param('inquiryId') inquiryId: string, @Request() req: any) {
    await this.leadsService.deleteInquiry(Number(id), Number(inquiryId), req.user?.id ?? null);
    return { success: true };
  }

  @Put(':id')
  async updateLead(@Param('id') id: string, @Body() body: UpdateLeadDto, @Request() req: any) {
    const data = await this.leadsService.updateLead(Number(id), body, req.user?.id ?? null);
    return { success: true, data };
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id')
  async deleteLead(@Param('id') id: string) {
    await this.leadsService.deleteLead(Number(id));
    return { success: true };
  }

  // ── Contact Logs ───────────────────────────────────────────────────────────
  @Post(':id/contact-log')
  async addContactLog(@Param('id') id: string, @Body() body: CreateLeadContactLogDto) {
    const data = await this.leadsService.addContactLog(Number(id), body);
    return { success: true, data };
  }

  // ── Follow-Up CRUD ─────────────────────────────────────────────────────────
  @Post(':id/follow-ups')
  async addFollowUp(@Param('id') id: string, @Body() body: CreateLeadFollowUpDto, @Request() req: any) {
    const data = await this.leadsService.addFollowUp(Number(id), body, req.user?.id ?? null);
    return { success: true, data };
  }

  @Post(':id/acknowledge-enquiry')
  async acknowledgeEnquiry(@Param('id') id: string, @Request() req: any) {
    const data = await this.leadsService.acknowledgeEnquiry(Number(id), req.user.sub);
    return { success: true, data };
  }

  @Put(':id/follow-ups/:followUpId')
  async updateFollowUp(
    @Param('id') id: string,
    @Param('followUpId') followUpId: string,
    @Body() body: UpdateLeadFollowUpDto,
  ) {
    const data = await this.leadsService.updateFollowUp(Number(id), Number(followUpId), body);
    return { success: true, data };
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id/follow-ups/:followUpId')
  async deleteFollowUp(
    @Param('id') id: string,
    @Param('followUpId') followUpId: string,
  ) {
    const data = await this.leadsService.deleteFollowUp(Number(id), Number(followUpId));
    return { success: true, data };
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const data = await this.leadsService.uploadDocument(Number(id), file, req.user?.id ?? null);
    return { success: true, data };
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id/documents/:docId')
  async deleteDocument(@Param('id') id: string, @Param('docId') docId: string, @Request() req: any) {
    const data = await this.leadsService.deleteDocument(Number(id), Number(docId), req.user?.id ?? null);
    return { success: true, data };
  }
}
