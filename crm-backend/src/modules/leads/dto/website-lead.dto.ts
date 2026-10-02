import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class WebsiteLeadDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MaxLength(32)
  mobile: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  propertyType?: string;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;

  // Property link + visit intent forwarded by the public website.
  // Must be declared here or the global whitelist ValidationPipe (main.ts)
  // strips them and the enquiry is saved with no property attached.
  // Lengths mirror the LeadInquiry columns added in migration 024:
  // property_code varchar(64), property_slug varchar(512).
  @IsOptional()
  @IsInt()
  @Min(1)
  propertyId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  propertyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  propertySlug?: string;

  @IsOptional()
  @IsIn(['enquiry', 'site_visit'])
  intent?: string;

  // Calendar date, exactly 'YYYY-MM-DD'. The site normalises to this shape
  // before forwarding, but @IsDateString() alone also accepts a full ISO
  // datetime ('2026-10-05T10:00:00Z'), which MySQL 8 strict mode rejects for a
  // DATE column. The site forward is fire-and-forget, so that insert failure
  // would lose the lead silently — pin the format at this boundary too.
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  visitDate?: string;

  // HH:MM shape only. Slot membership is enforced by the site service, so a
  // strict allow-list here would be redundant.
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  visitSlot?: string;
}
