// ads-link-presets.ts
export const ADS_PLACEMENTS = [{ value: 'hero', label: 'Home hero' }] as const;

// Keys must match the preset keys the site resolves in Plan D (site owns templates).
export const ADS_LINK_PRESETS = [
  { value: 'buy-apartments', label: 'Buy — Apartments' },
  { value: 'buy-villas', label: 'Buy — Villas' },
  { value: 'buy-plots', label: 'Buy — Plots' },
  { value: 'buy-commercial', label: 'Buy — Commercial' },
  { value: 'rent', label: 'Rent — All' },
  { value: 'projects', label: 'Projects' },
  { value: 'contact', label: 'Contact' },
  { value: 'home', label: 'Homepage' },
  { value: 'custom', label: 'Custom path…' },
] as const;
