import { IsString, IsOptional, IsInt, IsArray, IsObject } from 'class-validator';

export class UpdateLeadInquiryDto {
  @IsOptional()
  @IsString()
  project_list?: string;

  @IsOptional()
  @IsString()
  purchase_type?: string;

  @IsOptional()
  @IsString()
  property_type?: string;

  @IsOptional()
  @IsString()
  property_category?: string;

  @IsOptional()
  @IsString()
  funder?: string;

  @IsOptional()
  @IsObject()
  preferences?: any;

  @IsOptional()
  @IsInt()
  city_id?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sub_locations?: string[];

  @IsOptional()
  @IsString()
  purchase_timeline?: string;

  @IsOptional()
  @IsString()
  qualification_purpose?: string;

  @IsOptional()
  @IsString()
  decision_maker?: string;
}
