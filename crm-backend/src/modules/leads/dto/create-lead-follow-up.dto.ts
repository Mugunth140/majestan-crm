import { IsString, IsOptional, IsDateString, IsBoolean, IsNumber, ValidateIf } from 'class-validator';

// The lead page sends "" for an unset date; treat it like a missing one.
const unlessBlank = ValidateIf((_, v) => v !== '' && v !== null && v !== undefined);

export class CreateLeadFollowUpDto {
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

  @IsOptional()
  @IsNumber()
  createdById?: number;
}
