// Unavailable is retained only for internal review records from older clients.
export function propertyStatusValue(status: string | undefined, approvalStatus?: string) {
  return status === 'unavailable' && approvalStatus === 'Approved' ? 'archived' : status || 'available';
}
export function propertyStatusLabel(status: string | undefined, approvalStatus?: string) {
  if (status === 'unavailable') return approvalStatus === 'Approved' ? 'Archived' : 'Pending review';
  return status || 'available';
}
