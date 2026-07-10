import { Body, Controller, Get, Post, Put, Delete, Param, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LeadsService } from './leads.service';

@Controller('api/v1/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async getLeads() {
    const data = await this.leadsService.getLeads();
    return { success: true, data };
  }

  @Get(':id')
  async getLead(@Param('id') id: string) {
    const data = await this.leadsService.getLeadById(Number(id));
    return { success: true, data };
  }

  @Post('bulk')
  async bulkCreateLeads(@Body() body: { leads: any[] }) {
    const result = await this.leadsService.bulkCreateLeads(body.leads);
    return { success: true, count: result.count };
  }

  @Post()
  async createLead(@Body() body: any) {
    const result = await this.leadsService.createLead(body);
    return {
      success: true,
      isExistingCustomer: result.isExistingCustomer,
      existingStaff: result.existingStaff,
      data: result.lead,
    };
  }

  @Put(':id/status')
  async updateLeadStatus(@Param('id') id: string, @Body() body: any) {
    const data = await this.leadsService.updateLeadStatus(Number(id), body);
    return { success: true, data };
  }

  @Get(':id/auto-match')
  async autoMatchProperties(@Param('id') id: string) {
    const data = await this.leadsService.autoMatchProperties(Number(id));
    return { success: true, data };
  }

  @Put(':id')
  async updateLead(@Param('id') id: string, @Body() body: any) {
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
  async addContactLog(@Param('id') id: string, @Body() body: any) {
    const data = await this.leadsService.addContactLog(Number(id), body);
    return { success: true, data };
  }

  // ── Follow-Up CRUD ─────────────────────────────────────────────────────────
  @Post(':id/follow-ups')
  async addFollowUp(@Param('id') id: string, @Body() body: any) {
    const data = await this.leadsService.addFollowUp(Number(id), body);
    return { success: true, data };
  }

  @Put(':id/follow-ups/:followUpId')
  async updateFollowUp(
    @Param('id') id: string,
    @Param('followUpId') followUpId: string,
    @Body() body: any,
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
