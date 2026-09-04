import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ContactLogsService } from './contact-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeviceAuthGuard } from './device-auth.guard';
import { RecordDeviceHeartbeatDto } from './dto/record-device-heartbeat.dto';
import { SyncCallLogsDto } from './dto/sync-call-logs.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Controller('api/v1/contact-logs')
export class ContactLogsController {
  constructor(private readonly contactLogsService: ContactLogsService) {}

  // Device secret issuance — staff JWT only (used once at sign-in).
  @UseGuards(JwtAuthGuard)
  @Post('device/register')
  async registerDevice(@Request() req: any, @Body() body: RegisterDeviceDto) {
    const data = await this.contactLogsService.registerDevice(req.user.id, body.deviceId);
    return { success: true, data };
  }

  // Revoke own device (logout). Admins can revoke any device.
  @UseGuards(JwtAuthGuard)
  @Post('device/revoke')
  async revokeDevice(@Request() req: any, @Body() body: RegisterDeviceDto) {
    const data = await this.contactLogsService.revokeDevice(req.user.id, body.deviceId, req.user);
    return { success: true, data };
  }

  // Background logger routes accept device secret OR staff JWT.
  @UseGuards(DeviceAuthGuard)
  @Get('trackable-numbers')
  async getTrackableNumbers(@Request() req: any) {
    const data = await this.contactLogsService.getTrackableNumbers(req.user.id);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('devices')
  async getLoggerDevices(@Request() req: any) {
    const data = await this.contactLogsService.getLoggerDevices(req.user.id);
    return { success: true, data };
  }

  @UseGuards(DeviceAuthGuard)
  @Get('repair-status')
  async repairStatus(@Request() req: any) {
    const data = await this.contactLogsService.repairStatus(req.user.id);
    return { success: true, data };
  }

  @UseGuards(DeviceAuthGuard)
  @Post('device/heartbeat')
  async recordDeviceHeartbeat(@Request() req: any, @Body() body: RecordDeviceHeartbeatDto) {
    const data = await this.contactLogsService.recordDeviceHeartbeat(req.user.id, body);
    return { success: true, data };
  }

  @UseGuards(DeviceAuthGuard)
  @Post('sync')
  async syncCallLogs(@Request() req: any, @Body() body: SyncCallLogsDto) {
    const data = await this.contactLogsService.syncCallLogs(req.user.id, body.logs || []);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('global')
  async getGlobalFeed() {
    const data = await this.contactLogsService.getGlobalFeed();
    return { success: true, data };
  }
}
