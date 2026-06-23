
import { Controller, Get } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';

@Controller('api/v1/activity-logs')
export class ActivityLogsController {
  constructor(private readonly service: ActivityLogsService) {}

  @Get()
  findAll() {
    return { success: true, message: 'Operation successful', data: [] };
  }
}
