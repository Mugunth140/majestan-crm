import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, BadRequestException, Put, UseGuards, ParseEnumPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { HrService } from './hr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateHrCandidateDto } from './dto/create-hr-candidate.dto';
import { UpdateHrCandidateDto } from './dto/update-hr-candidate.dto';
import { CreateHrFollowUpDto } from './dto/create-hr-follow-up.dto';
import { UpdateHrFollowUpDto } from './dto/update-hr-follow-up.dto';

export enum HrDocumentType {
  RESUME = 'resume',
  AADHAAR = 'aadhaar',
  PAN = 'pan',
  EDUCATION_CERT = 'educationCert',
  EXPERIENCE_CERT = 'experienceCert',
  PHOTO = 'photo',
}

@Controller('api/v1/hr')
@UseGuards(JwtAuthGuard)
export class HrController {
  @Post(':id/follow-ups')
  async addFollowUp(@Param('id') id: string, @Body() data: CreateHrFollowUpDto) {
    await this.hrService.addFollowUp(+id, data);
    return { success: true };
  }

  @Put(':id/follow-ups/:fuId')
  async updateFollowUp(@Param('id') id: string, @Param('fuId') fuId: string, @Body() data: UpdateHrFollowUpDto) {
    return this.hrService.updateFollowUp(+id, +fuId, data);
  }

  @Delete(':id/follow-ups/:fuId')
  async deleteFollowUp(@Param('id') id: string, @Param('fuId') fuId: string) {
    return this.hrService.deleteFollowUp(+id, +fuId);
  }

  constructor(private readonly hrService: HrService) {}

  @Get() findAll() { return this.hrService.findAll(); }
  
  @Get(':id') findOne(@Param('id') id: string) { return this.hrService.findOne(+id); }
  
  @Post() create(@Body() createDto: CreateHrCandidateDto) { return this.hrService.create(createDto); }
  
  @Patch(':id') update(@Param('id') id: string, @Body() updateDto: UpdateHrCandidateDto) {
    return this.hrService.update(+id, updateDto);
  }
  
  @Delete(':id') remove(@Param('id') id: string) { return this.hrService.remove(+id); }

  @Post(':id/upload/:docType')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('id') id: string,
    @Param('docType', new ParseEnumPipe(HrDocumentType)) docType: HrDocumentType,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('No file provided');
    // NOTE: In reality, upload this to S3/Cloudflare R2 here.
    // For this step, we will mock the URL and just update the DB record.
    const fileUrl = `https://r2.cloudflare.com/hr-documents/${id}/${docType}-${file.originalname}`;
    
    const updateData = { [`${docType}Url`]: fileUrl };
    return this.hrService.update(+id, updateData);
  }
}
