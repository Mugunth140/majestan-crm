import { Body, Controller, Get, Post, Put, Delete, Param } from '@nestjs/common';
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
}
