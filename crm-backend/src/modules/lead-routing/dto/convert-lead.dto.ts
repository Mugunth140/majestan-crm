import { IsIn, IsOptional, IsString } from 'class-validator';

export class ConvertLeadDto {
  @IsIn(['inbound', 'agent'])
  convert_to: 'inbound' | 'agent';

  @IsOptional()
  @IsString()
  feedback?: string;
}
