import { IsString, IsOptional, IsBoolean, IsInt, IsNumber, IsObject } from 'class-validator';

export class CreateLeadDto {
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
  lead_source?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  assigned_staff_id?: number;

  @IsOptional()
  @IsBoolean()
  is_unqualified?: boolean;
}
