"use client";

import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api-fetch";
import {
  AREA_CATEGORIES, BHK_OPTIONS as BHK, CAR_PARKING_OPTIONS, LIFT_OPTIONS, DECISION_MAKERS, FACING_OPTIONS as FACING, FUNDERS, FURNISHING_OPTIONS as FURNISHING, PROPERTY_CATEGORIES, PROPERTY_TYPES_MAP, PURCHASE_TIMELINES, PURCHASE_TYPES, QUALIFICATION_PURPOSES, facingList, prefList,
} from "@/lib/lead-constants";
import { formatIndianCurrencyShort, parseIndianCurrency } from "@/lib/indian-currency";
import { joinProjects, searchProjects, splitProjects } from "@/lib/project-search";
import { InlineCheck, InlineMulti, InlineSearchMulti, InlineSelect, InlineText, withCurrent, type Option } from "@/components/record/inline-field";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

// Every property type once, for requirements without a category yet.
const ALL_TYPES: Option[] = [...new Map(Object.values(PROPERTY_TYPES_MAP).flat().map((o) => [o.value, o])).values()];
export const propertyTypeOptions = (category?: string | null): Option[] => (category && PROPERTY_TYPES_MAP[category]) || ALL_TYPES;
/** The category a type belongs to, for a requirement that has none yet. */
export const categoryOfType = (type: string) => Object.entries(PROPERTY_TYPES_MAP).find(([, list]) => list.some((o) => o.value === type))?.[0] ?? null;

// Cities change rarely: one request per page load, shared by every requirement
// and the lead's contact city.
type City = { id: number; city_name: string };
let citiesRequest: Promise<City[]> | null = null;
export const loadCities = () =>
  (citiesRequest ??= apiFetch(`${API_URL}/leads/cities`)
    .then((r) => r.json())
    .then((d) => (d.success ? (d.data as City[]) : []))
    .catch(() => { citiesRequest = null; return []; }));

type Inquiry = {
  id: number;
  purchase_type?: string | null;
  property_category?: string | null;
  property_type?: string | null;
  funder?: string | null;
  project_list?: string | null;
  city_id?: number | null;
  sub_locations?: string[] | null;
  purchase_timeline?: string | null;
  qualification_purpose?: string | null;
  decision_maker?: string | null;
  preferences?: Record<string, unknown> | null;
};

// Keeps an old value that's no longer offered (e.g. "north_east") pickable, so it can be unticked.
const withCurrentList = (options: Option[], values: string[]) =>
  [...options, ...values.filter((v) => !options.some((o) => o.value === v)).map((v) => ({ label: v, value: v }))];

// Parking, lift and pets matter for homes and offices, not land.
const AMENITY_CATEGORIES = ["residential", "commercial"];

const money = (v: unknown) => (typeof v === "number" ? formatIndianCurrencyShort(v) : v == null ? "" : String(v));

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t px-4 py-3 first:border-t-0 md:px-5">
      <p className="mb-1 text-[12px] font-medium text-muted-foreground">{title}</p>
      <div className="grid gap-x-8 md:grid-cols-2">{children}</div>
    </div>
  );
}

