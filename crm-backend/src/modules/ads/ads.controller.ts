import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdsAccessGuard } from './ads-access.guard';
import { AdsService } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';
import { ReorderAdsDto } from './dto/reorder-ads.dto';

@Controller('api/v1/ads')
@UseGuards(JwtAuthGuard, AdsAccessGuard)
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  // NOTE: /presigned-url and /reorder declared BEFORE /:id to avoid param conflict
  @Get('presigned-url')
  async presignedUrl(@Query('fileName') fileName: string, @Query('fileType') fileType: string) {
    const data = await this.adsService.presignedUrl(fileName, fileType);
    return { success: true, data };
  }

  @Patch('reorder')
  async reorder(@Body() dto: ReorderAdsDto) {
    const data = await this.adsService.reorder(dto.ids);
    return { success: true, data };
  }

  @Get()
  async findAll(@Query('placement') placement?: string) {
    const data = await this.adsService.list({ placement });
    return { success: true, data };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.adsService.getOne(id);
    return { success: true, data };
  }

  @Post()
  async create(@Body() dto: CreateAdDto) {
    const data = await this.adsService.create(dto);
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdDto) {
    const data = await this.adsService.update(id, dto);
    return { success: true, data };
  }

  @Patch(':id/status')
  async setStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { isActive: boolean }) {
    const data = await this.adsService.setStatus(id, body.isActive === true);
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const data = await this.adsService.remove(id);
    return { success: true, data };
  }
}
