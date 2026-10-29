export function matchesInboundSearch(record: Record<string, unknown>, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  const fields = [record.id, record.property_id, record.propertyId, record.property_type, record.propertyType, record.property_title, record.propertyTitle];
  if (fields.some(value => String(value ?? '').toLowerCase().includes(text))) return true;
  const digits = text.replace(/\D/g, '');
  return digits.length > 0 && [record.mobile_number, record.owner_mobile, record.alternate_contact, record.primary_contact_number, record.key_contact_number]
    .some(value => value && String(value).replace(/\D/g, '').includes(digits));
}
export function formatInboundCreated(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  const day = Number(get('day'));
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ({1:'st',2:'nd',3:'rd'}[day % 10] || 'th');
  return `${day}${suffix} ${get('month')} ${Number(get('hour'))}:${get('minute')} ${get('dayPeriod').toLowerCase()}`;
}
