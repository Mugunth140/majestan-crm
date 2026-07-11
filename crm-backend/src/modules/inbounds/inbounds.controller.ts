import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InboundsService } from './inbounds.service';
import { Inbound } from '../../database/entities/inbound.entity';
import { InboundFollowUp } from '../../database/entities/inbound-follow-up.entity';
import { InboundContactLog } from '../../database/entities/inbound-contact-log.entity';

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


  @Post(':id/follow-ups')
  addFollowUp(
    @Param('id') id: string,
    @Body() payload: Partial<InboundFollowUp>,
  ) {
    // We default created_by_id to 1 here as in leads (if leads even uses it).
    return this.inboundsService.addFollowUp(+id, payload, 1);
  }

  @Post(':id/contact-log')
  addContactLog(
    @Param('id') id: string,
    @Body() payload: Partial<InboundContactLog>,
  ) {
    // Defaulting sent_by_id to 1 as dummy userId for now
    return this.inboundsService.addContactLog(+id, payload, 1);
  }

  @Patch(':id/follow-ups/:followUpId')
  updateFollowUp(
    @Param('id') id: string,
    @Param('followUpId') followUpId: string,
    @Body() payload: Partial<InboundFollowUp>,
  ) {
    return this.inboundsService.updateFollowUp(+id, +followUpId, payload);
  }

  @Delete(':id/follow-ups/:followUpId')
  deleteFollowUp(
    @Param('id') id: string,
    @Param('followUpId') followUpId: string,
  ) {
    return this.inboundsService.deleteFollowUp(+id, +followUpId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inboundsService.remove(+id);
  }
}
