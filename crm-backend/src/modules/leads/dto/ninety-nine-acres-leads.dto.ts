import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

export class NinetyNineAcresLeadDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;

  @Transform(({ value }) => {
    const raw = typeof value === 'number' ? String(value) : value;
    if (typeof raw !== 'string' || !/^[+()\d\s-]+$/.test(raw)) return raw;
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  })
  @IsString() @Matches(/^\d{10}$/, { message: 'mobile must be a valid 10-digit Indian number, optionally prefixed with +91' })
  mobile: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() || undefined : value)
  @IsOptional() @IsEmail() @MaxLength(255)
  email?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() || undefined : value)
  @IsOptional() @IsString() @MaxLength(2000)
  remarks?: string;
}

export class NinetyNineAcresLeadsDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => NinetyNineAcresLeadDto)
  leads: NinetyNineAcresLeadDto[];
}
