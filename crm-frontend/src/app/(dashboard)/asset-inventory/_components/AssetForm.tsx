"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { FileText, ImagePlus, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { ChoiceChips } from "@/components/shared/choice-chips";
import { FOCUS_BUTTON, FOCUS_FIELD, FieldRow, FocusField, FocusModal } from "@/components/shared/focus-modal";
import { FOCUS_INPUT, FOCUS_SELECT, StepFooter, StepSection, useFocusSteps } from "@/components/shared/focus-steps";
import { apiFetch } from "@/lib/api-fetch";
import {
  ASSET_MEDIA, ASSET_SOURCES, ASSET_ZONES, BUSINESS_MODES, CLASSIFICATION_TYPES, DISTANCE_BANDS, REGISTRATION_TIMES,
  SALEABLE_AREAS, SOIL_TYPES, WATER_DEPTHS, WATER_SOURCES, YES_NO, YES_NO_NA, toLayoutsPayload, toLoPrice, toNumber,
  type AssetLayout, type AssetMediaSlot,
} from "@/lib/asset-options";
import { cn } from "@/lib/utils";
import { LayoutsEditor } from "./LayoutsEditor";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const ASSET_STEPS = [
  { key: "owner", label: "Owner" },
  { key: "location", label: "Location" },
  { key: "features", label: "Land" },
  { key: "financials", label: "Pricing" },
  { key: "layouts", label: "Layouts" },
  { key: "media", label: "Media" },
] as const;
type AssetStep = (typeof ASSET_STEPS)[number]["key"];

const EMPTY = {
  owner_name: "", mobile_number: "", source: "", mediator_name: "", cp_reference_name: "", remarks: "",
  visited_date: "", site_visited_done: "", checked_by: "", approved_by: "",
  location: {
    district: "", taluk: "", village: "", zone: "", junction_name: "", distance_from_main: "", distance_from_airport: "",
    firka_range: "", haca_range: "", road_name: "", adjacent_layout: "", approached_roads: "", approached_road_width: "",
    site_location: "", google_pin: "", latitude: "", longitude: "",
  },
  features: {
    classification_type: "", classified_area: "", saleable_area: "", extent: "", tslr: "", water_source: "", water_depth: "",
    soil_type: "", high_voltage_line: "", canal: "", presence_of_well: "", borewell: "", near_railway: "", near_water_body: "",
    near_burial_ground: "",
  },
  financials: { business_mode: "", land_price: "", dtcp_price: "", lo_price: "", expectation: "", registration_time: "", payment_options: "" },
};
type Form = typeof EMPTY;
type Group = "location" | "features" | "financials";

/** A number with its unit shown inside the field. */
function UnitInput({ id, value, onChange, unit, placeholder }: { id: string; value: string; onChange: (v: string) => void; unit: string; placeholder?: string }) {
  return (
    <div className="relative">
      <Input id={id} inputMode="decimal" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} className={cn(FOCUS_INPUT, "pr-16")} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-muted-foreground">{unit}</span>
    </div>
  );
}

/** Picks files for one upload slot and lists what was picked. */
function FilePick({ slot, files, onChange, max = 1 }: { slot: AssetMediaSlot; files: File[]; onChange: (files: File[]) => void; max?: number }) {
  const spec = ASSET_MEDIA[slot];
  const Icon = slot === "document" ? FileText : ImagePlus;
  return (
    <FocusField label={spec.label} optional hint={spec.hint}>
      <div className="space-y-2">
        {files.map((file, i) => (
          <div key={`${file.name}-${i}`} className="flex h-10 items-center gap-2.5 rounded-md border bg-muted/30 px-3 text-[14px]">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`Remove ${file.name}`} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {files.length < max && (
          <label className={cn(FOCUS_BUTTON.secondary, "w-fit cursor-pointer")}>
            <Upload className="h-3.5 w-3.5" /> {files.length ? "Add another" : "Choose file"}
            <input type="file" accept={spec.accept} multiple={max > 1} className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length + picked.length > max) return void toast.error(`Up to ${max} files here.`);
                onChange([...files, ...picked]);
              }} />
          </label>
        )}
      </div>
    </FocusField>
  );
}

