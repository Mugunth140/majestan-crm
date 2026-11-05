import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SiteAnalyticsService } from './site-analytics.service';

@Controller('api/v1/site-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class SiteAnalyticsController {
  constructor(private readonly analytics: SiteAnalyticsService) {}
  @Get('report')
  @Header('Cache-Control', 'no-store')
  async report(@Query('from') from: string, @Query('to') to: string) {
    return { success: true, data: await this.analytics.report(from, to) };
  }
  @Get('compare')
  @Header('Cache-Control', 'no-store')
  async compare(@Query('from') from: string, @Query('to') to: string) {
    return { success: true, data: await this.analytics.compare(from, to) };
  }
  @Get('status')
  @Header('Cache-Control', 'no-store')
  async status() {
    return { success: true, data: await this.analytics.status() };
  }
}
