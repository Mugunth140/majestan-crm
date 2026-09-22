import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { ServiceKeyGuard } from './guards/service-key.guard';
import { WebsiteLeadDto } from './dto/website-lead.dto';

@Controller('api/v1/leads')
export class WebsiteLeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('website')
  @UseGuards(ServiceKeyGuard)
  async createWebsiteLead(@Body() body: WebsiteLeadDto) {
    const result = await this.leadsService.createLead(body);
    return {
      success: true,
      isExistingCustomer: result.isExistingCustomer,
      existingStaff: result.existingStaff,
      data: result.lead,
    };
  }
}
