import { IsDateString, Matches, IsInt } from 'class-validator';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PropertyQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @IsString()
  listingType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cityId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sublocationId?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSqft?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxSqft?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  specialPurpose?: string;

  @IsOptional()
  @IsString()
  furnishingStatus?: string;

  @IsOptional()
  @IsString()
  roadName?: string;


  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  uploadedById?: number;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  uploadedFrom?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  uploadedTo?: string;
}
