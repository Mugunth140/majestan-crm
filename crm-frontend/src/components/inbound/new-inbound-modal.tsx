"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, MapPin, Plus, UploadCloud, X } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { inboundLocation } from "@/lib/inbound-location";
import { persistedStateKey } from "@/hooks/use-persisted-state";
import { INBOUND_STATUS_OPTIONS } from "@/lib/inbound-status";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/shared/form-select";
import { PriceInput } from "@/components/shared/price-input";
import { TimePicker } from "@/components/shared/time-picker";
import {
  FieldRow, FOCUS_BUTTON, FOCUS_FIELD, FocusField, FocusModal, FocusSection, fieldName, stepStatus,
} from "@/components/shared/focus-modal";
import {
  ADVANCE_MONTHS, BHK_CHOICES, BROKERAGE_ACCEPTED, BROKERAGE_PAYERS, BROKERAGE_TYPES, EMPTY_INBOUND, INBOUND_CATEGORIES, INDIAN_STATES,
  INBOUND_PURPOSES, INBOUND_STATUSES, INBOUND_STEPS, INBOUND_TYPES, KEY_HOLDERS, PRIMARY_CONTACTS, SPECIAL_PURPOSES,
  checkInbound, hasBhk, hasFloor, hasFloorPricing, inboundErrorMessage, inboundPayload,
  type FloorRow, type InboundForm, type InboundStep,
} from "@/lib/inbound-form";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const SELECT = cn(FOCUS_FIELD, "h-9! rounded-md! border-border! text-[14px]!");
const INPUT = cn(FOCUS_FIELD, "h-9");
const AREA = cn(FOCUS_FIELD, "min-h-16 resize-y py-2");
const STATUS_OPTIONS = INBOUND_STATUSES.map((s) => ({ label: s, value: s }));
const MAX_PHOTO = 10 * 1024 * 1024;

type StepKey = (typeof INBOUND_STEPS)[number]["key"];

/** After a phone capture, the list opens on the Queue with no stale search or filters. */
export function showQueueNext() {
  try {
    sessionStorage.setItem(persistedStateKey("inbound:tab"), JSON.stringify("Queue"));
    for (const key of ["inbound:search", "inbound:filters", "inbound:queueFilters"]) sessionStorage.removeItem(persistedStateKey(key));
  } catch { /* The capture still succeeded when browser storage is unavailable. */ }
}

