import { IsString, IsOptional, IsBoolean, IsInt, IsNumber, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';

const toTrimmedString = ({ value }: { value: any }) => {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
};

export class CreateLeadDto {
  @IsString()
  name: string;

  // Accept either 'mobile' (sent by the frontend form) or the legacy 'mobile_number'.
  // The service normalises both to body.mobile internally.
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  mobile?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  mobile_number?: string;

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
