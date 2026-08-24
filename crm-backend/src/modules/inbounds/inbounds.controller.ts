import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, BadRequestException, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InboundsService } from './inbounds.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInboundDto } from './dto/create-inbound.dto';
import { UpdateInboundDto } from './dto/update-inbound.dto';
import { CreateInboundFollowUpDto } from './dto/create-inbound-follow-up.dto';
import { UpdateInboundFollowUpDto } from './dto/update-inbound-follow-up.dto';
import { CreateInboundContactLogDto } from './dto/create-inbound-contact-log.dto';

@Controller('api/v1/inbounds')
@UseGuards(JwtAuthGuard)
export class InboundsController {
  constructor(private readonly inboundsService: InboundsService) {}

  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB hard limit at multer layer
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only JPEG, PNG, WebP, HEIC images are allowed'), false);
      }
    },
  }))
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
  create(@Body() createInboundDto: CreateInboundDto, @Request() req: any) {
    if (req.user && req.user.role === 'Staff') {
      createInboundDto.assigned_staff_id = req.user.id;
    }
    return this.inboundsService.create(createInboundDto);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.inboundsService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.inboundsService.findOne(+id, req.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInboundDto: UpdateInboundDto) {
    return this.inboundsService.update(+id, updateInboundDto);
  }

  @Post(':id/follow-ups')
  async addFollowUp(
    @Param('id') id: string,
    @Body() payload: CreateInboundFollowUpDto,
  ) {
    const data = await this.inboundsService.addFollowUp(+id, payload, 1);
    return { success: true, data };
  }

  @Post(':id/contact-log')
  async addContactLog(
    @Param('id') id: string,
    @Body() payload: CreateInboundContactLogDto,
  ) {
    const data = await this.inboundsService.addContactLog(+id, payload, 1);
    return { success: true, data };
  }

  @Patch(':id/follow-ups/:followUpId')
  async updateFollowUp(
    @Param('id') id: string,
    @Param('followUpId') followUpId: string,
    @Body() payload: UpdateInboundFollowUpDto,
  ) {
    const data = await this.inboundsService.updateFollowUp(+id, +followUpId, payload);
    return { success: true, data };
  }

  @Delete(':id/follow-ups/:followUpId')
  async deleteFollowUp(
    @Param('id') id: string,
    @Param('followUpId') followUpId: string,
  ) {
    const data = await this.inboundsService.deleteFollowUp(+id, +followUpId);
    return { success: true, data };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inboundsService.remove(+id);
  }
}
