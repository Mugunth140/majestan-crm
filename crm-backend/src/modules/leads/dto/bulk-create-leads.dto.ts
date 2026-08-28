import { IsArray, ValidateNested, IsOptional, IsString, IsBoolean, IsNumber, ArrayMaxSize } from 'class-validator';
import { Type, Transform } from 'class-transformer';

const toTrimmedString = ({ value }: { value: any }) => {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
};

const toNumber = ({ value }: { value: any }) => {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
};

const toBoolean = ({ value }: { value: any }) => {
  if (value == null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'yes' || v === 'true' || v === '1') return true;
    if (v === 'no' || v === 'false' || v === '0') return false;
  }
  return undefined;
};

export class BulkLeadDto {
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  mobile?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  email?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  city?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  address?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  source?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  commissionRemarks?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  commission?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isReferral?: boolean;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  referredByName?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  referredByContact?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  propertyCategory?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  propertyType?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  purchaseType?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  funder?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  project?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  purchaseTimeline?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  qualificationPurpose?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  decisionMaker?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  notes?: string;
}

export class BulkCreateLeadsDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => BulkLeadDto)
  leads: BulkLeadDto[];
}
