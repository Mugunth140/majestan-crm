# Property Form: Description Move + Nearby-Places Auto-Populate

Date: 2026-09-10
Scope: `crm-frontend` PropertyForm (add + edit). No backend changes.

## 1. Description move

Move the Description card (`PropertyForm.tsx` ~L3459) to directly after the
Basic Info card (~L866), before Pricing. Pure JSX reorder; `description`
state, payload (`description`), and validation untouched.

Order becomes: Basic Info → Description → Pricing → Location → Details → …

## 2. Nearby-places auto-populate (mirror of site wizard Step4Localities)

### Source of truth
`site/majestan-frontend/src/components/admin/property-wizard/steps/Step4Localities.tsx`
replicated exactly: Places API v1 `POST places:searchNearby`, 3 km radius,
`maxResultCount: 4`, field mask `places.displayName,places.location`,
Haversine distance, nearest-first sort, empty categories dropped.

### Categories (identical to site)
Education (`school|university`), Healthcare (`hospital|pharmacy`), Shopping
(`shopping_mall|supermarket`), Transport
(`bus_station|train_station|transit_station`), Entertainment
(`movie_theater|park`), Banking (`bank|atm`).

### Data shape (identical to site wizard schema)
`localityData: { categories: [{ title, icon, places: [{ name, distance }] }], connectivity: [{ icon, label, detail }] }`
persisted via the existing `locationData.localityData` path into
`property_location.locality_data`. `connectivity` remains manual-only.

### UI (in "Connectivity & Localities" card)
- "Auto-Populate Nearby Places" button with fetching spinner state.
- Shown when latitude + longitude are set OR a city/locality is selected;
  otherwise a hint line. Without coordinates, the selected
  "locality, city" text is geocoded first via Places API v1 `searchText`
  (`resolveCenterFromText` in `src/lib/nearby-places.ts`) and the returned
  point is used as the search center; the success toast names the resolved
  place so the approximation is visible.
- Fetched categories rendered as read-only cards (title + places with
  distance badges), matching site display.
- Manual connectivity editor unchanged, below the fetched categories.

### State
- New `categories` state, prefilled on edit from
  `loc0?.localityData?.categories ?? []` (same pattern as `connectivity`).
- Submit merges `{ categories, connectivity }` into
  `locationData.localityData`; omits `categories` when empty.

### Config
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` must be set for crm-frontend
(same referrer-restricted public key pattern as the site frontend).

### Errors (mirror site toasts)
Missing lat/lng → error toast; missing key → error toast; fetch failure →
"Failed to fetch nearby places. Check your API Key permissions."

## 3. Non-goals
- No CRM/site backend changes; no proxy route (follow-up hardening option).
- Legacy `nearbysearch/json` endpoint and `property_seo` column untouched.
- No map picker widget; lat/lng stay manual inputs.
