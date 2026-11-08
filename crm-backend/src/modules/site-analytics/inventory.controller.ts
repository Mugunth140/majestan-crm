import {
  Controller,
  Get,
  Header,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SiteAnalyticsService } from './site-analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
@Controller('api/v1/site-analytics/property-insights/v2')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class InventoryController {
  constructor(private readonly analytics: SiteAnalyticsService) {}
  private load(
    action: string,
    query: Record<string, unknown>,
    user: { id: number; role: string },
  ) {
    return this.analytics.inventory(action, query, user);
  }
  @Get('report') @Header('Cache-Control', 'no-store') async report(
    @Query() q: Record<string, unknown>,
    @Request() req: { user: { id: number; role: string } },
  ) {
    return { success: true, data: await this.load('report', q, req.user) };
  }
  @Get('options') @Header('Cache-Control', 'no-store') async options(
    @Query() q: Record<string, unknown>,
    @Request() req: { user: { id: number; role: string } },
  ) {
    return { success: true, data: await this.load('options', q, req.user) };
  }
  @Get('records') @Header('Cache-Control', 'no-store') async records(
    @Query() q: Record<string, unknown>,
    @Request() req: { user: { id: number; role: string } },
  ) {
    return { success: true, data: await this.load('records', q, req.user) };
  }
  @Get('listing') @Header('Cache-Control', 'no-store') async listing(
    @Query() q: Record<string, unknown>,
    @Request() req: { user: { id: number; role: string } },
  ) {
    return { success: true, data: await this.load('listing', q, req.user) };
  }
  @Get('compare') @Header('Cache-Control', 'no-store') async compare(
    @Query() q: Record<string, unknown>,
    @Request() req: { user: { id: number; role: string } },
  ) {
    return { success: true, data: await this.load('compare', q, req.user) };
  }
  @Get('export') @Header('Cache-Control', 'no-store') async export(
    @Query() q: Record<string, unknown>,
    @Request() req: { user: { id: number; role: string } },
  ) {
    return { success: true, data: await this.load('export', q, req.user) };
  }
  @Post('refresh') async refresh() {
    return { success: true, data: await this.analytics.refreshInventory() };
  }
}
