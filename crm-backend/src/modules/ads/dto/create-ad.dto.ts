import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

// Mirrors the site backend's AdPlacement enum, which owns per-placement rules
// (image ratios, mobile slot, audiences) and validates them on save.
export const AD_PLACEMENTS = ['hero', 'offers', 'mega_menu', 'listing_feed', 'announcement', 'popup'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export type AdLinkType = 'preset' | 'custom';

export class CreateAdDto {
  @IsOptional()
  @IsIn(AD_PLACEMENTS)
  placement?: AdPlacement;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(500)
  desktopImageKey!: string;

  // Optional or absent depending on the placement; null clears it on update.
  @ValidateIf((o) => o.mobileImageKey !== null)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mobileImageKey?: string | null;

  // Audience targeting (buy / rent / services / projects); null = all / fallback.
  @ValidateIf((o) => o.audience !== null)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  audience?: string | null;

  @IsOptional()
  @IsIn(['preset', 'custom'])
  linkType?: AdLinkType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  linkPreset?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkCustom?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
