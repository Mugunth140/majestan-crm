import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InboundsService } from './inbounds.service';
import { Inbound } from '../../database/entities/inbound.entity';

@Controller('api/v1/inbounds')
export class InboundsController {
  constructor(private readonly inboundsService: InboundsService) {}

  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.inboundsService.uploadImage(+id, file);
  }

  @Post()
  create(@Body() createInboundDto: Partial<Inbound>) {
    return this.inboundsService.create(createInboundDto);
  }

  @Get()
  findAll() {
    return this.inboundsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inboundsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInboundDto: Partial<Inbound>) {
    return this.inboundsService.update(+id, updateInboundDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inboundsService.remove(+id);
  }
}
