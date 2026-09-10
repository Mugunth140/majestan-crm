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
  const results = await Promise.all(
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
      if (!res.ok) throw new Error("Failed to fetch from Google Places API");
      const data = await res.json();
      const places: NearbyPlace[] = ((data.places ?? []) as any[])
        .map((p) => {
          const plat = p.location?.latitude;
          const plng = p.location?.longitude;
          return {
            name: p.displayName?.text ?? "Unknown Place",
            distance: plat && plng ? `${haversineDistanceKm(lat, lng, plat, plng)} km` : "",
          };
        })
        .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
      return { title: cat.title, icon: cat.icon, places };
    })
  );
  return results.filter((c) => c.places.length > 0);
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
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.location,places.displayName",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ textQuery: query, pageSize: 5 }),
  });
  if (!res.ok) throw new Error("Failed to geocode locality with Google Places API");
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
}
