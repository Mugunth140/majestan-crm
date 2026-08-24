import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class CreateInboundDto {
  @IsString()
  name: string;

  @IsString()
  mobile_number: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  whatsapp_number?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  assigned_staff_id?: number;
}
