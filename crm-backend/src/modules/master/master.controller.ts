import { Body, Controller, Get, Post, Put, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { MasterService } from './master.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/master')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  @Get('cities')
  async getCities() {
    const data = await this.masterService.getCities();
    return { success: true, data };
  }

  @Get('sublocations')
  async getSublocations(@Query('city_name') cityName: string) {
    const data = await this.masterService.getSublocations(cityName || '');
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

  @Get('all-lead-sources')
  async getAllLeadSources() {
    const data = await this.masterService.getAllLeadSources();
    return { success: true, data };
  }

  @Post('lead-sources')
  @Roles('Admin')
  async createLeadSource(@Body() body: { name: string }) {
    const data = await this.masterService.createLeadSource(body.name);
    return { success: true, data };
  }

  @Put('lead-sources/:id')
  @Roles('Admin')
  async updateLeadSource(@Param('id') id: number, @Body() body: { name: string; is_active: boolean }) {
    const data = await this.masterService.updateLeadSource(id, body);
    return { success: true, data };
  }

  @Delete('lead-sources/:id')
  @Roles('Admin')
  async deleteLeadSource(@Param('id') id: number) {
    const data = await this.masterService.deleteLeadSource(id);
    return { success: true, data };
  }
}
