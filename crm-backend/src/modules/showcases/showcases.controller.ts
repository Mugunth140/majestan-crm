import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdsAccessGuard } from '../ads/ads-access.guard';
import { ShowcasesService } from './showcases.service';
import { ReplaceShowcaseDto } from './dto/replace-showcase.dto';

/** Same audience as Advertisement: Admin, Manager, or the Designing department. */
@Controller('api/v1/showcases')
@UseGuards(JwtAuthGuard, AdsAccessGuard)
export class ShowcasesController {
  constructor(private readonly showcasesService: ShowcasesService) {}

  // NOTE: /:section/candidates declared BEFORE /:section
  @Get(':section/candidates')
  async candidates(@Param('section') section: string, @Query('q') q?: string) {
    const data = await this.showcasesService.candidates(ShowcasesService.section(section), q ?? '');
    return { success: true, data };
  }

  @Get(':section')
  async list(@Param('section') section: string) {
    const data = await this.showcasesService.list(ShowcasesService.section(section));
    return { success: true, data };
  }

  @Put(':section')
  async replace(@Param('section') section: string, @Body() dto: ReplaceShowcaseDto) {
    const data = await this.showcasesService.replace(ShowcasesService.section(section), dto.ids);
    return { success: true, data };
  }
}
