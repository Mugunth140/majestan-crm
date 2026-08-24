import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class CallLogDto {
  @IsString()
  number: string;

  @IsString()
  type: string;

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
