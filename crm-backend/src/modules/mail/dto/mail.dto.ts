import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class PreviewMailDto {
  @IsString() @MaxLength(100) event: string;
  @Type(() => Number) @IsInt() @Min(1) entityId: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class SendMailDto extends PreviewMailDto {
  @IsOptional() @IsString() @Matches(/^[a-f0-9]{32}$/) hash?: string;
}

export class DraftActionDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsString() @Matches(/^[a-f0-9]{32}$/) hash?: string;
}

export class SuppressionDto {
  @IsEmail() @MaxLength(255) email: string;
  @IsIn(['opt_out', 'hard_bounce', 'complaint', 'manual']) reason: 'opt_out' | 'hard_bounce' | 'complaint' | 'manual';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
