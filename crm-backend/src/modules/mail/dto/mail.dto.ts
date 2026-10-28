import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

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

/** Subject + body with {{variables}}; the body is cleaned to email-safe HTML on save. */
export class TemplateTextDto {
  @IsString() @MaxLength(500) subject: string;
  @IsString() @MaxLength(200_000) body: string;
}

export class TemplatePreviewDto extends TemplateTextDto {
  @IsString() @MaxLength(50) entityType: string;
  /** Mailbox the template is written for (default: the record type's own). */
  @IsOptional() @IsString() @MaxLength(50) sender?: string;
}

export class SavedTemplateDto extends TemplatePreviewDto {
  @IsString() @MaxLength(150) name: string;
  @IsOptional() @Type(() => Boolean) isActive?: boolean;
}

/** A message written or edited in the composer (subject/body may use {{variables}}). */
export class ComposeDto {
  @IsString() @MaxLength(50) entityType: string;
  @Type(() => Number) @IsInt() @Min(1) entityId: number;
  @IsString() @MaxLength(500) subject: string;
  @IsString() @MaxLength(400_000) body: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsEmail({}, { each: true }) cc?: string[];
  @IsOptional() @IsString() @MaxLength(100) eventKey?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) draftId?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsInt({ each: true }) attachmentIds?: number[];
  @IsOptional() @IsString() @MaxLength(50) sender?: string;
}

export class ComposeSendDto extends ComposeDto {
  @IsString() @Matches(/^[a-f0-9]{32}$/) hash: string;
}
