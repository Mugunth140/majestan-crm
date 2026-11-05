import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StaffActivityService, type StaffActivityGroup } from './staff-activity.service';

const date = (v: string | undefined, name: string) => {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${name} must be a date`);
  return d;
};

/** The Activity Logs page: what one staff member did across the CRM. Admins and managers only. */
@Controller('api/v1/staff-activity')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class StaffActivityController {
  constructor(private readonly service: StaffActivityService) {}

  @Get()
  async list(
    @Query('userId') userId: string,
    @Query('group') group?: string,
    @Query('since') since?: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.service.list({
      userId: Number(userId),
      group: group === 'activity' || group === 'conversation' ? (group as StaffActivityGroup) : undefined,
      since: date(since, 'since'),
      before: date(before, 'before'),
      limit: limit ? Number(limit) : undefined,
    });
    return { success: true, data };
  }

  @Get('staff')
  async staff() {
    return { success: true, data: await this.service.staff() };
  }

  @Get('summary')
  async summary(@Query('userId') userId: string, @Query('since') since?: string) {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('Pick a staff member');
    return { success: true, data: await this.service.summary(id, date(since, 'since')) };
  }
}
