/** Blank optional coordinates remain blank; never guess or clamp a location. */
export function coordinateErrors(latitude: string, longitude: string): { field: string; message: string }[] {
  return ([['latitude', latitude, 90], ['longitude', longitude, 180]] as const).flatMap(([field, value, limit]) => {
    if (!value.trim()) return [];
    const number = Number(value);
    if (Number.isFinite(number) && Math.abs(number) <= limit) return [];
    const label = field === 'latitude' ? 'Latitude' : 'Longitude';
    return [{ field, message: `${label} must be a decimal number between -${limit} and ${limit}.` }];
  });
}
