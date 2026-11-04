import { Controller, Delete, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoachingService } from './coaching.service';
import { MetricsService } from './metrics.service';
@Controller('api/v1/metrics')
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService, private readonly coaching: CoachingService) {}

  @Get('coaching/people')
  async getCoachingPeople(@Request() req: any) {
    return { success: true, data: await this.coaching.people(req.user) };
  }

  @Get('coaching')
  async getCoaching(@Query('person') person: string, @Query('days') days: string, @Request() req: any) {
    return { success: true, data: await this.coaching.report(req.user, person, days) };
  }
  @Get('summary')
  async getSummary(@Query('from') from: string, @Query('to') to: string, @Request() req: any) {
    const now = new Date();
    const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const defaultTo = now.toISOString().slice(0, 10);
    const data = await this.metricsService.getSummary(req.user, from || defaultFrom, to || defaultTo);
    return { success: true, data };
  }
  @Get('charts')
  async getCharts(@Query('type') type: string, @Query('from') from: string, @Query('to') to: string, @Request() req: any) {
    const now = new Date();
    const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const defaultTo = now.toISOString().slice(0, 10);
    const data = await this.metricsService.getChartData(req.user, type || 'trends', from || defaultFrom, to || defaultTo);
    return { success: true, data };
  }
  /** A metric over time, e.g. ?metric=calls&interval=week&by=staff. */
  @Get('series')
  async getSeries(
    @Query('metric') metric: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('interval') interval: string,
    @Query('by') by: string,
    @Request() req: any,
  ) {
    const { from: f, to: t } = this.range(from, to, 90);
    const data = await this.metricsService.getSeries(req.user, metric, f, t, interval || 'day', by || undefined);
    return { success: true, data };
  }
  /** Lead counts by status, day by day. */
  @Get('pipeline-history')
  async getPipelineHistory(@Query('from') from: string, @Query('to') to: string, @Request() req: any) {
    const { from: f, to: t } = this.range(from, to, 90);
    const data = await this.metricsService.getPipelineHistory(req.user, f, t);
    return { success: true, data };
  }
  private range(from: string | undefined, to: string | undefined, days: number) {
    const today = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const valid = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
    return { from: valid(from) ?? start, to: valid(to) ?? today };
  }
  @Delete('cache')
  async bustCache(@Request() req: any) {
    await this.metricsService.bustCache(req.user.id);
    return { success: true };
  }
}
