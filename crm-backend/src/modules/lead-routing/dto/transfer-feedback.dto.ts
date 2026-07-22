import { IsString } from 'class-validator';

export class TransferFeedbackDto {
  @IsString()
  feedback: string;
}
