import { IsIn, IsString } from 'class-validator';

export class ConvertLeadDto {
  @IsIn(['inbound', 'agent'])
  convert_to: 'inbound' | 'agent';

  @IsString()
  feedback: string;
}
