import { Body, Controller, Get, Post, Put, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { MasterService } from './master.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/master')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // ---- Cities ----

  @Get('cities')
  async getCities() {
    const data = await this.masterService.getCities();
    return { success: true, data };
  }

  @Get('all-cities')
  async getAllCities(@Query('search') search?: string) {
    const data = await this.masterService.getAllCities(search);
    return { success: true, data };
  }

  @Post('cities')
  @Roles('Admin')
  async createCity(@Body() body: { city_name: string; state_name: string; country_name?: string; country_code?: string; is_active?: number }) {
    const data = await this.masterService.createCity(body);
    return { success: true, data };
  }

  @Patch('cities/:id')
  @Roles('Admin')
  async updateCity(@Param('id') id: number, @Body() body: { city_name?: string; state_name?: string; country_name?: string; country_code?: string; is_active?: number }) {
    const data = await this.masterService.updateCity(id, body);
    return { success: true, data };
  }

  @Delete('cities/:id')
  @Roles('Admin')
  async deleteCity(@Param('id') id: number) {
    const data = await this.masterService.deleteCity(id);
    return { success: true, data };
  }

  // ---- Sublocations ----

  @Get('sublocations')
  async getSublocations(@Query('city_name') cityName: string) {
    const data = await this.masterService.getSublocations(cityName || '');
    return { success: true, data };
  }

  @Get('all-sublocations')
  async getAllSublocations(@Query('search') search?: string) {
    const data = await this.masterService.getAllSublocations(search);
    return { success: true, data };
  }

  @Post('sublocations')
  @Roles('Admin')
  async createSublocation(@Body() body: { city_id: number; locality_name: string; postal_code?: string; is_active?: number }) {
    const data = await this.masterService.createSublocation(body);
    return { success: true, data };
  }

  @Patch('sublocations/:id')
  @Roles('Admin')
  async updateSublocation(@Param('id') id: number, @Body() body: { city_id?: number; locality_name?: string; postal_code?: string; is_active?: number }) {
    const data = await this.masterService.updateSublocation(id, body);
    return { success: true, data };
  }

  @Delete('sublocations/:id')
  @Roles('Admin')
  async deleteSublocation(@Param('id') id: number) {
    const data = await this.masterService.deleteSublocation(id);
    return { success: true, data };
  }

  // ---- Projects ----

  @Get('projects')
  async getProjects() {
    const data = await this.masterService.getProjects();
    return { success: true, data };
  }

  // ---- Lead Sources ----

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

  // ---- Property Types ----

  @Get('property-types')
  async getPropertyTypes() {
    const data = await this.masterService.getPropertyTypes();
    return { success: true, data };
  }

  @Get('all-property-types')
  async getAllPropertyTypes() {
    const data = await this.masterService.getAllPropertyTypes();
    return { success: true, data };
  }

  @Post('property-types')
  @Roles('Admin')
  async createPropertyType(@Body() body: { name: string; value: string; is_active?: boolean }) {
    const data = await this.masterService.createPropertyType(body);
    return { success: true, data };
  }

  @Put('property-types/:id')
  @Roles('Admin')
  async updatePropertyType(@Param('id') id: number, @Body() body: { name: string; value: string; is_active: boolean }) {
    const data = await this.masterService.updatePropertyType(id, body);
    return { success: true, data };
  }

  @Delete('property-types/:id')
  @Roles('Admin')
  async deletePropertyType(@Param('id') id: number) {
    const data = await this.masterService.deletePropertyType(id);
    return { success: true, data };
  }
}
