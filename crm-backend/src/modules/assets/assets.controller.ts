import { Controller, Get, Post, Body, Param, UseInterceptors, UploadedFiles, BadRequestException } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';

@Controller('api/v1/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  async create(@Body() createAssetDto: CreateAssetDto) {
    const data = await this.assetsService.create(createAssetDto);
    return { success: true, data };
  }

  @Get()
  async findAll() {
    const data = await this.assetsService.findAll();
    return { success: true, data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.assetsService.findOne(+id);
    return { success: true, data };
  }

  @Post(':id/media')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'document', maxCount: 1 },
    { name: 'images', maxCount: 4 }
  ]))
  async uploadMedia(
    @Param('id') id: string,
    @UploadedFiles() files: { document?: Express.Multer.File[], images?: Express.Multer.File[] }
  ) {
    if (!files) throw new BadRequestException('No files uploaded');
    const data = await this.assetsService.uploadMedia(+id, files);
    return { success: true, data };
  }
}
