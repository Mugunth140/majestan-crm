import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { BulkImportPropertyDto } from './dto/bulk-import-property.dto';
import { PropertyQueryDto } from './dto/property-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/properties')
@UseGuards(JwtAuthGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  async findAll(@Query() query: PropertyQueryDto) {
    const data = await this.propertiesService.findAll(query);
    return { success: true, ...data };
  }

  // NOTE: /form-data and /bulk declared BEFORE /:id to avoid param conflict
  @Get('form-data')
  async findFormData() {
    const data = await this.propertiesService.findFormData();
    return { success: true, data };
  }

  @Post('bulk')
  async bulkImport(@Body() dto: BulkImportPropertyDto) {
    const result = await this.propertiesService.bulkImport(dto);
    return { success: true, ...result };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.propertiesService.findOne(+id);
    return { success: true, data };
  }

  @Post()
  async create(@Body() dto: CreatePropertyDto) {
    const data = await this.propertiesService.create(dto);
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePropertyDto) {
    const data = await this.propertiesService.update(+id, dto);
    return { success: true, data };
  }

  @Patch(':id/visibility')
  async toggleVisibility(@Param('id') id: string) {
    const data = await this.propertiesService.toggleVisibility(+id);
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const data = await this.propertiesService.remove(+id);
    return { success: true, data };
  }
}
