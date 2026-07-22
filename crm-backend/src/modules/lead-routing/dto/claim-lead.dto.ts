import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ClaimLeadDto {
  @IsOptional()
  @IsString()
  feedback?: string;
}
