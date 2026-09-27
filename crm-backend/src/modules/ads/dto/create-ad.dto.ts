import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export type AdPlacement = 'hero' | 'listing_feed' | 'announcement' | 'popup';
export type AdLinkType = 'preset' | 'custom';

export class CreateAdDto {
  @IsOptional()
  @IsIn(['hero', 'listing_feed', 'announcement', 'popup'])
  placement?: AdPlacement;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(500)
  desktopImageKey!: string;

  @IsString()
  @MaxLength(500)
  mobileImageKey!: string;

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
