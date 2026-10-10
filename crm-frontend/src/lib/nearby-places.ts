export interface NearbyPlace {
  name: string;
  distance: string;
}

export interface LocalityCategory {
  title: string;
  icon: string;
  places: NearbyPlace[];
}

export const CATEGORY_MAP = [
  { id: "education", types: ["school", "university"], title: "Education", icon: "graduation-cap" },
  { id: "healthcare", types: ["hospital", "pharmacy"], title: "Healthcare", icon: "stethoscope" },
  { id: "shopping", types: ["shopping_mall", "supermarket"], title: "Shopping", icon: "shopping-bag" },
  { id: "transport", types: ["bus_station", "train_station", "transit_station"], title: "Transport", icon: "bus" },
  { id: "entertainment", types: ["movie_theater", "park"], title: "Entertainment", icon: "film" },
  { id: "banking", types: ["bank", "atm"], title: "Banking", icon: "landmark" },
];

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

export async function fetchNearbyCategories(
  lat: number,
  lng: number,
  apiKey: string
): Promise<LocalityCategory[]> {
  // One failing category (bad type, quota, transient) must not wipe out the
  // rest — settle each independently and only throw when ALL failed.
  const settled = await Promise.allSettled(
    CATEGORY_MAP.map(async (cat) => {
      const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.displayName,places.location",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          includedTypes: cat.types,
          maxResultCount: 4,
          locationRestriction: {
            circle: { center: { latitude: lat, longitude: lng }, radius: 3000 },
          },
        }),
      });
      if (!res.ok) throw await toGoogleError(res, "Google Places search failed");
      const data = await res.json();
      const places: NearbyPlace[] = ((data.places ?? []) as any[])
        .map((p) => {
          const plat = p.location?.latitude;
          const plng = p.location?.longitude;
          return {
            name: p.displayName?.text ?? "Unknown Place",
            distance:
              typeof plat === "number" && typeof plng === "number"
                ? `${haversineDistanceKm(lat, lng, plat, plng)} km`
                : "",
            _km:
              typeof plat === "number" && typeof plng === "number"
                ? Number(haversineDistanceKm(lat, lng, plat, plng))
                : Number.POSITIVE_INFINITY,
          };
        })
        .sort((a, b) => a._km - b._km)
        .map(({ name, distance }) => ({ name, distance }));
      return { title: cat.title, icon: cat.icon, places };
    })
  );
  const ok = settled
    .filter((r): r is PromiseFulfilledResult<LocalityCategory> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((c) => c.places.length > 0);
  if (ok.length > 0) return ok;
  const firstError = settled.find((r) => r.status === "rejected") as
    | PromiseRejectedResult
    | undefined;
  throw firstError?.reason instanceof Error
    ? firstError.reason
    : new Error("Google Places search failed for all categories");
}

/** Reads Google's JSON error body so toasts show the real cause (e.g. API
 *  not enabled, bad key, referrer blocked) instead of a generic message. */
async function toGoogleError(res: Response, fallback: string): Promise<Error> {
  try {
    const data = (await res.json()) as { error?: { message?: string; status?: string } };
    const detail = data?.error?.message || data?.error?.status;
    return new Error(detail ? `${fallback} (${res.status}: ${detail})` : `${fallback} (${res.status})`);
  } catch {
    return new Error(`${fallback} (${res.status})`);
  }
}

/**
 * Reverse-geocode coordinates to a postal code via the Geocoding API.
 * Returns null when no postal component exists; throws on request failure
 * so callers can fall back (e.g. to the locality pincode).
 */
export async function fetchPostalCode(
  lat: number,
  lng: number,
  apiKey: string
): Promise<string | null> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(apiKey)}`
  );
  if (!res.ok) throw await toGoogleError(res, "Reverse-geocode failed");
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: { address_components?: { long_name?: string; types?: string[] }[] }[];
  };
  // The legacy Geocoding API returns 200 with an error status for key/quota
  // problems (REQUEST_DENIED, OVER_QUERY_LIMIT...) — treat those as failures
  // with Google's own message instead of silently returning null.
  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(
      `Reverse-geocode failed (${data.status}${data.error_message ? `: ${data.error_message}` : ""})`
    );
  }
  for (const r of data.results ?? []) {
    const comp = (r.address_components ?? []).find((c) => (c.types ?? []).includes("postal_code"));
    if (comp?.long_name) return comp.long_name.trim();
  }
  return null;
}

export interface ResolvedCenter {
  latitude: number;
  longitude: number;
  label: string;
}

export async function resolveCenterFromText(
  query: string,
  apiKey: string
): Promise<ResolvedCenter> {
  // Primary: Places API (New) text search. Falls back to the legacy
  // Geocoding API so auto-populate still works when the key only has one
  // of the two APIs enabled.
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.location,places.displayName",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ textQuery: query, pageSize: 5 }),
    });
    if (!res.ok) throw await toGoogleError(res, "Locality geocode failed");
    const data = await res.json();
    const first = ((data.places ?? []) as any[]).find(
      (p) => p.location?.latitude && p.location?.longitude
    );
    if (!first) throw new Error(`No location found for "${query}"`);
    return {
      latitude: first.location.latitude,
      longitude: first.location.longitude,
      label: first.displayName?.text ?? query,
    };
  } catch (primaryErr) {
    const fallback = await resolveCenterLegacy(query, apiKey).catch(() => null);
    if (fallback) return fallback;
    throw primaryErr instanceof Error
      ? primaryErr
      : new Error(`No location found for "${query}"`);
  }
}

async function resolveCenterLegacy(
  query: string,
  apiKey: string
): Promise<ResolvedCenter> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`
  );
  if (!res.ok) throw await toGoogleError(res, "Legacy geocode failed");
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: {
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }[];
  };
  if (data.status !== "OK") {
    throw new Error(
      `Legacy geocode failed (${data.status ?? "unknown"}${data.error_message ? `: ${data.error_message}` : ""})`
    );
  }
  const first = (data.results ?? []).find(
    (r) => typeof r.geometry?.location?.lat === "number" && typeof r.geometry?.location?.lng === "number"
  );
  if (!first?.geometry?.location) throw new Error(`No location found for "${query}"`);
  return {
    latitude: first.geometry.location.lat as number,
    longitude: first.geometry.location.lng as number,
    label: first.formatted_address ?? query,
  };
}
