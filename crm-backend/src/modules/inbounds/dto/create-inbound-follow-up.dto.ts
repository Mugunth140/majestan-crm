import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class CreateInboundFollowUpDto {
  @IsOptional()
  @IsDateString()
  follow_up_date?: string;

  @IsOptional()
  @IsString()
  follow_up_time?: string;

  @IsOptional()
  @IsString()
  contacted_via?: string;

  @IsOptional()
  @IsDateString()
  next_follow_up_date?: string;

  @IsOptional()
  @IsString()
  next_follow_up_time?: string;

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
  is_completed?: boolean;
}
