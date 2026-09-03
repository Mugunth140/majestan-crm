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
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
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

  // NOTE: /form-data, /bulk, /presigned-url and /upload declared BEFORE /:id to avoid param conflict
  @Get('presigned-url')
  async presignedUrl(@Query('fileName') fileName: string, @Query('fileType') fileType: string) {
    const data = await this.propertiesService.presignedUrl(fileName, fileType);
    return { success: true, data };
  }

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 10 },
    }),
  )
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No image files received');
    }
    const data = await this.propertiesService.uploadImages(files);
    return { success: true, data };
  }

  @Post('upload-docs')
  @UseInterceptors(
    FilesInterceptor('documents', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 10 },
    }),
  )
  async uploadDocuments(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No document files received');
    }
    const data = await this.propertiesService.uploadDocuments(files);
    return { success: true, data };
  }

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
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.propertiesService.findOne(id);
    return { success: true, data };
  }

  @Post()
  async create(@Body() dto: CreatePropertyDto) {
    const data = await this.propertiesService.create(dto);
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePropertyDto) {
    const data = await this.propertiesService.update(id, dto);
    return { success: true, data };
  }

  @Patch(':id/visibility')
  async toggleVisibility(@Param('id', ParseIntPipe) id: number) {
    const data = await this.propertiesService.toggleVisibility(id);
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const data = await this.propertiesService.remove(id);
    return { success: true, data };
  }
}
