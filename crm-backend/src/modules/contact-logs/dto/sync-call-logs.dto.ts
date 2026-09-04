import { IsArray, ArrayMaxSize, ValidateNested, IsString, IsNumber, IsIn, IsInt, Min, Max, IsISO8601, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

class CallLogDto {
  @IsString()
  @MaxLength(255)
  sourceCallId: string;

  @IsString()
  @MaxLength(32)
  phoneNumber: string;

  @IsIn(['Incoming', 'Outgoing', 'Missed'])
  direction: string;

  @IsInt()
  @Min(0)
  @Max(86400)
  duration: number;

  @IsISO8601()
  timestamp: string;
}

export class SyncCallLogsDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CallLogDto)
  logs: CallLogDto[];
}
