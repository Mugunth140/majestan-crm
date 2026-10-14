// ads-link-presets.ts
// Catalog of ad slots on the public site, driving the Advertisement editor:
// which image variants each slot takes, at what ratio, and which audiences an
// ad can target. Ratios/audiences mirror the site backend's
// src/modules/ads/ad-placement-specs.ts, which enforces them on save.

export type AdRatio = [number, number];

export interface AdImageSlot {
  ratio: AdRatio;
  /** Suggested pixel size shown as a hint. */
  example: string;
}

export interface AdPlacementOption {
  value: string;
  label: string;
  /** Where it shows on the site — shown under the placement picker. */
  description: string;
  desktop: AdImageSlot & { label: string };
  mobile?: AdImageSlot & { required: boolean };
  /** Empty = no targeting. An ad with no audience is the fallback. */
  audiences: readonly { value: string; label: string }[];
}

export const ADS_PLACEMENTS: readonly AdPlacementOption[] = [
  {
    value: 'hero',
    label: 'Home hero carousel',
    description: 'Full-width carousel at the top of the home page.',
    desktop: { label: 'Desktop image', ratio: [32, 9], example: '1920×540' },
    mobile: { ratio: [4, 5], example: '1080×1350', required: true },
    audiences: [],
  },
  {
    value: 'offers',
    label: 'Home — Exclusive Offers',
    description: 'The "Exclusive Offers and Highlights" carousel on the home page.',
    desktop: { label: 'Desktop image', ratio: [4, 1], example: '1920×480' },
    mobile: { ratio: [4, 5], example: '1080×1350', required: false },
    audiences: [],
  },
  {
    value: 'mega_menu',
    label: 'Navigation menu',
    description:
      'Image beside the links when hovering Buy / Rent / Services in the header. Pick an audience per menu; an "All" ad is the fallback for menus without their own.',
    desktop: { label: 'Image', ratio: [3, 2], example: '900×600' },
    audiences: [
      { value: 'buy', label: 'Buy menu' },
      { value: 'rent', label: 'Rent menu' },
      { value: 'services', label: 'Services menu' },
    ],
  },
  {
    value: 'listing_feed',
    label: 'Listing pages',
    description:
      'Banners between property / project cards on the listing pages. Target Buy, Rent or Projects listings; an "All" ad fills in where none is targeted.',
    desktop: { label: 'Desktop image', ratio: [4, 1], example: '1600×400' },
    mobile: { ratio: [16, 9], example: '1080×608', required: false },
    audiences: [
      { value: 'buy', label: 'Buy listings' },
      { value: 'rent', label: 'Rent listings' },
      { value: 'projects', label: 'Project listings' },
    ],
  },
];

export function getPlacement(value: string | null | undefined): AdPlacementOption {
  return ADS_PLACEMENTS.find((p) => p.value === value) ?? ADS_PLACEMENTS[0];
}

export const ratioLabel = ([w, h]: AdRatio) => `${w}:${h}`;

// Keys must match ADS_LINK_TEMPLATES in the site (site owns the URL templates).
export const ADS_LINK_PRESETS = [
  { value: 'buy-apartments', label: 'Buy — Apartments' },
  { value: 'buy-villas', label: 'Buy — Villas' },
  { value: 'buy-independent-houses', label: 'Buy — Independent Houses' },
  { value: 'buy-plots', label: 'Buy — Plots' },
  { value: 'buy-farmlands', label: 'Buy — Farmlands' },
  { value: 'buy-commercial', label: 'Buy — Commercial' },
  { value: 'buy-industrial', label: 'Buy — Industrial' },
  { value: 'rent', label: 'Rent — All' },
  { value: 'rent-apartments', label: 'Rent — Apartments' },
  { value: 'rent-villas', label: 'Rent — Villas' },
  { value: 'rent-independent-houses', label: 'Rent — Independent Houses' },
  { value: 'rent-commercial', label: 'Rent — Commercial' },
  { value: 'rent-industrial', label: 'Rent — Industrial' },
  { value: 'rent-coworking', label: 'Rent — Co-Working' },
  { value: 'projects', label: 'Projects' },
  { value: 'services-property-management', label: 'Service — Property Management' },
  { value: 'services-liaisoning', label: 'Service — Liaisoning' },
  { value: 'services-brokerage', label: 'Service — Brokerage' },
  { value: 'services-financial', label: 'Service — Financial Assistance' },
  { value: 'services-nri', label: 'Service — NRI Services' },
  { value: 'post-property', label: 'Post Property' },
  { value: 'contact', label: 'Contact' },
  { value: 'home', label: 'Homepage' },
  { value: 'custom', label: 'Custom path…' },
] as const;
