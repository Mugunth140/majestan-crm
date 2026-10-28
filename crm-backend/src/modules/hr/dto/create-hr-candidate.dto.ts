import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HrCandidateStatus } from '../../../database/entities/hr-candidate.entity';

export class CreateHrCandidateDto {
  @IsString()
  name: string;

  @IsString()
  mobile: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  cityId?: number | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  hrSourceId?: number | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  assignedStaffId?: number | null;

  @IsString()
  department: string;

  @IsString()
  position: string;

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsString()
  currentSalary?: string;

  @IsOptional()
  @IsString()
  expectedSalary?: string;

  @IsOptional()
  @IsString()
  noticePeriod?: string;

  @IsOptional()
  @IsString()
  recruitmentSource?: string;

  // Plain ISO string ("YYYY-MM-DD") — converted to Date in HrService.
  // (A @Type(() => Date) here would turn the value into a Date object
  // before validation, which @IsDateString then rejects.)
  @IsOptional()
  @IsDateString()
  interviewDate?: string;

  @IsOptional()
  @IsString()
  interviewer?: string;

  @IsOptional()
  @IsString()
  interviewRound?: string;

  @IsOptional()
  @IsString()
  interviewFeedback?: string;

  @IsOptional()
  @IsEnum(HrCandidateStatus)
  status?: HrCandidateStatus;
}
