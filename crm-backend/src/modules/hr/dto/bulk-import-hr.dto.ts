import { Type, Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';

export function normalizeCandidateMobile(value: unknown): string {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}
const text = ({ value }: { value: unknown }) => String(value ?? '').trim();

export class HrImportRowDto {
  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(255)
  name!: string;

  @Transform(({ value }) => normalizeCandidateMobile(value)) @Matches(/^\d{10}$/)
  mobile!: string;

  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(255)
  role!: string;

  @IsOptional() @Transform(text) @IsString() @MaxLength(255)
  experience?: string;

  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(255)
  location!: string;

  @Type(() => Number) @IsInt() @Min(1)
  hrSourceId!: number;

  @Transform(({ value }) => value == null || value === '' ? undefined : Number(value))
  @IsOptional() @IsInt() @Min(1)
  staffId?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(2)
  rowNumber?: number;
}

export class BulkImportHrDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => HrImportRowDto)
  candidates!: HrImportRowDto[];
}
