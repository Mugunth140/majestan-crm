import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AssignLeadDto {
  @IsNumber()
  to_user_id: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}