/** One requirement, every field editable in place (changes save as you go). */
export function RequirementFields({ inquiry, canEdit, save }: {
  inquiry: Inquiry;
  canEdit: boolean;
  save: (patch: Record<string, unknown>) => Promise<unknown>;
}) {
  const [cities, setCities] = useState<Option[]>([]);
  const [localities, setLocalities] = useState<{ city: number; options: Option[] } | null>(null);
  const cityId = inquiry.city_id ?? null;
  const category = inquiry.property_category ?? null;
  const prefs = inquiry.preferences ?? {};
  const bhk = prefList(prefs.bhk, BHK);
  const facing = prefList(prefs.facing, FACING);
  // Older requirements hold one furnishing value; newer ones a list.
  const furnished = prefList(prefs.furnished, FURNISHING);
  const off = !canEdit;

  useEffect(() => {
    let live = true;
    loadCities().then((c) => { if (live) setCities(c.map((x) => ({ label: x.city_name, value: String(x.id) }))); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!cityId) return;
    let live = true;
    apiFetch(`${API_URL}/leads/sublocations?city_id=${cityId}`)
      .then((r) => r.json())
      .then((d) => {
        if (live && d.success) setLocalities({ city: cityId, options: d.data.map((l: { locality_name: string }) => ({ label: l.locality_name, value: l.locality_name })) });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [cityId]);

  const localityOptions = cityId && localities?.city === cityId ? localities.options : [];
  // Only the changed key goes up; the server merges it into what's stored.
  const setPref = (key: string, value: unknown) => save({ preferencesPatch: { [key]: value === "" ? null : value ?? null } });
  const budget = (key: "minBudget" | "maxBudget", label: string, placeholder: string) => (
    <InlineText inWords label={label} value={money(prefs[key])} placeholder={placeholder} disabled={off}
      onSave={(v) => setPref(key, v ? parseIndianCurrency(v) || null : null)} />
  );

  return (
    <div>
      <Group title="Property">
        <InlineSelect clearable label="Purchase type" value={inquiry.purchase_type} options={PURCHASE_TYPES} disabled={off} onSave={(v) => save({ purchaseType: v || null })} />
        <InlineSelect clearable label="Category" value={category} options={PROPERTY_CATEGORIES} disabled={off} onSave={(v) => save({ propertyCategory: v || null, propertyType: null })} />
        <InlineSelect clearable label="Property type" value={inquiry.property_type} options={propertyTypeOptions(category)} disabled={off}
          onSave={(v) => save({ propertyType: v || null })} />
        <InlineSelect clearable label="Funding" value={inquiry.funder} options={FUNDERS} disabled={off} onSave={(v) => save({ funder: v || null })} />
      </Group>

      <Group title="Buyer">
        <InlineSelect clearable label="City" value={cityId ? String(cityId) : null} options={cities} disabled={off}
          onSave={(v) => save({ cityId: v ? Number(v) : null, subLocations: null })} />
        <InlineMulti label="Locations" values={inquiry.sub_locations ?? []} options={localityOptions} disabled={off}
          placeholder={cityId ? "Select…" : "Pick a city first"} emptyHint={cityId ? "No localities for this city." : "Pick a city first."}
          onSave={(v) => save({ subLocations: v.length ? v : null })} />
        <InlineSelect clearable label="Timeline" value={inquiry.purchase_timeline} options={PURCHASE_TIMELINES} disabled={off} onSave={(v) => save({ purchaseTimeline: v || null })} />
        <InlineSelect clearable label="Purpose" value={inquiry.qualification_purpose} options={QUALIFICATION_PURPOSES} disabled={off} onSave={(v) => save({ qualificationPurpose: v || null })} />
        <InlineSelect clearable label="Decision maker" value={inquiry.decision_maker} options={withCurrent(DECISION_MAKERS, inquiry.decision_maker)} disabled={off}
          onSave={(v) => save({ decisionMaker: v || null })} />
      </Group>

      <Group title="Preferences">
        {budget("minBudget", "Min budget", "e.g. 50L")}
        {budget("maxBudget", "Max budget", "e.g. 1.2Cr")}
        {category === "residential" && (
          <>
            <InlineMulti label="BHK" values={bhk} options={withCurrentList(BHK, bhk)} disabled={off}
              onSave={(v) => setPref("bhk", v.length ? prefList(v, BHK) : null)} />
            <InlineMulti label="Furnishing" values={furnished} options={withCurrentList(FURNISHING, furnished)} disabled={off}
              onSave={(v) => setPref("furnished", v.length ? prefList(v, FURNISHING) : null)} />
            <InlineText label="Floor" value={prefs.floorNumber as string | undefined} placeholder="e.g. Ground, 1st, High" disabled={off} onSave={(v) => setPref("floorNumber", v)} />
            <InlineMulti label="Facing" values={facing} options={withCurrentList(FACING, facing)} disabled={off}
              onSave={(v) => { const list = facingList(v); return setPref("facing", list.length ? prefList(list, FACING) : null); }} />
          </>
        )}
        {category && AREA_CATEGORIES.includes(category) && (
          <>
            <InlineText label="Min area" type="number" value={prefs.minArea as string | undefined} placeholder="sq ft" disabled={off} onSave={(v) => setPref("minArea", v)} />
            <InlineText label="Max area" type="number" value={prefs.maxArea as string | undefined} placeholder="sq ft" disabled={off} onSave={(v) => setPref("maxArea", v)} />
          </>
        )}
        {category && AMENITY_CATEGORIES.includes(category) && (
          <>
            <InlineSelect clearable label="Car parking" value={prefs.carParking == null ? null : String(prefs.carParking)} options={CAR_PARKING_OPTIONS} disabled={off}
              onSave={(v) => setPref("carParking", v)} />
            <InlineSelect clearable label="Lift" value={prefs.lift == null ? null : String(prefs.lift)} options={LIFT_OPTIONS} disabled={off}
              onSave={(v) => setPref("lift", v)} />
            <InlineCheck label="Pet friendly" text="Needs a pet-friendly home" checked={prefs.petFriendly === true} disabled={off}
              onSave={(v) => setPref("petFriendly", v || null)} />
          </>
        )}
        {inquiry.property_type === "independent_house" && (
          <InlineCheck label="Owner occupied" text="Wants an owner-occupied house" checked={prefs.ownerOccupied === true} disabled={off}
            onSave={(v) => setPref("ownerOccupied", v || null)} />
        )}
        {!category && <p className="py-2 text-[13px] text-muted-foreground md:col-span-2">Pick a category to add BHK, facing or area.</p>}
      </Group>

      <Group title="Projects">
        <InlineSearchMulti label="Projects" values={splitProjects(inquiry.project_list)} search={searchProjects} placeholder="Search projects…" disabled={off}
          onSave={(v) => save({ project: joinProjects(v) })} />
      </Group>
    </div>
  );
}
