import { Body, Controller, Get, Post, Put, Delete, Param, Query, UseInterceptors, UploadedFile, BadRequestException, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetLeadsQueryDto } from './dto/get-leads-query.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { BulkCreateLeadsDto } from './dto/bulk-create-leads.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { UpdateLeadInquiryDto } from './dto/update-lead-inquiry.dto';
import { CreateLeadContactLogDto } from './dto/create-lead-contact-log.dto';
import { CreateLeadFollowUpDto } from './dto/create-lead-follow-up.dto';
import { UpdateLeadFollowUpDto } from './dto/update-lead-follow-up.dto';

@Controller('api/v1/leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

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
  async bulkCreateLeads(@Body() body: BulkCreateLeadsDto) {
    const result = await this.leadsService.bulkCreateLeads(body.leads);
    return { success: true, count: result.count };
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

  @Put(':id/status')
  async updateLeadStatus(@Param('id') id: string, @Body() body: UpdateLeadStatusDto) {
    const data = await this.leadsService.updateLeadStatus(Number(id), body);
    return { success: true, data };
  }

  @Get(':id/auto-match')
  async autoMatchProperties(@Param('id') id: string) {
    const data = await this.leadsService.autoMatchProperties(Number(id));
    return { success: true, data };
  }

  @Put(':id/inquiries/:inquiryId')
  async updateInquiry(
    @Param('id') id: string,
    @Param('inquiryId') inquiryId: string,
    @Body() body: UpdateLeadInquiryDto,
  ) {
    const data = await this.leadsService.updateInquiry(Number(id), Number(inquiryId), body);
    return { success: true, data };
  }

  @Put(':id')
  async updateLead(@Param('id') id: string, @Body() body: UpdateLeadDto) {
    const data = await this.leadsService.updateLead(Number(id), body);
    return { success: true, data };
  }

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
  async addFollowUp(@Param('id') id: string, @Body() body: CreateLeadFollowUpDto) {
    const data = await this.leadsService.addFollowUp(Number(id), body);
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
  async uploadDocument(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const data = await this.leadsService.uploadDocument(Number(id), file);
    return { success: true, data };
  }

  @Delete(':id/documents/:docId')
  async deleteDocument(@Param('id') id: string, @Param('docId') docId: string) {
    const data = await this.leadsService.deleteDocument(Number(id), Number(docId));
    return { success: true, data };
  }
}
