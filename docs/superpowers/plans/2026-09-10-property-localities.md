# Property Localities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Description card after Basic Info and add Google-Places nearby auto-populate to the CRM property form, mirroring the site wizard exactly.

**Architecture:** Pure frontend change in `crm-frontend`. New pure helper module `src/lib/nearby-places.ts` holds the category map, Haversine helper, and fetch function; `PropertyForm.tsx` gains a `categories` state, an auto-populate button, and merges categories into `locationData.localityData` on submit.

**Tech Stack:** Next.js 16, React 19, Places API v1 `searchNearby`, sonner toasts, lucide-react icons.

## Global Constraints

- No backend changes (CRM or site).
- Exact mirror of `site/majestan-frontend/src/components/admin/property-wizard/steps/Step4Localities.tsx`: same 6 categories, 3 km radius, max 4 results, field mask `places.displayName,places.location`, Haversine, nearest-first, drop empty categories.
- `connectivity` stays manual-only.
- No `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` committed to the repo; set it in deployment env.
- Verify with `npx tsc --noEmit` and `npm run lint` from `crm/crm-frontend`.

---

### Task 1: Move Description card after Basic Info

**Files:**
- Modify: `crm/crm-frontend/src/app/(dashboard)/properties/_components/PropertyForm.tsx:3459-3469` (cut block), paste after Basic Info card close (~L1094, before `{/* ---- Pricing ---- */}` at L1097)

**Interfaces:**
- Consumes: existing `description` state (L343) — unchanged.
- Produces: new card order Basic Info → Description → Pricing.

- [ ] **Step 1: Cut the Description block**

Remove this exact block (L3459-3469):

```tsx
        {/* ---- Description ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Description</h3>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the property, key features, surroundings, etc."
            rows={5}
            className="rounded-xl bg-muted/30 resize-none"
          />
        </div>

```

- [ ] **Step 2: Paste it after the Basic Info card**

Insert the same block immediately before `{/* ---- Pricing ---- */}` (L1097), i.e. after the closing `</div>` of the Basic Info card. Do not touch `description` state or the submit payload.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` from `crm/crm-frontend`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint -- --file "src/app/(dashboard)/properties/_components/PropertyForm.tsx"` from `crm/crm-frontend`
Expected: no new warnings/errors.

---

### Task 2: Create nearby-places helper module

**Files:**
- Create: `crm/crm-frontend/src/lib/nearby-places.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `CATEGORY_MAP`, `haversineDistanceKm`, `fetchNearbyCategories`, types `NearbyPlace`, `LocalityCategory` — used by Task 3.

- [ ] **Step 1: Create the module**

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` from `crm/crm-frontend`
Expected: no errors.

---

### Task 3: Wire auto-populate into PropertyForm

**Files:**
- Modify: `crm/crm-frontend/src/app/(dashboard)/properties/_components/PropertyForm.tsx`
  - imports (~L34-41, add `MapPin` to lucide imports; add `import { fetchNearbyCategories, type LocalityCategory } from "@/lib/nearby-places";`)
  - state (~L198, after `connectivity` state)
  - submit payload (L557-566)
  - Connectivity card (L3270-3342)

**Interfaces:**
- Consumes: `fetchNearbyCategories`, `LocalityCategory` from Task 2; existing `latitude`/`longitude` states.
- Produces: `localityData: { categories, connectivity }` in submit payload.

- [ ] **Step 1: Add imports and state**

Add `MapPin` to the lucide-react import at L34-41. Add after the L14 `propertiesApi` import:

```tsx
import { fetchNearbyCategories, type LocalityCategory } from "@/lib/nearby-places";
```

Add after L198 (`connectivity` state):

```tsx
const [categories, setCategories] = useState<LocalityCategory[]>(loc0?.localityData?.categories ?? []);
const [isFetchingPlaces, setIsFetchingPlaces] = useState(false);
```

Add this handler next to `handleCityChange` (~L443):

```tsx
const handleAutoPopulatePlaces = async () => {
  if (!latitude.trim() || !longitude.trim()) {
    toast.error("Latitude and longitude are required. Please set them in Location above.");
    return;
  }
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    toast.error("Google Maps API key is missing. Please configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
    return;
  }
  setIsFetchingPlaces(true);
  try {
    const filled = await fetchNearbyCategories(Number(latitude), Number(longitude), apiKey);
    setCategories(filled);
    toast.success("Nearby places successfully populated from Google Maps!");
  } catch {
    toast.error("Failed to fetch nearby places. Check your API Key permissions.");
  } finally {
    setIsFetchingPlaces(false);
  }
};
```

- [ ] **Step 2: Include categories in submit payload**

Replace L557-566 with:

```tsx
        // Location
        locationData:
          address.trim() || latitude.trim() || longitude.trim() || pincode.trim() || connectivity.length > 0 || categories.length > 0
            ? {
                address: address.trim() || undefined,
                pincode: pincode.trim() || undefined,
                latitude: latitude.trim() ? parseFloat(latitude) : undefined,
                longitude: longitude.trim() ? parseFloat(longitude) : undefined,
                localityData: connectivity.length > 0 || categories.length > 0 ? { categories: categories.length > 0 ? categories : undefined, connectivity: connectivity.length > 0 ? connectivity.filter((c) => c.label || c.detail) : undefined } : undefined,
              }
            : undefined,
```

- [ ] **Step 3: Add button + read-only category cards**

Inside the "Connectivity & Localities" card (L3271-3272), insert after the `<h3>` line and before `<div className="space-y-4">` (L3273):

```tsx
          {latitude.trim() && longitude.trim() ? (
            <Button
              type="button"
              onClick={handleAutoPopulatePlaces}
              disabled={isFetchingPlaces}
              className="mb-6 bg-[#0052FF] text-white hover:bg-[#0052FF]/90"
            >
              {isFetchingPlaces ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
              {isFetchingPlaces ? "Fetching from Google Places..." : "Auto-Populate Nearby Places"}
            </Button>
          ) : (
            <p className="mb-6 text-sm text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              Set latitude and longitude in Location above to auto-fetch nearby places.
            </p>
          )}
          {categories.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {categories.map((cat, idx) => (
                <div key={idx} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <h5 className="font-semibold text-sm mb-3">{cat.title}</h5>
                  <ul className="space-y-2">
                    {cat.places.map((p, pIdx) => (
                      <li key={pIdx} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-muted-foreground" title={p.name}>{p.name}</span>
                        <span className="text-[11px] font-medium px-2 py-1 rounded-md border border-border/60 whitespace-nowrap">{p.distance}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
```

`Loader2`, `Button` are already imported; `MapPin` added in Step 1.

- [ ] **Step 4: Typecheck + lint**

Run from `crm/crm-frontend`: `npx tsc --noEmit` (expect no errors), then `npm run lint -- --file "src/lib/nearby-places.ts" --file "src/app/(dashboard)/properties/_components/PropertyForm.tsx"` (expect no new issues).

- [ ] **Step 5: Manual verification**

1. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in the CRM frontend env, restart dev server.
2. Open `/properties/new`: Description sits after Basic Info. In Location enter lat/lng → Connectivity section shows the auto-populate button → click → 6 category cards fill in.
3. Save → property persists; reopen edit → categories prefilled.
4. Edit an existing property with saved `localityData.categories` → cards render without re-fetch.
5. Clear lat/lng → hint text shows instead of button.
