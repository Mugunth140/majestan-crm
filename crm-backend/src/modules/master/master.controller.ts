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
  async createSublocation(@Body() body: { city_id: number; locality_name: string; postal_code?: string; description?: string | null; is_active?: number }) {
    const data = await this.masterService.createSublocation(body);
    return { success: true, data };
  }

  @Patch('sublocations/:id')
  @Roles('Admin')
  async updateSublocation(@Param('id') id: number, @Body() body: { city_id?: number; locality_name?: string; postal_code?: string; description?: string | null; is_active?: number }) {
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

  // ---- Road Names ----

  @Get('road-names')
  async getRoadNames() {
    const data = await this.masterService.getRoadNames();
    return { success: true, data };
  }

  @Get('all-road-names')
  async getAllRoadNames() {
    const data = await this.masterService.getAllRoadNames();
    return { success: true, data };
  }

  @Post('road-names')
  @Roles('Admin')
  async createRoadName(@Body() body: { name: string }) {
    const data = await this.masterService.createRoadName(body.name);
    return { success: true, data };
  }

  @Put('road-names/:id')
  @Roles('Admin')
  async updateRoadName(@Param('id') id: number, @Body() body: { name: string; is_active: boolean }) {
    const data = await this.masterService.updateRoadName(id, body);
    return { success: true, data };
  }

  @Delete('road-names/:id')
  @Roles('Admin')
  async deleteRoadName(@Param('id') id: number) {
    const data = await this.masterService.deleteRoadName(id);
    return { success: true, data };
  }

  // ---- Registration Charges ----

  @Get('registration-charges')
  async getRegistrationCharges() {
    const data = await this.masterService.getRegistrationCharges();
    return { success: true, data };
  }

  @Get('all-registration-charges')
  async getAllRegistrationCharges() {
    const data = await this.masterService.getAllRegistrationCharges();
    return { success: true, data };
  }

  @Post('registration-charges')
  @Roles('Admin')
  async createRegistrationCharge(@Body() body: { name: string }) {
    const data = await this.masterService.createRegistrationCharge(body.name);
    return { success: true, data };
  }

  @Put('registration-charges/:id')
  @Roles('Admin')
  async updateRegistrationCharge(@Param('id') id: number, @Body() body: { name: string; is_active: boolean }) {
    const data = await this.masterService.updateRegistrationCharge(id, body);
    return { success: true, data };
  }

  @Delete('registration-charges/:id')
  @Roles('Admin')
  async deleteRegistrationCharge(@Param('id') id: number) {
    const data = await this.masterService.deleteRegistrationCharge(id);
    return { success: true, data };
  }

  // ---- Furnishing Items ----

  @Get('all-furnishing-items')
  async getAllFurnishingItems(@Query('search') search?: string) {
    const data = await this.masterService.getAllFurnishingItems(search);
    return { success: true, data };
  }

  @Post('furnishing-items')
  @Roles('Admin')
  async createFurnishingItem(@Body() body: { name: string; icon?: string }) {
    const data = await this.masterService.createFurnishingItem(body);
    return { success: true, data };
  }

  @Put('furnishing-items/:id')
  @Roles('Admin')
  async updateFurnishingItem(@Param('id') id: number, @Body() body: { name?: string; icon?: string; is_active?: boolean }) {
    const data = await this.masterService.updateFurnishingItem(id, body);
    return { success: true, data };
  }

  @Delete('furnishing-items/:id')
  @Roles('Admin')
  async deleteFurnishingItem(@Param('id') id: number) {
    const data = await this.masterService.deleteFurnishingItem(id);
    return { success: true, data };
  }

  // ---- Utilities ----

  @Get('all-utilities')
  async getAllUtilities(@Query('search') search?: string) {
    const data = await this.masterService.getAllUtilities(search);
    return { success: true, data };
  }

  @Post('utilities')
  @Roles('Admin')
  async createUtility(@Body() body: { name: string; icon?: string }) {
    const data = await this.masterService.createUtility(body);
    return { success: true, data };
  }

  @Put('utilities/:id')
  @Roles('Admin')
  async updateUtility(@Param('id') id: number, @Body() body: { name?: string; icon?: string; is_active?: boolean }) {
    const data = await this.masterService.updateUtility(id, body);
    return { success: true, data };
  }

  @Delete('utilities/:id')
  @Roles('Admin')
  async deleteUtility(@Param('id') id: number) {
    const data = await this.masterService.deleteUtility(id);
    return { success: true, data };
  }

  // ---- Room Names ----

  @Get('room-names')
  async getRoomNames() {
    const data = await this.masterService.getRoomNames();
    return { success: true, data };
  }

  @Get('all-room-names')
  async getAllRoomNames() {
    const data = await this.masterService.getAllRoomNames();
    return { success: true, data };
  }

  @Post('room-names')
  @Roles('Admin')
  async createRoomName(@Body() body: { name: string }) {
    const data = await this.masterService.createRoomName(body.name);
    return { success: true, data };
  }

  @Put('room-names/:id')
  @Roles('Admin')
  async updateRoomName(@Param('id') id: number, @Body() body: { name: string; is_active: boolean }) {
    const data = await this.masterService.updateRoomName(id, body);
    return { success: true, data };
  }

  @Delete('room-names/:id')
  @Roles('Admin')
  async deleteRoomName(@Param('id') id: number) {
    const data = await this.masterService.deleteRoomName(id);
    return { success: true, data };
  }

  // ---- Room Dimensions ----

  @Get('room-dimensions')
  async getRoomDimensions() {
    const data = await this.masterService.getRoomDimensions();
    return { success: true, data };
  }

  @Get('all-room-dimensions')
  async getAllRoomDimensions() {
    const data = await this.masterService.getAllRoomDimensions();
    return { success: true, data };
  }

  @Post('room-dimensions')
  @Roles('Admin')
  async createRoomDimension(
    @Body() body: { name: string; lengthFt?: number | null; widthFt?: number | null },
  ) {
    const data = await this.masterService.createRoomDimension(body);
    return { success: true, data };
  }

  @Put('room-dimensions/:id')
  @Roles('Admin')
  async updateRoomDimension(
    @Param('id') id: number,
    @Body() body: { name: string; lengthFt?: number | null; widthFt?: number | null; is_active: boolean },
  ) {
    const data = await this.masterService.updateRoomDimension(id, body);
    return { success: true, data };
  }

  @Delete('room-dimensions/:id')
  @Roles('Admin')
  async deleteRoomDimension(@Param('id') id: number) {
    const data = await this.masterService.deleteRoomDimension(id);
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
