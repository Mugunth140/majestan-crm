import { IsString, IsOptional, IsBoolean, IsInt, IsNumber, IsObject, IsArray } from 'class-validator';
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

  // Self-assign / direct assign target sent by the new-lead form as `userId`.
  // Must be declared or the global whitelist ValidationPipe strips it and the
  // lead is silently created unassigned.
  @IsOptional()
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  project?: string;

  @IsOptional()
  @IsString()
  purchaseType?: string;

  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @IsString()
  funder?: string;

  @IsOptional()
  @IsString()
  propertyCategory?: string;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  cityId?: number;

  @IsOptional()
  @IsArray()
  subLocations?: string[];

  @IsOptional()
  @IsString()
  purchaseTimeline?: string;

  @IsOptional()
  @IsString()
  qualificationPurpose?: string;

  @IsOptional()
  @IsString()
  decisionMaker?: string;

  @IsOptional()
  @IsString()
  followUpDate?: string;

  @IsOptional()
  @IsString()
  followUpTime?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  commission?: number;

  @IsOptional()
  @IsString()
  commissionRemarks?: string;

  @IsOptional()
  @IsBoolean()
  isReferral?: boolean;

  @IsOptional()
  @IsString()
  referredByName?: string;

  @IsOptional()
  @IsString()
  referredByContact?: string;

  @IsOptional()
  @IsBoolean()
  is_unqualified?: boolean;
}
