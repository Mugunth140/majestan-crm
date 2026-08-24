import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateLeadStatusDto {
  @IsOptional()
  @IsString()
  status_name?: string;

  @IsOptional()
  @IsBoolean()
  is_unqualified?: boolean;

  @IsOptional()
  @IsString()
  drop_reason?: string;
}
