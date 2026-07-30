import { Controller, Get, Post, Put, Body, Param, UseInterceptors, UploadedFiles, BadRequestException, UseGuards, Request } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  async create(@Body() createAssetDto: CreateAssetDto, @Request() req: any) {
    if (req.user && req.user.role === 'Staff' && !createAssetDto.assigned_staff_id) {
      createAssetDto.assigned_staff_id = req.user.id;
    }
    const data = await this.assetsService.create(createAssetDto);
    return { success: true, data };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto) {
    const data = await this.assetsService.update(+id, updateAssetDto);
    return { success: true, data };
  }

  @Get()
  async findAll(@Request() req: any) {
    const data = await this.assetsService.findAll(req.user);
    return { success: true, data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const data = await this.assetsService.findOne(+id, req.user);
    return { success: true, data };
  }

  @Post(':id/media')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'document', maxCount: 1 },
    { name: 'images', maxCount: 4 },
    { name: 'fmb', maxCount: 1 },
    { name: 'barcode', maxCount: 1 }
  ]))
  async uploadMedia(
    @Param('id') id: string,
    @UploadedFiles() files: { document?: Express.Multer.File[], images?: Express.Multer.File[], fmb?: Express.Multer.File[], barcode?: Express.Multer.File[] }
  ) {
    if (!files) throw new BadRequestException('No files uploaded');
    const data = await this.assetsService.uploadMedia(+id, files);
    return { success: true, data };
  }
}
