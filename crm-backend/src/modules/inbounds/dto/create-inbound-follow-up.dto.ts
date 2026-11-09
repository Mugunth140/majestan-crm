import { IsString, IsOptional, IsDateString, IsBoolean, ValidateIf } from 'class-validator';

// camelCase, as every page sends it and the service reads it. (The old
// snake_case fields were stripped by the whitelist pipe, dropping how the owner
// was contacted and every date.) "" counts as an unset date.
const unlessBlank = ValidateIf((_, v) => v !== '' && v !== null && v !== undefined);

export class CreateInboundFollowUpDto {
  @unlessBlank
  @IsDateString()
  followUpDate?: string;

  @IsOptional()
  @IsString()
  followUpTime?: string;

  @IsOptional()
  @IsString()
  contactedVia?: string;

  @unlessBlank
  @IsDateString()
  nextFollowUpDate?: string;

  @IsOptional()
  @IsString()
  nextFollowUpTime?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  rnr?: string;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
