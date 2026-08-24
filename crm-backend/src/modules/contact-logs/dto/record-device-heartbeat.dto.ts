import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class RecordDeviceHeartbeatDto {
  @IsString()
  deviceId: string;
  
  @IsString()
  event: string;

  @IsOptional()
  @IsNumber()
  syncedCount?: number;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsBoolean()
  callLogPermission?: boolean;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  androidVersion?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsNumber()
  batteryLevel?: number;
}
