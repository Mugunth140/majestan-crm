import { IsString, IsOptional, IsInt, IsBoolean, IsNumber, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class InboundUnitDto {
  @IsString()
  @MaxLength(100)
  floor_label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Mirrors the Inbound entity columns actually sent by the inbound form
 * (crm-frontend/src/app/(dashboard)/inbound/new/page.tsx).
 *
 * Everything is optional: the form sends `null` for untouched controlled
 * selects, and required-ness is enforced by the frontend. Making anything
 * strictly required here reintroduces 400s on legitimate payloads.
 */
export class CreateInboundDto {
  // ── Basic / property ──────────────────────────────────────────────
  @IsOptional()
  @IsString()
  property_category?: string;

  @IsOptional()
  @IsString()
  property_type?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  bhk?: string;

  @IsOptional()
  @IsString()
  special_purpose?: string;

  @IsOptional()
  @IsString()
  budget_details?: string;

  @IsOptional()
  @IsNumber()
  total_rent?: number;

  // Free-text ("5 Lakhs") for Sale/Lease, months-as-number for Rent.
  // Normalized to string here because the column is varchar.
  @IsOptional()
  @Transform(({ value }) => (value == null || value === '' ? undefined : String(value)))
  @IsString()
  advance?: string;

  @IsOptional()
  @IsNumber()
  rent_per_sqft?: number;

  @IsOptional()
  @IsString()
  floor_number?: string;

  @IsOptional()
  @IsString()
  property_title?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  locality?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsOptional()
  @IsString()
  google_map_location?: string;

  @IsOptional()
  @IsString()
  status?: string;

  // ── Owner ─────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  owner_name?: string;

  @IsOptional()
  @IsString()
  mobile_number?: string;

  @IsOptional()
  @IsString()
  whatsapp_number?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  preferred_contact_time?: string;

  @IsOptional()
  @IsString()
  alternate_contact?: string;

  @IsOptional()
  @IsBoolean()
  pan_available?: boolean;

  @IsOptional()
  @IsBoolean()
  gst_applicable?: boolean;

  // ── Contact / key ─────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  primary_contact?: string;

  @IsOptional()
  @IsString()
  primary_contact_name?: string;

  @IsOptional()
  @IsString()
  primary_contact_number?: string;

  @IsOptional()
  @IsString()
  key_contact_name?: string;

  @IsOptional()
  @IsString()
  key_contact_number?: string;

  @IsOptional()
  @IsString()
  building_manager_name?: string;

  @IsOptional()
  @IsString()
  manager_mobile?: string;

  @IsOptional()
  @IsString()
  caretaker_name?: string;

  @IsOptional()
  @IsString()
  caretaker_mobile?: string;

  @IsOptional()
  @IsString()
  security_name?: string;

  @IsOptional()
  @IsString()
  security_contact?: string;

  @IsOptional()
  @IsString()
  broker_name?: string;

  @IsOptional()
  @IsString()
  broker_mobile?: string;

  @IsOptional()
  @IsString()
  key_available_with?: string;

  @IsOptional()
  @IsBoolean()
  prior_appointment_required?: boolean;

  // ── Brokerage ─────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  brokerage_accepted?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brokerage_paid_by?: string[];

  @IsOptional()
  @IsString()
  brokerage_type?: string;

  @IsOptional()
  @IsNumber()
  percentage?: number;

  @IsOptional()
  @IsNumber()
  fixed_amount?: number;

  @IsOptional()
  @IsString()
  rental_brokerage?: string;

  @IsOptional()
  @IsNumber()
  brokerage_days?: number;

  @IsOptional()
  @IsString()
  brokerage_remarks?: string;

  // ── Media / flags ─────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  video_url?: string;

  @IsOptional()
  @IsBoolean()
  documents_collected?: boolean;

  @IsOptional()
  @IsBoolean()
  is_exclusive?: boolean;

  @IsOptional()
  @IsBoolean()
  is_prime_location?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  listed_on?: string[];

  @IsOptional()
  @IsString()
  source?: string;

  // Set server-side for Staff role from the JWT identity, which may arrive
  // as a string — hence the coercion (previously a bare @IsInt 400'd Staff).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigned_staff_id?: number;

  // Per-floor area + pricing rows (commercial). Optional; empty rows are
  // dropped server-side. Single-floor entries keep using the flat fields.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboundUnitDto)
  units?: InboundUnitDto[];
}
