export interface Coordinates {
  latitude: number;
  longitude: number;
}

function validCoordinates(value: Coordinates | undefined): value is Coordinates {
  return !!value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180;
}

/** GPS is optional: missing, malformed or unsupported metadata never blocks a photo. */
export async function readImageCoordinates(file: Blob): Promise<Coordinates | null> {
  try {
    const { gps } = await import("exifr");
    const coordinates = await gps(file);
    return validCoordinates(coordinates) ? coordinates : null;
  } catch {
    return null;
  }
}

/** Keep existing coordinate-bearing Maps links editable while old records migrate. */
export function readStoredCoordinates(data: {
  latitude?: number | string | null;
  longitude?: number | string | null;
  google_map_location?: string | null;
}): { latitude: string; longitude: string } {
  const legacy = data.google_map_location?.match(
    /(?:[?&](?:q|query)=|@)(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  );
  const latitude = data.latitude ?? legacy?.[1] ?? "";
  const longitude = data.longitude ?? legacy?.[2] ?? "";
  return { latitude: String(latitude), longitude: String(longitude) };
}
