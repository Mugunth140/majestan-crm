import { Controller, Delete, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MetricsService } from './metrics.service';
@Controller('api/v1/metrics')
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}
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
  @Delete('cache')
  async bustCache(@Request() req: any) {
    await this.metricsService.bustCache(req.user.id);
    return { success: true };
  }
}
