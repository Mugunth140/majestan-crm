import { HrDocumentsService, MAX_HR_DOCUMENT_BYTES } from './hr-documents.service';
import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, BadRequestException, Put, UseGuards, ParseEnumPipe, Request, StreamableFile, Header, ParseIntPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssignHrCandidatesDto } from './dto/assign-hr-candidates.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BulkImportHrDto } from './dto/bulk-import-hr.dto';
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
  async addFollowUp(@Param('id', ParseIntPipe) id: number, @Body() data: CreateHrFollowUpDto) {
    await this.hrService.addFollowUp(+id, data);
    return { success: true };
  }

  @Put(':id/follow-ups/:fuId')
  async updateFollowUp(@Param('id', ParseIntPipe) id: number, @Param('fuId', ParseIntPipe) fuId: number, @Body() data: UpdateHrFollowUpDto) {
    return this.hrService.updateFollowUp(+id, +fuId, data);
  }

  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id/follow-ups/:fuId')
  async deleteFollowUp(@Param('id', ParseIntPipe) id: number, @Param('fuId', ParseIntPipe) fuId: number) {
    return this.hrService.deleteFollowUp(+id, +fuId);
  }

  constructor(private readonly hrService: HrService, private readonly documents: HrDocumentsService) {}

  @Get() findAll() { return this.hrService.findAll(); }

  @Get('staff-list')
  async staffList() { return { success: true, data: await this.hrService.getAssignableStaff() }; }

  @Post('assign') @UseGuards(RolesGuard) @Roles('Admin', 'Manager', 'Team Lead')
  assignCandidates(@Body() body: AssignHrCandidatesDto, @Request() req: any) {
    return this.hrService.assignCandidates(body.candidateIds, body.assignedStaffId, req.user);
  }
  
  @Post('bulk')
  bulkImport(@Body() body: BulkImportHrDto, @Request() req: any) { return this.hrService.bulkImport(body.candidates, req.user); }

  @Get(':id/activity')
  async activity(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: await this.hrService.activity(id) };
  }

  @Post(':id/contact-log')
  async addContactLog(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Request() req: any) {
    return { success: true, data: await this.hrService.addContactLog(id, body, req.user?.id ?? null) };
  }

  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.hrService.findOne(+id); }
  
  @Post() create(@Body() createDto: CreateHrCandidateDto, @Request() req: any) { return this.hrService.create(createDto, req.user); }
  
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateHrCandidateDto, @Request() req: any) {
    return this.hrService.update(+id, updateDto, req.user);
  }
  
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.hrService.remove(+id); }

  @Post(':id/upload/:docType')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_HR_DOCUMENT_BYTES } }))
  async uploadDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('docType', new ParseEnumPipe(HrDocumentType)) docType: HrDocumentType,
    @UploadedFile() file: Express.Multer.File,
    @Request() req?: any,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    await this.hrService.findOne(+id);
    const reference = await this.documents.upload(+id, docType, file);
    try {
      return await this.hrService.saveDocument(+id, docType, reference, req?.user);
    } catch (error) {
      // A lost database acknowledgement can still mean the write committed.
      // Keep the object when its persisted reference cannot be ruled out.
      const current = await this.hrService.findOne(+id).catch(() => null);
      if (current && current[`${docType}Url`] !== reference) await this.documents.discard(reference).catch(() => {});
      throw error;
    }
  }
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Get(':id/documents/:docType')
  async downloadDocument(@Param('id', ParseIntPipe) id: number, @Param('docType', new ParseEnumPipe(HrDocumentType)) docType: HrDocumentType) {
    const candidate = await this.hrService.findOne(+id);
    const document = await this.documents.read(+id, docType, candidate[`${docType}Url`]);
    return new StreamableFile(document.buffer, {
      type: document.contentType, length: document.buffer.length,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
    });
  }

}