/** The new-asset form. Existing assets are edited on their page. */
export function AssetForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [layouts, setLayouts] = useState<AssetLayout[]>([]);
  const [media, setMedia] = useState<Record<AssetMediaSlot, File[]>>({ document: [], fmb: [], barcode: [], images: [] });
  const [fmbAttached, setFmbAttached] = useState("");
  const [saving, setSaving] = useState(false);
  const [districts, setDistricts] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    apiFetch(`${API_URL}/leads/cities`).then((r) => r.json())
      .then((d) => { if (d.success) setDistricts(d.data.map((c: { city_name: string }) => ({ label: c.city_name, value: c.city_name }))); })
      .catch(() => {});
  }, []);

  const top = (key: Exclude<keyof Form, Group>) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value })) });
  const setIn = <G extends Group>(group: G, key: keyof Form[G], value: string) => setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }));
  const field = <G extends Group>(group: G, key: keyof Form[G]) => ({ value: String(form[group][key]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setIn(group, key, e.target.value) });
  const chips = <G extends Group>(group: G, key: keyof Form[G], options: { label: string; value: string }[], label: string) => (
    <ChoiceChips label={label} options={options} value={String(form[group][key])} onChange={(v) => setIn(group, key, v)} />
  );

  const problemOf = (key: AssetStep) =>
    key === "owner" ? (!form.owner_name.trim() ? "Owner name is required" : !form.mobile_number.trim() ? "Mobile number is required" : null) : null;
  const nav = useFocusSteps<AssetStep>(ASSET_STEPS, { create: true, problem: problemOf });

  const save = async () => {
    const missing = ASSET_STEPS.find((s) => problemOf(s.key));
    if (missing) {
      toast.error(problemOf(missing.key));
      return nav.go(missing.key);
    }
    setSaving(true);
    try {
      const f = form.financials;
      const payload = {
        ...form,
        visited_date: form.visited_date || undefined,
        layouts: toLayoutsPayload(layouts),
        financials: {
          ...f,
          land_price: toNumber(f.land_price) ?? undefined,
          dtcp_price: toNumber(f.dtcp_price) ?? undefined,
          lo_price: toLoPrice(f.lo_price) ?? undefined,
          expectation: toNumber(f.expectation) ?? undefined,
        },
      };
      const res = await apiFetch(`${API_URL}/assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error((Array.isArray(data.message) ? data.message.join(", ") : data.message) || "Failed to add the asset");
      const id: number = data.data.id;

      const files = new FormData();
      (Object.keys(media) as AssetMediaSlot[]).forEach((slot) => {
        if (slot === "fmb" && fmbAttached !== "Yes") return;
        media[slot].forEach((file) => files.append(slot, file));
      });
      if ([...files.keys()].length) {
        const upload = await apiFetch(`${API_URL}/assets/${id}/media`, { method: "POST", body: files });
        const result = await upload.json().catch(() => ({}));
        if (!upload.ok || !result.success) toast.error(`Asset added, but the files didn't upload${result.message ? `: ${result.message}` : ""}. Try again from the Media tab.`);
      }
      toast.success("Asset added");
      onCreated(id);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Failed to add the asset");
    } finally {
      setSaving(false);
    }
  };

  const section = (key: AssetStep, title: string, description: string, children: ReactNode) => (
    <StepSection title={title} description={description} hidden={nav.step !== key}>{children}</StepSection>
  );

  return (
    <FocusModal
      open
      onOpenChange={(o) => { if (!o && !saving) onClose(); }}
      title="New asset"
      steps={nav.steps}
      active={nav.step}
      onStepChange={(k) => nav.jump(k as AssetStep)}
      footer={<StepFooter nav={nav} create saving={saving} onCancel={onClose} onSave={() => void save()} createLabel="Add asset" />}
    >
      <form onSubmit={(e) => { e.preventDefault(); if (!nav.last) nav.next(); else void save(); }}>
        {section("owner", "Owner", "Who owns the land, how it reached us, and the site visit.", <>
          <FieldRow>
            <FocusField label="Owner name" htmlFor="as-owner" required>
              <Input id="as-owner" {...top("owner_name")} placeholder="e.g. Lakshmi Narayanan" autoFocus className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Mobile number" htmlFor="as-mobile" required>
              <Input id="as-mobile" type="tel" {...top("mobile_number")} placeholder="+91 98765 43210" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FocusField label="Source" optional>
            <ChoiceChips label="Source" options={ASSET_SOURCES} value={form.source} onChange={(v) => setForm((f) => ({ ...f, source: v }))} />
          </FocusField>
          {form.source === "Mediator" && (
            <FocusField label="Mediator name" htmlFor="as-mediator">
              <Input id="as-mediator" {...top("mediator_name")} className={FOCUS_INPUT} />
            </FocusField>
          )}
          {form.source === "CP Reference" && (
            <FocusField label="CP reference name" htmlFor="as-cp">
              <Input id="as-cp" {...top("cp_reference_name")} className={FOCUS_INPUT} />
            </FocusField>
          )}
          <FieldRow>
            <FocusField label="Site visited on" htmlFor="as-visited" optional>
              <Input id="as-visited" type="date" {...top("visited_date")} className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Visited by" htmlFor="as-visitor" optional>
              <Input id="as-visitor" {...top("site_visited_done")} placeholder="Name" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FieldRow>
            <FocusField label="Checked by" htmlFor="as-checked" optional>
              <Input id="as-checked" {...top("checked_by")} className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Approved by" htmlFor="as-approved" optional>
              <Input id="as-approved" {...top("approved_by")} className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FocusField label="Remarks" htmlFor="as-remarks" optional>
            <Textarea id="as-remarks" rows={3} {...top("remarks")} className={cn(FOCUS_FIELD, "resize-y py-2")} />
          </FocusField>
        </>)}

        {section("location", "Location", "Where the land is and how it's reached.", <>
          <FieldRow cols={3}>
            <FocusField label="District" htmlFor="as-district" optional>
              <FormSelect id="as-district" name="district" options={districts} value={form.location.district || null}
                onValueChange={(v) => setIn("location", "district", v || "")} placeholder="Select district" className={FOCUS_SELECT} />
            </FocusField>
            <FocusField label="Taluk" htmlFor="as-taluk" optional><Input id="as-taluk" {...field("location", "taluk")} className={FOCUS_INPUT} /></FocusField>
            <FocusField label="Village" htmlFor="as-village" optional><Input id="as-village" {...field("location", "village")} className={FOCUS_INPUT} /></FocusField>
          </FieldRow>
          <FocusField label="Zone" optional>{chips("location", "zone", ASSET_ZONES, "Zone")}</FocusField>
          <FieldRow cols={3}>
            <FocusField label="Junction" htmlFor="as-junction" optional><Input id="as-junction" {...field("location", "junction_name")} className={FOCUS_INPUT} /></FocusField>
            <FocusField label="From main road" htmlFor="as-main" optional>
              <UnitInput id="as-main" unit="km" value={form.location.distance_from_main} onChange={(v) => setIn("location", "distance_from_main", v)} placeholder="2.5" />
            </FocusField>
            <FocusField label="From airport" htmlFor="as-airport" optional>
              <UnitInput id="as-airport" unit="km" value={form.location.distance_from_airport} onChange={(v) => setIn("location", "distance_from_airport", v)} placeholder="18" />
            </FocusField>
          </FieldRow>
          <FieldRow cols={3}>
            <FocusField label="Road name" htmlFor="as-road" optional><Input id="as-road" {...field("location", "road_name")} className={FOCUS_INPUT} /></FocusField>
            <FocusField label="Approach roads" htmlFor="as-approach" optional><Input id="as-approach" {...field("location", "approached_roads")} className={FOCUS_INPUT} /></FocusField>
            <FocusField label="Approach road width" htmlFor="as-width" optional>
              <UnitInput id="as-width" unit="feet" value={form.location.approached_road_width} onChange={(v) => setIn("location", "approached_road_width", v)} placeholder="30" />
            </FocusField>
          </FieldRow>
          <FieldRow>
            <FocusField label="Firka range" htmlFor="as-firka" optional><Input id="as-firka" {...field("location", "firka_range")} className={FOCUS_INPUT} /></FocusField>
            <FocusField label="In the HACA range" optional>{chips("location", "haca_range", YES_NO, "In the HACA range")}</FocusField>
          </FieldRow>
          <FocusField label="Next to a layout" optional>{chips("location", "adjacent_layout", YES_NO_NA, "Next to a layout")}</FocusField>
          <FieldRow>
            <FocusField label="Site location" htmlFor="as-site" optional><Input id="as-site" {...field("location", "site_location")} className={FOCUS_INPUT} /></FocusField>
            <FocusField label="Google Maps link" htmlFor="as-pin" optional><Input id="as-pin" type="url" {...field("location", "google_pin")} placeholder="https://maps.app.goo.gl/…" className={FOCUS_INPUT} /></FocusField>
          </FieldRow>
          <FieldRow>
            <FocusField label="Latitude" htmlFor="as-lat" optional><Input id="as-lat" inputMode="decimal" {...field("location", "latitude")} placeholder="11.0168" className={FOCUS_INPUT} /></FocusField>
            <FocusField label="Longitude" htmlFor="as-lng" optional><Input id="as-lng" inputMode="decimal" {...field("location", "longitude")} placeholder="76.9558" className={FOCUS_INPUT} /></FocusField>
          </FieldRow>
        </>)}

        {section("features", "Land", "The land itself: size, water, soil and what's around it.", <>
          <FieldRow>
            <FocusField label="Extent" htmlFor="as-extent" optional>
              <UnitInput id="as-extent" unit="acres" value={form.features.extent} onChange={(v) => setIn("features", "extent", v)} placeholder="4.5" />
            </FocusField>
            <FocusField label="TSLR" htmlFor="as-tslr" optional><Input id="as-tslr" {...field("features", "tslr")} className={FOCUS_INPUT} /></FocusField>
          </FieldRow>
          <FocusField label="Classification" optional>{chips("features", "classification_type", CLASSIFICATION_TYPES, "Classification")}</FocusField>
          {form.features.classification_type === "Classified Area" && (
            <FocusField label="Classified area" htmlFor="as-classified"><Input id="as-classified" {...field("features", "classified_area")} className={FOCUS_INPUT} /></FocusField>
          )}
          <FocusField label="Saleable area" optional>{chips("features", "saleable_area", SALEABLE_AREAS, "Saleable area")}</FocusField>
          <FieldRow>
            <FocusField label="Water source" optional>{chips("features", "water_source", WATER_SOURCES, "Water source")}</FocusField>
            <FocusField label="Water depth" optional>{chips("features", "water_depth", WATER_DEPTHS, "Water depth")}</FocusField>
          </FieldRow>
          <FieldRow>
            <FocusField label="Soil type" htmlFor="as-soil" optional>
              <FormSelect id="as-soil" name="soil_type" options={SOIL_TYPES} value={form.features.soil_type || null}
                onValueChange={(v) => setIn("features", "soil_type", v || "")} placeholder="Select soil type" className={FOCUS_SELECT} />
            </FocusField>
          </FieldRow>
          <FieldRow cols={3}>
            <FocusField label="High-voltage line" optional>{chips("features", "high_voltage_line", YES_NO, "High-voltage line")}</FocusField>
            <FocusField label="Well" optional>{chips("features", "presence_of_well", YES_NO, "Well")}</FocusField>
            <FocusField label="Borewell" optional>{chips("features", "borewell", YES_NO, "Borewell")}</FocusField>
          </FieldRow>
          <FocusField label="Distance to a railway" optional>{chips("features", "near_railway", DISTANCE_BANDS, "Distance to a railway")}</FocusField>
          <FocusField label="Distance to a water body" optional>{chips("features", "near_water_body", DISTANCE_BANDS, "Distance to a water body")}</FocusField>
          <FocusField label="Distance to a canal" optional>{chips("features", "canal", DISTANCE_BANDS, "Distance to a canal")}</FocusField>
          <FocusField label="Distance to a burial ground" optional>{chips("features", "near_burial_ground", DISTANCE_BANDS, "Distance to a burial ground")}</FocusField>
        </>)}

        {section("financials", "Pricing", "What the owner wants and how the deal would work.", <>
          <FocusField label="Business mode" optional>{chips("financials", "business_mode", BUSINESS_MODES, "Business mode")}</FocusField>
          <FieldRow>
            <FocusField label="Land price" htmlFor="as-land" optional>
              <UnitInput id="as-land" unit="lakhs" value={form.financials.land_price} onChange={(v) => setIn("financials", "land_price", v)} placeholder="120" />
            </FocusField>
            <FocusField label="DTCP price" htmlFor="as-dtcp" optional>
              <UnitInput id="as-dtcp" unit="lakhs" value={form.financials.dtcp_price} onChange={(v) => setIn("financials", "dtcp_price", v)} placeholder="8" />
            </FocusField>
          </FieldRow>
          <FieldRow>
            <FocusField label="Owner's expectation" htmlFor="as-expect" optional>
              <UnitInput id="as-expect" unit="lakhs" value={form.financials.expectation} onChange={(v) => setIn("financials", "expectation", v)} placeholder="150" />
            </FocusField>
            <FocusField label="LO price" htmlFor="as-lo" optional hint="Type it like 80L or 1.2Cr.">
              <Input id="as-lo" {...field("financials", "lo_price")} placeholder="e.g. 80L" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FocusField label="Registration within" optional>{chips("financials", "registration_time", REGISTRATION_TIMES, "Registration within")}</FocusField>
          <FocusField label="Payment options" htmlFor="as-pay" optional><Input id="as-pay" {...field("financials", "payment_options")} className={FOCUS_INPUT} /></FocusField>
        </>)}

        {section("layouts", "Layouts", "Approved layouts on or next to the site. Skip this if there are none.",
          <LayoutsEditor rows={layouts} onChange={setLayouts} />)}

        {section("media", "Media", "Files are uploaded once the asset is added.", <>
          <FilePick slot="images" files={media.images} max={4} onChange={(f) => setMedia((m) => ({ ...m, images: f }))} />
          <FilePick slot="document" files={media.document} onChange={(f) => setMedia((m) => ({ ...m, document: f }))} />
          <FocusField label="FMB attached" optional>
            <ChoiceChips label="FMB attached" options={YES_NO_NA} value={fmbAttached} onChange={setFmbAttached} />
          </FocusField>
          {fmbAttached === "Yes" && <FilePick slot="fmb" files={media.fmb} onChange={(f) => setMedia((m) => ({ ...m, fmb: f }))} />}
          <FilePick slot="barcode" files={media.barcode} onChange={(f) => setMedia((m) => ({ ...m, barcode: f }))} />
        </>)}
      </form>
    </FocusModal>
  );
}
