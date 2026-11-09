import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsObject,
  ValidateNested,
  IsIn,
} from 'class-validator';

export const ASSET_STATUSES = [
  'New',
  'Pending',
  'Approved',
  'Available',
  'Sold',
  'Rejected',
] as const;

export class CreateAssetDto {
  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  owner_name?: string;

  @IsOptional()
  @IsString()
  mobile_number?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  mediator_name?: string;

  @IsOptional()
  @IsString()
  cp_reference_name?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  // The site visit. Empty clears a value.
  @IsOptional()
  @IsString()
  visited_date?: string | null;

  @IsOptional()
  @IsString()
  site_visited_done?: string | null;

  @IsOptional()
  @IsString()
  checked_by?: string | null;

  @IsOptional()
  @IsString()
  approved_by?: string | null;

  @IsOptional()
  @IsObject()
  location?: any;

  @IsOptional()
  @IsObject()
  financials?: any;

  @IsOptional()
  @IsObject()
  features?: any;

  @IsOptional()
  @IsArray()
  layouts?: any[];

  @IsOptional()
  @IsInt()
  assigned_staff_id?: number;
}
