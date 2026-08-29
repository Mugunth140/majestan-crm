import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
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

export class BulkPropertyRowDto {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  listingType!: string;

  @IsNotEmpty()
  @IsString()
  propertyType!: string;

  @IsNotEmpty()
  @Transform(toNumber)
  @IsNumber()
  price!: number;

  @IsNotEmpty()
  @IsString()
  city!: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  locality?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  bedrooms?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  bathrooms?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  areaSqft?: number;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  ownerName?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  description?: string;
}

export class BulkImportPropertyDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => BulkPropertyRowDto)
  properties!: BulkPropertyRowDto[];
}
