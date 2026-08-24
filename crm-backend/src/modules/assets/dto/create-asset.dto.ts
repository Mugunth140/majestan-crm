import { IsString, IsOptional, IsInt, IsArray, IsObject, ValidateNested } from 'class-validator';

export class CreateAssetDto {
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
