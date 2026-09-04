import { IsString, Length, Matches } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @Length(8, 255)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'deviceId must be alphanumeric' })
  deviceId: string;
}
