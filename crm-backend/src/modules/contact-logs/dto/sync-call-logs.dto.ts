import { IsArray, ValidateNested, IsString, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class CallLogDto {
  @IsString()
  sourceCallId: string;

  @IsString()
  phoneNumber: string;

  @IsIn(['Incoming', 'Outgoing', 'Missed'])
  direction: string;

  @IsNumber()
  duration: number;

  @IsString()
  timestamp: string;
}

export class SyncCallLogsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallLogDto)
  logs: CallLogDto[];
}
