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

  /** Changes some preference keys and keeps the rest; a null value removes that key. */
  @IsOptional()
  @IsObject()
  preferencesPatch?: Record<string, unknown>;

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

  // camelCase keys are what the service reads and the frontend sends. Without
  // them the whitelist ValidationPipe strips the payload and only preferences save.
  @IsOptional() @IsString() project?: string | null;
  @IsOptional() @IsString() purchaseType?: string | null;
  @IsOptional() @IsString() propertyType?: string | null;
  @IsOptional() @IsString() propertyCategory?: string | null;
  @IsOptional() @IsInt() cityId?: number | null;
  @IsOptional() @IsArray() @IsString({ each: true }) subLocations?: string[] | null;
  @IsOptional() @IsString() purchaseTimeline?: string | null;
  @IsOptional() @IsString() qualificationPurpose?: string | null;
  @IsOptional() @IsString() decisionMaker?: string | null;
}
