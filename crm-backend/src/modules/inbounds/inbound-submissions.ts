import { gps } from 'exifr';

/** Match common Indian country/trunk prefixes and ignore presentation formatting. */
export function normalizeInboundMobile(value: string | null | undefined): string {
  let digits = (value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/** The first surviving inbound is New; later matches are Repeat, not confirmed duplicates. */
export function submissionStatuses(records: { id: number; mobile_number?: string | null }[]) {
  const first = new Map<string, number>();
  for (const record of records) {
    const mobile = normalizeInboundMobile(record.mobile_number);
    if (mobile && (!first.has(mobile) || record.id < first.get(mobile)!)) first.set(mobile, record.id);
  }
  return new Map(records.map(record => {
    const mobile = normalizeInboundMobile(record.mobile_number);
    return [record.id, mobile && first.get(mobile) !== record.id ? 'Repeat' : 'New'] as const;
  }));
}

export async function readInboundPhotoCoordinates(buffer: Buffer): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const result = await gps(buffer);
    if (result && Number.isFinite(result.latitude) && Number.isFinite(result.longitude)
      && Math.abs(result.latitude) <= 90 && Math.abs(result.longitude) <= 180) return result;
  } catch {
    // Missing, malformed and unsupported GPS metadata must not block uploads.
  }
  return null;
}
