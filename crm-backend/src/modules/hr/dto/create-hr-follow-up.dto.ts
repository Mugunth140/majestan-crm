import { IsString, IsOptional, IsDateString, IsInt } from 'class-validator';

export class CreateHrFollowUpDto {
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
  priority?: string;

  @IsOptional()
  @IsString()
  rnr?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
