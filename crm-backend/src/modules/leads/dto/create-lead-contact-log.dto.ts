import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateLeadContactLogDto {
  @IsString()
  contact_type: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsInt()
  call_duration?: number;

  @IsOptional()
  @IsString()
  call_direction?: string;

  @IsOptional()
  @IsString()
  source_call_id?: string;
}
