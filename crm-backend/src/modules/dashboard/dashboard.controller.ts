import { Body, Controller, Delete, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CacheService } from '../analytics/cache.service';
import { DashboardService } from './dashboard.service';
import type { Viewer } from './types';

@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService, private readonly cache: CacheService) {}

  /** The subject picker: departments and people this viewer may open. */
  @Get('subjects')
  async subjects(@Request() req: { user: Viewer }) {
    return { success: true, data: await this.dashboard.subjects(req.user) };
  }

  /** ?subject=all|dept:ID|user:ID|me&range=today|7d|30d|6m&tab=… */
  @Get()
  async report(
    @Request() req: { user: Viewer },
    @Query('subject') subject?: string,
    @Query('range') range?: string,
    @Query('tab') tab?: string,
  ) {
    return { success: true, data: await this.dashboard.report(req.user, { subject, range, tab }) };
  }

  /** Remembers achievements the viewer has celebrated, so confetti plays once. */
  @Post('achievements/seen')
  async seen(@Request() req: { user: Viewer }, @Body() body: { items?: { key: string; period: string }[] }) {
    return { success: true, data: await this.dashboard.markSeen(req.user, Array.isArray(body?.items) ? body.items : []) };
  }

  @Delete('cache')
  async refresh(@Request() req: { user: Viewer }) {
    await this.cache.clear(`dashboard:v1:${Math.trunc(Number(req.user.id))}:*`);
    return { success: true };
  }
}
