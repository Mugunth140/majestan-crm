import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ContactLogsService } from './contact-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/contact-logs')
@UseGuards(JwtAuthGuard)
export class ContactLogsController {
  constructor(private readonly contactLogsService: ContactLogsService) {}

  @Get('trackable-numbers')
  async getTrackableNumbers(@Request() req: any) {
    const data = await this.contactLogsService.getTrackableNumbers(req.user.id);
    return { success: true, data };
  }

  @Get('devices')
  async getLoggerDevices(@Request() req: any) {
    const data = await this.contactLogsService.getLoggerDevices(req.user.id);
    return { success: true, data };
  }

  @Post('device/heartbeat')
  async recordDeviceHeartbeat(@Request() req: any, @Body() body: any) {
    const data = await this.contactLogsService.recordDeviceHeartbeat(req.user.id, body.deviceId);
    return { success: true, data };
  }

  @Post('sync')
  async syncCallLogs(@Request() req: any, @Body() body: any) {
    const data = await this.contactLogsService.syncCallLogs(req.user.id, body.logs || []);
    return { success: true, data };
  }

  @Get('global')
  async getGlobalFeed() {
    const data = await this.contactLogsService.getGlobalFeed();
    return { success: true, data };
  }
}
