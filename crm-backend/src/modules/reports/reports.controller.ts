import { Body, Controller, Get, Logger, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReportsService, type ReportRequest } from './reports.service';

/** Data exports. Admins only: a report can hold every customer's phone number. */
@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class ReportsController {
  private readonly log = new Logger('Reports');
  constructor(private readonly reports: ReportsService) {}

  @Get('modules')
  async modules() {
    return { success: true, data: await this.reports.catalog() };
  }

  @Post('preview')
  async preview(@Body() body: ReportRequest) {
    return { success: true, data: await this.reports.run(body, 'preview') };
  }

  @Post('export')
  async export(@Body() body: ReportRequest, @Request() req: { user: { id: number } }) {
    const data = await this.reports.run(body, 'export');
    // Who took which data out, for the record.
    this.log.log(`user ${req.user.id} exported ${data.label}: ${data.rows.length} rows, columns ${data.columns.map(c => c.key).join(',')}`);
    return { success: true, data };
  }
}
