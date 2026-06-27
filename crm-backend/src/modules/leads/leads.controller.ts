import { Body, Controller, Get, Post } from '@nestjs/common';
import { LeadsService } from './leads.service';

@Controller('api/v1/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async getLeads() {
    const data = await this.leadsService.getLeads();
    return { success: true, data };
  }

  @Post()
  async createLead(@Body() body: any) {
    const lead = await this.leadsService.createLead(body);
    return { success: true, data: lead };
  }
}
