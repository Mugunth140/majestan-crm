export const EMPTY_PROPERTY_FILTERS = {
  uploadedById: '', uploadedFrom: '', uploadedTo: '',
  propertyType: '', listingType: '', cityId: '', sublocationId: '',
  minSqft: '', maxSqft: '', minBudget: '', maxBudget: '',
  floor: '', specialPurpose: '', furnishingStatus: '', roadName: '',
};
export type PropertyFilters = typeof EMPTY_PROPERTY_FILTERS;

export function propertyUploaderLabel(property: {uploadedByName?: string | null; uploadedByCrmUserId?: number | null; source?: string; legacySourceId?: string | null}): string {
  if (property.uploadedByName) return property.uploadedByName;
  if (property.uploadedByCrmUserId) return `Staff #${property.uploadedByCrmUserId}`;
  if (property.source === 'owner-post') return 'Owner submission';
  if (property.legacySourceId) return 'Imported';
  return 'Not recorded';
}
