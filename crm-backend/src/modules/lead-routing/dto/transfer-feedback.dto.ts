import { IsOptional, IsString } from 'class-validator';

export class TransferFeedbackDto {
  @IsOptional()
  @IsString()
  feedback?: string;
}
