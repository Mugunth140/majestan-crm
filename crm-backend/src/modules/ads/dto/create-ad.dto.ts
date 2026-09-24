export type AdPlacement = 'hero' | 'listing_feed' | 'announcement' | 'popup';
export type AdLinkType = 'preset' | 'custom';

export class CreateAdDto {
  placement?: AdPlacement;
  title!: string;
  desktopImageKey!: string;
  mobileImageKey!: string;
  linkType?: AdLinkType;
  linkPreset?: string;
  linkCustom?: string;
  sortOrder?: number;
  isActive?: boolean;
}
