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
