"use client";

import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api-fetch";
import {
  FUNDERS, PROPERTY_CATEGORIES, PROPERTY_TYPES_MAP, PURCHASE_TIMELINES, PURCHASE_TYPES, QUALIFICATION_PURPOSES,
} from "@/lib/lead-constants";
import { formatIndianCurrencyShort, parseIndianCurrency } from "@/lib/indian-currency";
import { InlineMulti, InlineSearch, InlineSelect, InlineText, type Option } from "./inline-field";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

// Every property type once, for requirements without a category yet.
const ALL_TYPES: Option[] = [...new Map(Object.values(PROPERTY_TYPES_MAP).flat().map((o) => [o.value, o])).values()];

const BHK: Option[] = [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4+", value: "4" }];
const FURNISHING: Option[] = [{ label: "Furnished", value: "1" }, { label: "Semi furnished", value: "2" }, { label: "Unfurnished", value: "0" }];
const FACING: Option[] = [
  { label: "North", value: "north" }, { label: "East", value: "east" }, { label: "South", value: "south" },
  { label: "West", value: "west" }, { label: "North-East", value: "north_east" },
];
const AREA_CATEGORIES = ["commercial", "industrial", "agricultural", "institutional"];

// Cities change rarely: one request per page load, shared by every requirement.
let citiesRequest: Promise<Option[]> | null = null;
const loadCities = () =>
  (citiesRequest ??= apiFetch(`${API_URL}/leads/cities`)
    .then((r) => r.json())
    .then((d) => (d.success ? d.data.map((c: { id: number; city_name: string }) => ({ label: c.city_name, value: String(c.id) })) : []))
    .catch(() => { citiesRequest = null; return []; }));

/** Projects from the site (via the CRM backend), matched by name, builder or city. */
const searchProjects = async (query: string): Promise<Option[]> => {
  const params = new URLSearchParams({ limit: "20", status: "published" });
  if (query) params.set("search", query);
  const res = await apiFetch(`${API_URL}/projects?${params}`);
  const data = await res.json();
  return (data.data ?? []).map((p: { id: number; name: string; builderName?: string | null; city?: string | null }) => ({
    label: p.name,
    value: String(p.id),
    hint: [p.builderName, p.city].filter(Boolean).join(" · ") || undefined,
  }));
};

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
  const off = !canEdit;

  useEffect(() => {
    let live = true;
    loadCities().then((c) => { if (live) setCities(c); });
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
    <InlineText label={label} value={money(prefs[key])} placeholder={placeholder} disabled={off}
      onSave={(v) => setPref(key, v ? parseIndianCurrency(v) || null : null)} />
  );

  return (
    <div>
      <Group title="Property">
        <InlineSelect label="Purchase type" value={inquiry.purchase_type} options={PURCHASE_TYPES} disabled={off} onSave={(v) => save({ purchaseType: v })} />
        <InlineSearch label="Project" value={inquiry.project_list} search={searchProjects} placeholder="Search projects…" disabled={off}
          onSave={(v) => save({ project: v || null })} />
        <InlineSelect label="Category" value={category} options={PROPERTY_CATEGORIES} disabled={off} onSave={(v) => save({ propertyCategory: v, propertyType: null })} />
        <InlineSelect label="Property type" value={inquiry.property_type} options={(category && PROPERTY_TYPES_MAP[category]) || ALL_TYPES} disabled={off}
          onSave={(v) => save({ propertyType: v })} />
        <InlineSelect label="Funding" value={inquiry.funder} options={FUNDERS} disabled={off} onSave={(v) => save({ funder: v })} />
      </Group>

      <Group title="Buyer">
        <InlineSelect label="City" value={cityId ? String(cityId) : null} options={cities} disabled={off}
          onSave={(v) => save({ cityId: Number(v), subLocations: null })} />
        <InlineMulti label="Locations" values={inquiry.sub_locations ?? []} options={localityOptions} disabled={off}
          placeholder={cityId ? "Select…" : "Pick a city first"} emptyHint={cityId ? "No localities for this city." : "Pick a city first."}
          onSave={(v) => save({ subLocations: v.length ? v : null })} />
        <InlineSelect label="Timeline" value={inquiry.purchase_timeline} options={PURCHASE_TIMELINES} disabled={off} onSave={(v) => save({ purchaseTimeline: v })} />
        <InlineSelect label="Purpose" value={inquiry.qualification_purpose} options={QUALIFICATION_PURPOSES} disabled={off} onSave={(v) => save({ qualificationPurpose: v })} />
        <InlineText label="Decision maker" value={inquiry.decision_maker} placeholder="e.g. Self, Spouse" disabled={off} onSave={(v) => save({ decisionMaker: v || null })} />
      </Group>

      <Group title="Preferences">
        {budget("minBudget", "Min budget", "e.g. 50L")}
        {budget("maxBudget", "Max budget", "e.g. 1.2Cr")}
        {category === "residential" && (
          <>
            <InlineSelect label="BHK" value={prefs.bhk == null ? null : String(prefs.bhk)} options={BHK} disabled={off} onSave={(v) => setPref("bhk", v)} />
            <InlineSelect label="Furnishing" value={prefs.furnished == null ? null : String(prefs.furnished)} options={FURNISHING} disabled={off} onSave={(v) => setPref("furnished", v)} />
            <InlineText label="Floor" value={prefs.floorNumber as string | undefined} placeholder="e.g. Ground, 1st, High" disabled={off} onSave={(v) => setPref("floorNumber", v)} />
            <InlineSelect label="Facing" value={prefs.facing == null ? null : String(prefs.facing)} options={FACING} disabled={off} onSave={(v) => setPref("facing", v)} />
          </>
        )}
        {category && AREA_CATEGORIES.includes(category) && (
          <>
            <InlineText label="Min area" type="number" value={prefs.minArea as string | undefined} placeholder="sq ft" disabled={off} onSave={(v) => setPref("minArea", v)} />
            <InlineText label="Max area" type="number" value={prefs.maxArea as string | undefined} placeholder="sq ft" disabled={off} onSave={(v) => setPref("maxArea", v)} />
          </>
        )}
        {!category && <p className="py-2 text-[13px] text-muted-foreground md:col-span-2">Pick a category to add BHK, facing or area.</p>}
      </Group>
    </div>
  );
}