/** A checkbox with its label, for yes/no flags. */
function Flag({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/20 px-3.5 py-3 dark:bg-white/[0.02]">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
      <span>
        <span className="block text-[14px] font-medium text-foreground">{label}</span>
        {hint && <span className="block text-[13px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/** Choice chips for a short multi-select (special purposes, who pays brokerage). */
function Chips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
            className={cn(
              "h-8 rounded-md border px-3 text-[13px] transition-colors",
              on ? "border-foreground bg-foreground text-background" : "bg-muted/40 text-foreground/80 hover:bg-muted dark:bg-white/[0.04]",
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Adding an inbound (a property an owner offers us). On a computer it's six
 * steps; on a phone it's the field team's quick capture: category, type, the
 * owner's number and a photo, with the location picked up in the background.
 */
export function NewInboundModal({ open, onOpenChange, onCreated, quick = false }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: number | null) => void;
  /** The phone's one-page quick capture. */
  quick?: boolean;
}) {
  const [form, setForm] = useState<InboundForm>(EMPTY_INBOUND);
  const [active, setActive] = useState<StepKey>("property");
  const [visited, setVisited] = useState<Set<StepKey>>(() => new Set(["property"]));
  const [showErrors, setShowErrors] = useState<Set<InboundStep>>(() => new Set());
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [cities, setCities] = useState<{ label: string; value: string }[] | null>(null);
  const [localities, setLocalities] = useState<{ city: string; options: { label: string; value: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const capture = useRef("");

  // Fresh form each time it opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(EMPTY_INBOUND);
      setActive("property");
      setVisited(new Set(["property"]));
      setShowErrors(new Set());
      setTouched(new Set());
      setPhoto(null);
    }
  }

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  useEffect(() => {
    if (!open || quick) return;
    let live = true;
    apiFetch(`${API_URL}/master/cities`)
      .then((r) => r.json())
      .then((d) => { if (live) setCities(d.success ? d.data : []); })
      .catch(() => { if (live) { setCities([]); toast.error("Couldn't load cities."); } });
    return () => { live = false; };
  }, [open, quick]);

  useEffect(() => {
    if (!form.city) return;
    let live = true;
    apiFetch(`${API_URL}/master/sublocations?city_name=${encodeURIComponent(form.city)}`)
      .then((r) => r.json())
      .then((d) => { if (live && d.success) setLocalities({ city: form.city, options: d.data }); })
      .catch(() => {});
    return () => { live = false; };
  }, [form.city]);

  // The phone form starts listening for a location as soon as it opens.
  useEffect(() => {
    if (!open || !quick) return;
    capture.current = inboundLocation.startCapture();
    return () => inboundLocation.stopCapture(capture.current);
  }, [open, quick]);

  const set = <K extends keyof InboundForm>(key: K, value: InboundForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setUnit = (i: number, patch: Partial<FloorRow>) => setForm((f) => ({ ...f, units: f.units.map((u, j) => (j === i ? { ...u, ...patch } : u)) }));

  const current: InboundStep = quick ? "capture" : active;
  const valid = (step: InboundStep) => Object.keys(checkInbound(step, form)).length === 0;
  const allErrors = checkInbound(current, form);
  const errors = showErrors.has(current) ? allErrors : Object.fromEntries(Object.entries(allErrors).filter(([k]) => touched.has(k)));
  const ready = valid(current);
  const index = INBOUND_STEPS.findIndex((s) => s.key === active);
  const last = quick || index === INBOUND_STEPS.length - 1;

  const steps = useMemo(
    () => INBOUND_STEPS.map((s, i) => ({ ...s, status: stepStatus(i, index, visited.has(s.key) && Object.keys(checkInbound(s.key, form)).length === 0) })),
    [index, visited, form],
  );

  const go = (key: StepKey) => {
    setActive(key);
    setVisited((v) => new Set(v).add(key));
  };
  const flag = (key: InboundStep) => setShowErrors((s) => new Set(s).add(key));
  const jump = (key: StepKey) => {
    const target = INBOUND_STEPS.findIndex((s) => s.key === key);
    const blocked = INBOUND_STEPS.slice(0, target).find((s) => !valid(s.key));
    if (blocked && target > index) {
      flag(blocked.key);
      go(blocked.key);
      return;
    }
    go(key);
  };
  const next = () => {
    if (!valid(current)) return flag(current);
    if (!last) go(INBOUND_STEPS[index + 1].key);
    else void submit();
  };

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_PHOTO) return void toast.error("Photos must be 10 MB or smaller.");
    setPhoto({ file, url: URL.createObjectURL(file) });
  };

  const locate = () => {
    if (!navigator.geolocation) return void toast.error("This browser can't share its location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: String(pos.coords.latitude), longitude: String(pos.coords.longitude) }));
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "Location permission denied. Allow it and try again." : "Couldn't get the location. Try again.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const submit = async () => {
    const invalid = quick ? null : INBOUND_STEPS.find((s) => !valid(s.key));
    if (invalid) {
      flag(invalid.key);
      go(invalid.key);
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/inbounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inboundPayload(form, quick)),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(inboundErrorMessage(result) || "Couldn't save the inbound");
      const id: number | null = result?.id ?? result?.data?.id ?? null;
      if (quick && id) inboundLocation.enqueue(capture.current, id, !!photo);

      let photoHasLocation = false;
      if (photo && id) {
        const body = new FormData();
        body.append("file", photo.file);
        const up = await apiFetch(`${API_URL}/inbounds/${id}/image`, { method: "POST", body }).catch(() => null);
        if (!up?.ok) toast.error("Inbound saved, but the photo didn't upload.");
        else {
          const saved = await up.json().catch(() => null);
          const data = saved?.data ?? saved;
          photoHasLocation = data?.latitude != null && data?.longitude != null;
        }
      }
      if (quick && id) inboundLocation.photoFinished(id, photoHasLocation);
      toast.success("Inbound added.");
      onOpenChange(false);
      onCreated?.(id);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't save the inbound");
    } finally {
      setSubmitting(false);
    }
  };

  const loading = <div className={cn(INPUT, "flex items-center border")}><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  const types = form.category ? INBOUND_TYPES[form.category] ?? [] : [];
  const localityOptions = localities && localities.city === form.city ? localities.options : [];
  const rent = form.purpose === "Rent";
  const brokered = form.brokerage_accepted === "Yes" || form.brokerage_accepted === "Negotiable";

  const categoryFields = (
    <FieldRow>
      <FocusField required name="category" label="Property category" error={errors.category}>
        <FormSelect name="category" placeholder="Select" className={SELECT} value={form.category || null} options={INBOUND_CATEGORIES}
          onValueChange={(v) => setForm((f) => ({ ...f, category: v, type: "", bhk: "", special: v === "commercial" ? f.special : [] }))} />
      </FocusField>
      <FocusField required name="type" label="Property type" error={errors.type}>
        <FormSelect name="type" placeholder={form.category ? "Select" : "Pick a category first"} className={SELECT} disabled={!form.category}
          value={form.type || null} options={types} onValueChange={(v) => setForm((f) => ({ ...f, type: v, bhk: "" }))} />
      </FocusField>
    </FieldRow>
  );

  const photoField = (
    <FocusField label="Property photo" optional hint="A clear photo of the front. Its GPS position fills in the location when the phone saved one.">
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={pickPhoto} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={pickPhoto} className="hidden" />
      {photo ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the picked file */}
          <img src={photo.url} alt="Property preview" className="h-40 w-full max-w-[280px] rounded-lg border object-cover" />
          <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo" className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75">
            <X className="h-4 w-4" />
          </button>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{photo.file.name} · {(photo.file.size / 1024 / 1024).toFixed(1)} MB</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()} className={FOCUS_BUTTON.secondary}><Camera className="h-4 w-4" /> Take photo</button>
          <button type="button" onClick={() => fileRef.current?.click()} className={FOCUS_BUTTON.secondary}><UploadCloud className="h-4 w-4" /> Choose from gallery</button>
        </div>
      )}
    </FocusField>
  );

  let body: React.ReactNode;
  if (quick) {
    body = (
      <FocusSection title="Quick capture" description="The basics now; the rest can be filled in from the inbound's page.">
        {categoryFields}
        <FocusField required name="mobile" label="Owner's mobile" htmlFor="ni-mobile" error={errors.mobile}>
          <Input id="ni-mobile" type="tel" inputMode="tel" autoComplete="tel" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="98765 43210" className={INPUT} />
        </FocusField>
        <FieldRow>
          <FocusField label="Alternate number" htmlFor="ni-alt" optional>
            <Input id="ni-alt" type="tel" inputMode="tel" value={form.alternate_contact} onChange={(e) => set("alternate_contact", e.target.value)} placeholder="Another number" className={INPUT} />
          </FocusField>
          <FocusField label="Other contact" htmlFor="ni-altc" optional>
            <Input id="ni-altc" maxLength={1000} value={form.alternative_contact} onChange={(e) => set("alternative_contact", e.target.value)} placeholder="Name or other details" className={INPUT} />
          </FocusField>
        </FieldRow>
        <FocusField label="Inbound status" optional>
          <FormSelect name="inbound_status" placeholder="Select" className={SELECT} value={form.inbound_status || null} options={INBOUND_STATUS_OPTIONS} onValueChange={(v) => set("inbound_status", v)} />
        </FocusField>
        {photoField}
      </FocusSection>
    );
  } else if (active === "property") {
    body = (
      <FocusSection title="Property" description="What's on offer and on what terms.">
        <FocusField required name="property_title" label="Title" htmlFor="ni-title" error={errors.property_title}>
          <Input id="ni-title" autoFocus value={form.property_title} onChange={(e) => set("property_title", e.target.value)} placeholder="3 BHK apartment near RS Puram" className={INPUT} />
        </FocusField>
        {categoryFields}
        <FieldRow>
          <FocusField required name="purpose" label="Purpose" error={errors.purpose}>
            <FormSelect name="purpose" placeholder="Sale, rent or lease" className={SELECT} value={form.purpose || null} options={INBOUND_PURPOSES} onValueChange={(v) => set("purpose", v)} />
          </FocusField>
          {hasBhk(form.category, form.type) && (
            <FocusField label="BHK" optional>
              <FormSelect name="bhk" placeholder="Select" className={SELECT} value={form.bhk || null} options={BHK_CHOICES} onValueChange={(v) => set("bhk", v)} />
            </FocusField>
          )}
        </FieldRow>
        {form.category === "commercial" && (
          <FocusField label="Suits" optional hint="Uses the space is fit for.">
            <Chips options={SPECIAL_PURPOSES} value={form.special} onChange={(v) => set("special", v)} />
          </FocusField>
        )}
        <FieldRow>
          <FocusField required name="status" label="Status" error={errors.status}>
            <FormSelect name="status" placeholder="Select" className={SELECT} value={form.status || null} options={STATUS_OPTIONS} onValueChange={(v) => set("status", v)} />
          </FocusField>
          <FocusField label="Inbound status" optional>
            <FormSelect name="inbound_status" placeholder="Select" className={SELECT} value={form.inbound_status || null} options={INBOUND_STATUS_OPTIONS} onValueChange={(v) => set("inbound_status", v)} />
          </FocusField>
        </FieldRow>
      </FocusSection>
    );
  } else if (active === "location") {
    body = (
      <FocusSection title="Location" description="Where the property is.">
        <FieldRow cols={3}>
          <FocusField required name="state" label="State" error={errors.state}>
            <FormSelect name="state" placeholder="Select" className={SELECT} value={form.state || null}
              options={INDIAN_STATES.some((o) => o.value === form.state) || !form.state ? INDIAN_STATES : [{ label: form.state, value: form.state }, ...INDIAN_STATES]}
              onValueChange={(v) => set("state", v)} />
          </FocusField>
          <FocusField required name="city" label="City" error={errors.city}>
            {cities === null ? loading : (
              <FormSelect name="city" placeholder="Select" className={SELECT} value={form.city || null} options={cities}
                onValueChange={(v) => setForm((f) => ({ ...f, city: v, locality: "" }))} />
            )}
          </FocusField>
          <FocusField required name="locality" label="Locality" error={errors.locality}>
            <FormSelect name="locality" placeholder={form.city ? "Select" : "Pick a city first"} className={SELECT} disabled={!form.city}
              value={form.locality || null} options={localityOptions} onValueChange={(v) => set("locality", v)} />
          </FocusField>
        </FieldRow>
        <FieldRow>
          <FocusField label="Area" htmlFor="ni-area" optional>
            <Input id="ni-area" value={form.area} onChange={(e) => set("area", e.target.value)} placeholder="1500 sq ft" className={INPUT} />
          </FocusField>
          <FocusField label="Landmark" htmlFor="ni-landmark" optional>
            <Input id="ni-landmark" value={form.landmark} onChange={(e) => set("landmark", e.target.value)} placeholder="Opposite Brookefields mall" className={INPUT} />
          </FocusField>
        </FieldRow>
        <FieldRow>
          <FocusField name="latitude" label="Latitude" htmlFor="ni-lat" optional error={errors.latitude}>
            <Input id="ni-lat" type="number" step="any" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="11.0168" className={INPUT} />
          </FocusField>
          <FocusField name="longitude" label="Longitude" htmlFor="ni-lng" optional error={errors.longitude}>
            <Input id="ni-lng" type="number" step="any" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="76.9558" className={INPUT} />
          </FocusField>
        </FieldRow>
        <button type="button" onClick={locate} disabled={locating} className={FOCUS_BUTTON.secondary}>
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {locating ? "Getting location…" : "Use my current location"}
        </button>
      </FocusSection>
    );
  } else if (active === "pricing") {
    body = (
      <>
        <FocusSection title="Pricing" description={form.purpose ? `The ${form.purpose.toLowerCase()} terms.` : "Pick a purpose on the Property step to see its terms."}>
          <FieldRow>
            {rent && (
              <FocusField label="Monthly rent" optional>
                <PriceInput type="number" value={form.total_rent} onChange={(v) => set("total_rent", v)} placeholder="15000" className={INPUT} />
              </FocusField>
            )}
            {form.purpose === "Sale" && form.category === "residential" && (
              <FocusField label="Sale price" optional>
                <PriceInput value={form.sale_price} onChange={(v) => set("sale_price", v)} placeholder="85 Lakhs" className={INPUT} />
              </FocusField>
            )}
            {form.purpose && (
              <FocusField label={rent ? "Advance (months)" : "Advance"} optional>
                {rent ? (
                  <FormSelect name="advance" placeholder="Select" className={SELECT} value={form.advance || null} options={ADVANCE_MONTHS} onValueChange={(v) => set("advance", v)} />
                ) : (
                  <PriceInput value={form.advance} onChange={(v) => set("advance", v)} placeholder={form.purpose === "Sale" ? "5 Lakhs" : "1 Lakh"} className={INPUT} />
                )}
              </FocusField>
            )}
            {rent && (
              <FocusField label="Rent per sq ft" optional>
                <PriceInput type="number" step="0.01" value={form.rent_per_sqft} onChange={(v) => set("rent_per_sqft", v)} placeholder="25.5" className={INPUT} />
              </FocusField>
            )}
            {hasFloor(form.type) && (
              <FocusField label="Floor" htmlFor="ni-floor" optional>
                <Input id="ni-floor" value={form.floor_number} onChange={(e) => set("floor_number", e.target.value)} placeholder="Ground, 1st, Multiple" className={INPUT} />
              </FocusField>
            )}
          </FieldRow>
        </FocusSection>
        {hasFloorPricing(form.category, form.type) && (
          <FocusSection title="Floors" description="Only when floors are priced differently; otherwise the pricing above covers it.">
            {form.units.map((u, i) => (
              <div key={i} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                <FocusField label="Floor" required>
                  <Input value={u.floor_label} onChange={(e) => setUnit(i, { floor_label: e.target.value })} placeholder="Ground floor" className={INPUT} />
                </FocusField>
                <FocusField label="Area" optional>
                  <Input value={u.area} onChange={(e) => setUnit(i, { area: e.target.value })} placeholder="1200 sq ft" className={INPUT} />
                </FocusField>
                <FocusField label={rent ? "Rent" : "Price"} optional>
                  <PriceInput value={u.price} onChange={(v) => setUnit(i, { price: v })} placeholder="50000" className={INPUT} />
                </FocusField>
                <button type="button" onClick={() => set("units", form.units.filter((_, j) => j !== i))} aria-label="Remove floor" className={cn(FOCUS_BUTTON.secondary, "h-9 w-9 px-0")}>
                  <X className="h-4 w-4" />
                </button>
                <FocusField label="Notes" optional className="md:col-span-4">
                  <Input value={u.notes} onChange={(e) => setUnit(i, { notes: e.target.value })} placeholder="Lift access, separate entrance…" className={INPUT} />
                </FocusField>
              </div>
            ))}
            <button type="button" onClick={() => set("units", [...form.units, { floor_label: "", area: "", price: "", notes: "" }])} className={FOCUS_BUTTON.secondary}>
              <Plus className="h-4 w-4" /> Add floor
            </button>
          </FocusSection>
        )}
      </>
    );
  } else if (active === "owner") {
    body = (
      <FocusSection title="Owner" description="Who owns it and how to reach them.">
        <FieldRow>
          <FocusField required name="owner_name" label="Owner's name" htmlFor="ni-owner" error={errors.owner_name}>
            <Input id="ni-owner" autoFocus value={form.owner_name} onChange={(e) => set("owner_name", e.target.value)} placeholder="Karthik S" className={INPUT} />
          </FocusField>
          <FocusField required name="mobile" label="Mobile" htmlFor="ni-mob" error={errors.mobile}>
            <Input id="ni-mob" type="tel" inputMode="tel" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="98765 43210" className={INPUT} />
          </FocusField>
        </FieldRow>
        <FieldRow>
          <FocusField label="WhatsApp" htmlFor="ni-wa" optional>
            <Input id="ni-wa" type="tel" inputMode="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="Same as mobile if empty" className={INPUT} />
          </FocusField>
          <FocusField name="email" label="Email" htmlFor="ni-email" optional error={errors.email}>
            <Input id="ni-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="owner@example.com" className={INPUT} />
          </FocusField>
        </FieldRow>
        <FieldRow>
          <FocusField label="Alternate number" htmlFor="ni-alt2" optional>
            <Input id="ni-alt2" type="tel" inputMode="tel" value={form.alternate_contact} onChange={(e) => set("alternate_contact", e.target.value)} placeholder="Another number" className={INPUT} />
          </FocusField>
          <FocusField label="Best time to call" optional>
            <TimePicker value={form.preferred_time || undefined} onChange={(v) => set("preferred_time", v ?? "")} placeholder="Pick a time" />
          </FocusField>
        </FieldRow>
        <FocusField label="Other contact" htmlFor="ni-altc2" optional>
          <Input id="ni-altc2" maxLength={1000} value={form.alternative_contact} onChange={(e) => set("alternative_contact", e.target.value)} placeholder="A relative, or anyone else to reach" className={INPUT} />
        </FocusField>
        <FocusField label="Owner's address" htmlFor="ni-addr" optional>
          <Textarea id="ni-addr" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Door number, street, area" className={AREA} />
        </FocusField>
        <FieldRow>
          <Flag id="ni-pan" checked={form.pan_available} onChange={(v) => set("pan_available", v)} label="PAN available" />
          <Flag id="ni-gst" checked={form.gst_applicable} onChange={(v) => set("gst_applicable", v)} label="GST applicable" />
        </FieldRow>
      </FocusSection>
    );
  } else if (active === "access") {
    const otherPrimary = !!form.primary_contact && form.primary_contact !== "Owner";
    const otherKey = !!form.key_with && form.key_with !== "Owner" && form.key_with !== form.primary_contact;
    body = (
      <FocusSection title="Access" description="Who to call to see the property, and who has the keys.">
        <FieldRow>
          <FocusField required name="primary_contact" label="Contact for visits" error={errors.primary_contact}>
            <FormSelect name="primary_contact" placeholder="Select" className={SELECT} value={form.primary_contact || null} options={PRIMARY_CONTACTS} onValueChange={(v) => set("primary_contact", v)} />
          </FocusField>
        </FieldRow>
        {otherPrimary && (
          <FieldRow>
            <FocusField label={`${form.primary_contact}'s name`} htmlFor="ni-pcn" optional>
              <Input id="ni-pcn" value={form.primary_contact_name} onChange={(e) => set("primary_contact_name", e.target.value)} className={INPUT} />
            </FocusField>
            <FocusField label={`${form.primary_contact}'s number`} htmlFor="ni-pcm" optional>
              <Input id="ni-pcm" type="tel" inputMode="tel" value={form.primary_contact_number} onChange={(e) => set("primary_contact_number", e.target.value)} className={INPUT} />
            </FocusField>
          </FieldRow>
        )}
        <FieldRow>
          <FocusField required name="key_with" label="Keys are with" error={errors.key_with}>
            <FormSelect name="key_with" placeholder="Select" className={SELECT} value={form.key_with || null} options={KEY_HOLDERS} onValueChange={(v) => set("key_with", v)} />
          </FocusField>
        </FieldRow>
        {otherKey && (
          <FieldRow>
            <FocusField label="Key holder's name" htmlFor="ni-kn" optional>
              <Input id="ni-kn" value={form.key_contact_name} onChange={(e) => set("key_contact_name", e.target.value)} className={INPUT} />
            </FocusField>
            <FocusField label="Key holder's number" htmlFor="ni-km" optional>
              <Input id="ni-km" type="tel" inputMode="tel" value={form.key_contact_number} onChange={(e) => set("key_contact_number", e.target.value)} className={INPUT} />
            </FocusField>
          </FieldRow>
        )}
        <Flag id="ni-appt" checked={form.prior_appointment} onChange={(v) => set("prior_appointment", v)} label="Visits need an appointment" hint="Call ahead before taking anyone to see it." />
      </FocusSection>
    );
  } else {
    body = (
      <>
        <FocusSection title="Brokerage" description="What the owner agreed to pay us.">
          <FieldRow>
            <FocusField required name="brokerage_accepted" label="Brokerage accepted" error={errors.brokerage_accepted}>
              <FormSelect name="brokerage_accepted" placeholder="Select" className={SELECT} value={form.brokerage_accepted || null} options={BROKERAGE_ACCEPTED} onValueChange={(v) => set("brokerage_accepted", v)} />
            </FocusField>
            {brokered && (
              <FocusField label="Type" optional>
                <FormSelect name="brokerage_type" placeholder="Select" className={SELECT} value={form.brokerage_type || null} options={BROKERAGE_TYPES} onValueChange={(v) => set("brokerage_type", v)} />
              </FocusField>
            )}
          </FieldRow>
          {brokered && (
            <>
              {form.brokerage_type === "Percentage" && (
                <FieldRow>
                  <FocusField label="Percentage" htmlFor="ni-pct" optional>
                    <div className="relative">
                      <Input id="ni-pct" type="number" step="0.1" min="0" value={form.percentage} onChange={(e) => set("percentage", e.target.value)} placeholder="2" className={cn(INPUT, "pr-8")} />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[14px] text-muted-foreground">%</span>
                    </div>
                  </FocusField>
                </FieldRow>
              )}
              {form.brokerage_type === "Fixed" && (
                <FieldRow>
                  <FocusField label="Fixed amount" htmlFor="ni-fix" optional>
                    <Input id="ni-fix" type="number" min="0" value={form.fixed_amount} onChange={(e) => set("fixed_amount", e.target.value)} placeholder="50000" className={INPUT} />
                  </FocusField>
                </FieldRow>
              )}
              {form.brokerage_type === "Days" && (
                <FieldRow>
                  <FocusField label="Days of rent" htmlFor="ni-days" optional>
                    <Input id="ni-days" type="number" min="0" value={form.brokerage_days} onChange={(e) => set("brokerage_days", e.target.value)} placeholder="15" className={INPUT} />
                  </FocusField>
                </FieldRow>
              )}
              <FocusField label="Paid by" optional>
                <Chips options={BROKERAGE_PAYERS} value={form.brokerage_paid_by} onChange={(v) => set("brokerage_paid_by", v)} />
              </FocusField>
              <FocusField label="Remarks" htmlFor="ni-brem" optional>
                <Textarea id="ni-brem" rows={2} value={form.brokerage_remarks} onChange={(e) => set("brokerage_remarks", e.target.value)} placeholder="Split with co-broker, payable on registration…" className={AREA} />
              </FocusField>
            </>
          )}
        </FocusSection>
        <FocusSection title="Listing">
          {photoField}
          <div className="grid gap-3 md:grid-cols-3">
            <Flag id="ni-excl" checked={form.is_exclusive} onChange={(v) => set("is_exclusive", v)} label="Exclusive" />
            <Flag id="ni-prime" checked={form.is_prime_location} onChange={(v) => set("is_prime_location", v)} label="Prime location" />
            <Flag id="ni-docs" checked={form.documents_collected} onChange={(v) => set("documents_collected", v)} label="Documents collected" />
          </div>
        </FocusSection>
      </>
    );
  }

  return (
    <FocusModal
      open={open}
      onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}
      title="New inbound"
      steps={quick ? undefined : steps}
      active={active}
      onStepChange={(k) => jump(k as StepKey)}
      footer={
        <>
          <button type="button" className={FOCUS_BUTTON.secondary} onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</button>
          {!quick && index > 0 && (
            <button type="button" className={FOCUS_BUTTON.secondary} onClick={() => go(INBOUND_STEPS[index - 1].key)} disabled={submitting}>Back</button>
          )}
          <button
            type="button"
            aria-disabled={!ready}
            title={ready ? undefined : "Fill in the fields marked * first"}
            className={cn(last ? FOCUS_BUTTON.primary : FOCUS_BUTTON.secondary, !ready && "cursor-not-allowed opacity-50")}
            onClick={next}
            disabled={submitting}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {last ? (submitting ? "Saving…" : "Add inbound") : "Continue"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => { e.preventDefault(); next(); }}
        onBlur={(e) => {
          if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return;
          const name = fieldName(e.target);
          if (name && !touched.has(name)) setTouched((t) => new Set(t).add(name));
        }}
      >
        {body}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </FocusModal>
  );
}

