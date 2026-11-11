export const EMPTY_PROPERTY_FILTERS = {
  uploadedById: '', uploadedFrom: '', uploadedTo: '',
  propertyType: '', listingType: '', cityId: '', sublocationId: '',
  minSqft: '', maxSqft: '', minBudget: '', maxBudget: '',
  floor: '', specialPurpose: '', furnishingStatus: '', roadName: '',
  /** On the Available tab: '' = all three, else listed (still open), sold or rented. */
  listingStatus: '',
  // More filters
  bedrooms: '', bathrooms: '', facing: '', possessionStatus: '', occupancy: '', negotiable: '', parking: '',
};

const count = (n: number, plus: boolean) => ({ label: plus ? `${n}+` : String(n), value: plus ? `${n}+` : String(n) });
const facings = ['East', 'West', 'North', 'South', 'North East', 'North West', 'South East', 'South West'];

/** The less used filters, shown together under "More filters". */
export const MORE_PROPERTY_FILTERS = [
  { key: 'bedrooms', label: 'BHK', options: [1, 2, 3, 4, 5].map((n) => count(n, n === 5)) },
  { key: 'bathrooms', label: 'Bathrooms', options: [1, 2, 3, 4].map((n) => count(n, n === 4)) },
  { key: 'facing', label: 'Facing', options: facings.map((v) => ({ label: v, value: v })) },
  { key: 'possessionStatus', label: 'Possession', options: ['Ready To Move', 'Under Construction'].map((v) => ({ label: v, value: v })) },
  { key: 'occupancy', label: 'Occupancy', options: [{ label: 'Tenant occupied', value: 'tenant' }, { label: 'Not tenant occupied', value: 'vacant' }, { label: 'Owner occupied', value: 'owner' }] },
  { key: 'negotiable', label: 'Price negotiable', options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] },
  { key: 'parking', label: 'Parking', options: [{ label: 'Car parking', value: 'car' }, { label: 'Bike parking', value: 'bike' }] },
] as const;

export const LISTING_STATUS_OPTIONS = [
  { label: 'Available', value: 'listed' },
  { label: 'Sold', value: 'sold' },
  { label: 'Rented', value: 'rented' },
];
export type PropertyFilters = typeof EMPTY_PROPERTY_FILTERS;

export function propertyUploaderLabel(property: {uploadedByName?: string | null; uploadedByCrmUserId?: number | null; source?: string; legacySourceId?: string | null}): string {
  if (property.uploadedByName) return property.uploadedByName;
  if (property.uploadedByCrmUserId) return `Staff #${property.uploadedByCrmUserId}`;
  if (property.source === 'owner-post') return 'Owner submission';
  if (property.legacySourceId) return 'Imported';
  return 'Not recorded';
}
