import { Body, Controller, Get, Post } from '@nestjs/common';
import { MasterService } from './master.service';

@Controller('api/v1/master')
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  @Get('cities')
  async getCities() {
    const data = await this.masterService.getCities();
    return { success: true, data };
  }

  @Get('projects')
  async getProjects() {
    const data = await this.masterService.getProjects();
    return { success: true, data };
  }

  @Get('lead-sources')
  async getLeadSources() {
    const data = await this.masterService.getLeadSources();
    return { success: true, data };
  }

  @Post('lead-sources')
  async createLeadSource(@Body() body: { name: string }) {
    const data = await this.masterService.createLeadSource(body.name);
    return { success: true, data };
  }
}
