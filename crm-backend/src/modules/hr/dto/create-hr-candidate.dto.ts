import { Type } from "class-transformer";
import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
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

  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  interviewDate?: Date;

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
