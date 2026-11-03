"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { PriceInput } from "@/components/shared/price-input";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { SearchCombobox } from "@/components/shared/search-combobox";
import {
  FieldRow, FOCUS_BUTTON, FOCUS_FIELD, FocusField, FocusModal, FocusSection, ToggleCard, stepStatus,
} from "@/components/shared/focus-modal";
import {
  AREA_CATEGORIES, BHK_OPTIONS, DECISION_MAKERS, FACING_OPTIONS, FUNDERS, FURNISHING_OPTIONS,
  PROPERTY_CATEGORIES, PROPERTY_TYPES_MAP, PURCHASE_TIMELINES, PURCHASE_TYPES, QUALIFICATION_PURPOSES,
} from "@/lib/lead-constants";
import { parseIndianCurrency } from "@/lib/indian-currency";
import { searchProjects } from "@/lib/project-search";
import type { DuplicateLeadInfo } from "@/lib/lead-import";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const SELECT = cn(FOCUS_FIELD, "h-9! rounded-md! border-border! text-[14px]!");
const INPUT = cn(FOCUS_FIELD, "h-9");

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const STEPS = [
  { key: "customer", label: "Customer" },
  { key: "source", label: "Source" },
  { key: "requirement", label: "Requirement" },
  { key: "preferences", label: "Preferences" },
  { key: "followup", label: "Follow-up" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

type Prefs = Partial<Record<"minBudget" | "maxBudget" | "bhk" | "furnished" | "floorNumber" | "facing" | "minArea" | "maxArea", string>>;

const EMPTY = {
  name: "", mobile: "", whatsapp: "", email: "", city: "", address: "",
  source: "", otherSource: "", commission: "", commissionRemarks: "",
  isReferral: false, referredByName: "", referredByContact: "",
  purchaseType: "", category: "", propertyType: "", funder: "",
  cityId: "", subLocations: [] as string[], project: "",
  timeline: "", purpose: "", decisionMaker: "",
  prefs: {} as Prefs,
  followUp: undefined as Date | undefined, priority: "", notes: "",
  /** "me", "queue" or a staff id. */
  assignee: "",
};
type Form = typeof EMPTY;
type Errors = Partial<Record<string, string>>;

const digits = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 13 && d.startsWith("091")) return d.slice(3);
  return d;
};

/** What's missing on each step; an empty object means the step is done. */
function check(step: StepKey, f: Form, isStaff: boolean): Errors {
  const e: Errors = {};
  if (step === "customer") {
    if (!f.name.trim()) e.name = "Enter the customer's name.";
    if (digits(f.mobile).length < 10) e.mobile = "Enter a 10-digit mobile number.";
    if (f.whatsapp.trim() && digits(f.whatsapp).length < 10) e.whatsapp = "Enter a 10-digit number, or leave it empty.";
    if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "This doesn't look like an email address.";
    if (!f.city) e.city = "Pick the customer's city.";
  }
  if (step === "source") {
    if (!f.source) e.source = "Pick where this lead came from.";
    if (f.source === "others" && !f.otherSource.trim()) e.otherSource = "Name the source.";
    if (f.isReferral && !f.referredByName.trim()) e.referredByName = "Who referred them?";
    if (f.isReferral && digits(f.referredByContact).length < 10) e.referredByContact = "Enter their 10-digit number.";
  }
  if (step === "requirement") {
    if (!f.purchaseType) e.purchaseType = "Pick a purchase type.";
    if (!f.category) e.category = "Pick a property category.";
    if (!f.propertyType) e.propertyType = "Pick a property type.";
    if (!f.funder) e.funder = "Pick how it will be funded.";
  }
  if (step === "followup") {
    if (f.followUp && f.followUp.getTime() - Date.now() > 45 * 86_400_000) e.followUp = "Pick a date within the next 45 days.";
    if (!isStaff && !f.assignee) e.assignee = "Pick who handles this lead.";
  }
  return e;
}

/**
 * Creating a lead, step by step in a full-screen form: customer, source,
 * requirement, preferences, then the first follow-up and who it goes to.
 */
export function NewLeadModal({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new lead's id (or null when it went to the routing queue). */
  onCreated?: (leadId: number | null, toQueue: boolean) => void;
}) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [active, setActive] = useState<StepKey>("customer");
  const [visited, setVisited] = useState<Set<StepKey>>(() => new Set(["customer"]));
  const [showErrors, setShowErrors] = useState<Set<StepKey>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);

  const [user] = useState<{ id?: number; role?: { name?: string } | string } | null>(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem("crm_user") ?? "null"); } catch { return null; }
  });
  const [cities, setCities] = useState<{ id: number; city_name: string }[] | null>(null);
  const [sources, setSources] = useState<{ label: string; value: string }[] | null>(null);
  const [localities, setLocalities] = useState<{ id: number; locality_name: string }[]>([]);
  const [staff, setStaff] = useState<{ id: number; name: string; department?: { name?: string } }[] | null>(null);

  const role = typeof user?.role === "string" ? user.role : user?.role?.name;
  const isStaff = role === "Staff";

  // Fresh form each time it opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(EMPTY);
      setActive("customer");
      setVisited(new Set(["customer"]));
      setShowErrors(new Set());
    }
  }

  useEffect(() => {
    if (!open) return;
    let live = true;
    Promise.all([
      apiFetch(`${API_URL}/leads/cities`).then((r) => r.json()),
      apiFetch(`${API_URL}/master/lead-sources`).then((r) => r.json()),
    ])
      .then(([c, s]) => {
        if (!live) return;
        setCities(c.success ? c.data : []);
        setSources([...(s.success ? s.data : []), { label: "Others", value: "others" }]);
      })
      .catch(() => { if (live) { setCities([]); setSources([{ label: "Others", value: "others" }]); toast.error("Couldn't load cities and sources."); } });
    return () => { live = false; };
  }, [open]);

  // Managers pick from their team; staff choose themselves or the queue.
  useEffect(() => {
    if (!open || !user || isStaff) return;
    let live = true;
    apiFetch(`${API_URL}/lead-routing/staff-list?department=all`)
      .then((r) => r.json())
      .then((d) => { if (live) setStaff(d.success ? d.data : []); })
      .catch(() => { if (live) setStaff([]); });
    return () => { live = false; };
  }, [open, user, isStaff]);

  useEffect(() => {
    if (!form.cityId) return;
    let live = true;
    apiFetch(`${API_URL}/leads/sublocations?city_id=${form.cityId}`)
      .then((r) => r.json())
      .then((d) => { if (live && d.success) setLocalities(d.data); })
      .catch(() => {});
    return () => { live = false; };
  }, [form.cityId]);

  // Warn (don't block) when the mobile number already belongs to a lead.
  const debouncedMobile = useDebounce(form.mobile, 500);
  const [dupe, setDupe] = useState<{ mobile: string; lead: DuplicateLeadInfo | null } | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    const mobile = digits(debouncedMobile);
    if (mobile.length < 10) return;
    const n = ++seq.current;
    apiFetch(`${API_URL}/leads/check-mobile?mobile=${encodeURIComponent(mobile)}`)
      .then((r) => r.json())
      .then((d) => { if (seq.current === n) setDupe({ mobile, lead: d.success && d.exists ? d.lead : null }); })
      .catch(() => {});
  }, [debouncedMobile]);
  const currentDupe = dupe && dupe.mobile === digits(form.mobile) ? dupe.lead : null;
  const checkingMobile = digits(form.mobile).length >= 10 && dupe?.mobile !== digits(form.mobile);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setPref = (key: keyof Prefs, value: string) => setForm((f) => ({ ...f, prefs: { ...f.prefs, [key]: value } }));

  const errorsFor = (step: StepKey) => check(step, form, isStaff);
  const valid = (step: StepKey) => Object.keys(errorsFor(step)).length === 0;
  const errors = showErrors.has(active) ? errorsFor(active) : {};
  const index = STEPS.findIndex((s) => s.key === active);
  const last = index === STEPS.length - 1;

  const steps = useMemo(
    () => STEPS.map((s, i) => ({ ...s, status: stepStatus(i, index, visited.has(s.key) && Object.keys(check(s.key, form, isStaff)).length === 0) })),
    [index, visited, form, isStaff],
  );

  const go = (key: StepKey) => {
    setActive(key);
    setVisited((v) => new Set(v).add(key));
  };
  const flag = (key: StepKey) => setShowErrors((s) => new Set(s).add(key));

  // Moving forward needs every earlier step filled in; going back is always fine.
  const jump = (key: StepKey) => {
    const target = STEPS.findIndex((s) => s.key === key);
    const blocked = STEPS.slice(0, target).find((s) => !valid(s.key));
    if (blocked && target > index) {
      flag(blocked.key);
      go(blocked.key);
      return;
    }
    go(key);
  };

  const next = () => {
    if (!valid(active)) return flag(active);
    if (!last) go(STEPS[index + 1].key);
    else void submit();
  };

  const submit = async () => {
    const invalid = STEPS.find((s) => !valid(s.key));
    if (invalid) {
      flag(invalid.key);
      go(invalid.key);
      return;
    }
    setSubmitting(true);
    try {
      let source = form.source;
      if (source === "others") {
        const res = await apiFetch(`${API_URL}/master/lead-sources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.otherSource.trim() }),
        });
        const created = await res.json();
        if (created.success) source = created.data.value;
      }
      const assignee = isStaff ? (form.assignee === "queue" ? null : user?.id ?? null) : form.assignee === "queue" ? null : Number(form.assignee);
      const prefs: Record<string, unknown> = Object.fromEntries(Object.entries(form.prefs).filter(([, v]) => v !== "" && v != null));
      if (prefs.minBudget) prefs.minBudget = parseIndianCurrency(String(prefs.minBudget));
      if (prefs.maxBudget) prefs.maxBudget = parseIndianCurrency(String(prefs.maxBudget));
      const city = cities?.find((c) => String(c.id) === form.city)?.city_name ?? "";

      const res = await apiFetch(`${API_URL}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: assignee,
          name: form.name.trim(),
          mobile: form.mobile.trim(),
          email: form.email.trim(),
          whatsapp: form.whatsapp.trim(),
          city,
          address: form.address.trim(),
          source,
          project: form.project || null,
          purchaseType: form.purchaseType,
          propertyCategory: form.category,
          propertyType: form.propertyType,
          funder: form.funder,
          preferences: prefs,
          cityId: form.cityId ? Number(form.cityId) : null,
          subLocations: form.subLocations.length ? form.subLocations : null,
          purchaseTimeline: form.timeline,
          qualificationPurpose: form.purpose,
          decisionMaker: form.decisionMaker,
          followUpDate: form.followUp ? format(form.followUp, "yyyy-MM-dd") : null,
          followUpTime: form.followUp ? format(form.followUp, "HH:mm") : null,
          priority: form.priority,
          notes: form.notes.trim(),
          commission: form.commission ? parseFloat(form.commission) : null,
          commissionRemarks: form.commissionRemarks.trim(),
          isReferral: form.isReferral,
          referredByName: form.isReferral ? form.referredByName.trim() : "",
          referredByContact: form.isReferral ? form.referredByContact.trim() : "",
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(Array.isArray(result.message) ? result.message[0] : result.message || "Couldn't create the lead");

      if (result.isExistingCustomer) {
        toast.success("Requirement added to an existing customer", {
          description: `This number already belongs to a customer, so the requirement was logged on their profile. Assigned to ${result.existingStaff ?? "nobody yet"}.`,
          duration: 6000,
        });
      } else {
        toast.success("Lead created.");
      }
      onOpenChange(false);
      onCreated?.(result.data?.id ?? null, assignee === null && !result.isExistingCustomer);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't create the lead");
    } finally {
      setSubmitting(false);
    }
  };

  const loading = <div className={cn(INPUT, "flex items-center border")}><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  const types = form.category ? PROPERTY_TYPES_MAP[form.category] ?? [] : [];
  const assigneeOptions = isStaff
    ? [{ label: "Assign to me", value: "me" }, { label: "Routing queue (unassigned)", value: "queue" }]
    : [{ label: "Routing queue (unassigned)", value: "queue" }, ...(staff ?? []).map((s) => ({ label: s.department?.name ? `${s.name} · ${s.department.name}` : s.name, value: String(s.id) }))];

  let body: ReactNode = null;
  if (active === "customer") {
    body = (
      <FocusSection title="Customer" description="Who the lead is and how to reach them.">
        <FieldRow>
          <FocusField label="Name" htmlFor="nl-name" error={errors.name}>
            <Input id="nl-name" autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Priya Raman" aria-invalid={!!errors.name} className={INPUT} />
          </FocusField>
          <FocusField
            label="Mobile"
            htmlFor="nl-mobile"
            error={errors.mobile}
            hint={checkingMobile ? (
              <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for an existing lead…</span>
            ) : currentDupe ? (
              <span className="text-amber-700 dark:text-amber-400">
                Already a lead: <Link href={`/leads/${currentDupe.id}`} target="_blank" className="font-medium underline underline-offset-2">{currentDupe.displayId} {currentDupe.name}</Link>
                {currentDupe.staff ? ` · ${currentDupe.staff}` : ""}. Creating adds this requirement to them.
              </span>
            ) : undefined}
          >
            <Input id="nl-mobile" inputMode="tel" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="98765 43210" aria-invalid={!!errors.mobile} className={INPUT} />
          </FocusField>
        </FieldRow>
        <FieldRow>
          <FocusField label="WhatsApp" htmlFor="nl-wa" optional error={errors.whatsapp}>
            <Input id="nl-wa" inputMode="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="Same as mobile if empty" className={INPUT} />
          </FocusField>
          <FocusField label="Email" htmlFor="nl-email" optional error={errors.email}>
            <Input id="nl-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="priya@example.com" className={INPUT} />
          </FocusField>
        </FieldRow>
        <FieldRow>
          <FocusField label="City" error={errors.city}>
            {cities === null ? loading : (
              <FormSelect name="city" placeholder="Select city" className={SELECT} value={form.city || null}
                options={cities.map((c) => ({ label: c.city_name, value: String(c.id) }))}
                onValueChange={(v) => setForm((f) => ({ ...f, city: v, cityId: f.cityId || v, subLocations: f.cityId ? f.subLocations : [] }))} />
            )}
          </FocusField>
        </FieldRow>
        <FocusField label="Address" htmlFor="nl-address" optional>
          <Textarea id="nl-address" rows={3} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Door number, street, area" className={cn(FOCUS_FIELD, "min-h-20 resize-y py-2")} />
        </FocusField>
      </FocusSection>
    );
  } else if (active === "source") {
    body = (
      <>
        <FocusSection title="Source" description="Where the lead came from and the commission on it.">
          <FieldRow>
            <FocusField label="Lead source" error={errors.source}>
              {sources === null ? loading : (
                <FormSelect name="source" placeholder="Select source" className={SELECT} value={form.source || null} options={sources} onValueChange={(v) => set("source", v)} />
              )}
            </FocusField>
            {form.source === "others" && (
              <FocusField label="Source name" htmlFor="nl-other" error={errors.otherSource} hint="Added to the source list for next time.">
                <Input id="nl-other" autoFocus value={form.otherSource} onChange={(e) => set("otherSource", e.target.value)} placeholder="e.g. Hoarding, OMR" className={INPUT} />
              </FocusField>
            )}
          </FieldRow>
          <FieldRow>
            <FocusField label="Commission" htmlFor="nl-comm" optional info="Percentage agreed on this deal.">
              <div className="relative">
                <Input id="nl-comm" type="number" step="0.1" min="0" value={form.commission} onChange={(e) => set("commission", e.target.value)} placeholder="1.5" className={cn(INPUT, "pr-8")} />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[14px] text-muted-foreground">%</span>
              </div>
            </FocusField>
          </FieldRow>
          <FocusField label="Commission remarks" htmlFor="nl-remarks" optional>
            <Textarea id="nl-remarks" rows={2} value={form.commissionRemarks} onChange={(e) => set("commissionRemarks", e.target.value)} placeholder="Split with co-broker, negotiable on closing…" className={cn(FOCUS_FIELD, "min-h-16 resize-y py-2")} />
          </FocusField>
        </FocusSection>
        <FocusSection title="Referral">
          <ToggleCard
            checked={form.isReferral}
            onCheckedChange={(v) => set("isReferral", v)}
            title="Yes, someone referred this lead"
            description="When on, we'll note who referred them and how to reach them."
          >
            <FieldRow>
              <FocusField label="Referred by" htmlFor="nl-ref" error={errors.referredByName}>
                <Input id="nl-ref" value={form.referredByName} onChange={(e) => set("referredByName", e.target.value)} placeholder="Karthik S" className={INPUT} />
              </FocusField>
              <FocusField label="Their contact" htmlFor="nl-refc" error={errors.referredByContact}>
                <Input id="nl-refc" inputMode="tel" value={form.referredByContact} onChange={(e) => set("referredByContact", e.target.value)} placeholder="98400 12345" className={INPUT} />
              </FocusField>
            </FieldRow>
          </ToggleCard>
        </FocusSection>
      </>
    );
  } else if (active === "requirement") {
    body = (
      <>
        <FocusSection title="Requirement" description="What the customer wants to buy or rent.">
          <FieldRow>
            <FocusField label="Purchase type" error={errors.purchaseType}>
              <FormSelect name="purchaseType" placeholder="Select" className={SELECT} value={form.purchaseType || null} options={PURCHASE_TYPES} onValueChange={(v) => set("purchaseType", v)} />
            </FocusField>
            <FocusField label="Funding" error={errors.funder}>
              <FormSelect name="funder" placeholder="Select" className={SELECT} value={form.funder || null} options={FUNDERS} onValueChange={(v) => set("funder", v)} />
            </FocusField>
          </FieldRow>
          <FieldRow>
            <FocusField label="Property category" error={errors.category}>
              <FormSelect name="category" placeholder="Select" className={SELECT} value={form.category || null} options={PROPERTY_CATEGORIES}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v, propertyType: "" }))} />
            </FocusField>
            <FocusField label="Property type" error={errors.propertyType}>
              <FormSelect name="propertyType" placeholder={form.category ? "Select" : "Pick a category first"} className={SELECT} disabled={!form.category}
                value={form.propertyType || null} options={types} onValueChange={(v) => set("propertyType", v)} />
            </FocusField>
          </FieldRow>
          <FocusField label="Project" optional hint="Projects listed on the website. Type a name if it isn't there.">
            <SearchCombobox value={form.project} onChange={(v) => set("project", v)} search={searchProjects} placeholder="Search projects…" className={cn(FOCUS_FIELD, "h-9")} />
          </FocusField>
        </FocusSection>
        <FocusSection title="Location">
          <FieldRow>
            <FocusField label="Looking in" optional>
              {cities === null ? loading : (
                <FormSelect name="cityId" placeholder="Select city" className={SELECT} value={form.cityId || null}
                  options={cities.map((c) => ({ label: c.city_name, value: String(c.id) }))}
                  onValueChange={(v) => setForm((f) => ({ ...f, cityId: v, subLocations: [] }))} />
              )}
            </FocusField>
          </FieldRow>
          {form.cityId && (
            <FocusField label="Localities" optional>
              {localities.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {localities.map((l) => {
                    const on = form.subLocations.includes(l.locality_name);
                    return (
                      <button
                        key={l.locality_name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("subLocations", on ? form.subLocations.filter((x) => x !== l.locality_name) : [...form.subLocations, l.locality_name])}
                        className={cn(
                          "h-7 rounded-md border px-2.5 text-[13px] transition-colors",
                          on ? "border-foreground bg-foreground text-background" : "bg-muted/40 text-foreground/80 hover:bg-muted dark:bg-white/[0.04]",
                        )}
                      >
                        {l.locality_name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">No localities for this city yet.</p>
              )}
            </FocusField>
          )}
        </FocusSection>
        <FocusSection title="Buyer">
          <FieldRow cols={3}>
            <FocusField label="Timeline" optional>
              <FormSelect name="timeline" placeholder="Select" className={SELECT} value={form.timeline || null} options={PURCHASE_TIMELINES} onValueChange={(v) => set("timeline", v)} />
            </FocusField>
            <FocusField label="Purpose" optional>
              <FormSelect name="purpose" placeholder="Select" className={SELECT} value={form.purpose || null} options={QUALIFICATION_PURPOSES} onValueChange={(v) => set("purpose", v)} />
            </FocusField>
            <FocusField label="Decision maker" optional>
              <FormSelect name="decisionMaker" placeholder="Select" className={SELECT} value={form.decisionMaker || null} options={DECISION_MAKERS} onValueChange={(v) => set("decisionMaker", v)} />
            </FocusField>
          </FieldRow>
        </FocusSection>
      </>
    );
  } else if (active === "preferences") {
    const p = form.prefs;
    body = (
      <FocusSection title="Preferences" description="Optional details that help match the right properties.">
        <FieldRow>
          <FocusField label="Min budget" optional>
            <PriceInput value={p.minBudget ?? ""} onChange={(v) => setPref("minBudget", v)} placeholder="e.g. 50L" className={INPUT} />
          </FocusField>
          <FocusField label="Max budget" optional>
            <PriceInput value={p.maxBudget ?? ""} onChange={(v) => setPref("maxBudget", v)} placeholder="e.g. 1.2Cr" className={INPUT} />
          </FocusField>
        </FieldRow>
        {form.category === "residential" && (
          <>
            <FieldRow>
              <FocusField label="BHK" optional>
                <FormSelect name="bhk" placeholder="Select" className={SELECT} value={p.bhk || null} options={BHK_OPTIONS} onValueChange={(v) => setPref("bhk", v)} />
              </FocusField>
              <FocusField label="Furnishing" optional>
                <FormSelect name="furnished" placeholder="Select" className={SELECT} value={p.furnished || null} options={FURNISHING_OPTIONS} onValueChange={(v) => setPref("furnished", v)} />
              </FocusField>
            </FieldRow>
            <FieldRow>
              <FocusField label="Floor" htmlFor="nl-floor" optional>
                <Input id="nl-floor" value={p.floorNumber ?? ""} onChange={(e) => setPref("floorNumber", e.target.value)} placeholder="Ground, 1st, High" className={INPUT} />
              </FocusField>
              <FocusField label="Facing" optional>
                <FormSelect name="facing" placeholder="Select" className={SELECT} value={p.facing || null} options={FACING_OPTIONS} onValueChange={(v) => setPref("facing", v)} />
              </FocusField>
            </FieldRow>
          </>
        )}
        {AREA_CATEGORIES.includes(form.category) && (
          <FieldRow>
            <FocusField label="Min area" htmlFor="nl-mina" optional>
              <Input id="nl-mina" type="number" min="0" value={p.minArea ?? ""} onChange={(e) => setPref("minArea", e.target.value)} placeholder="sq ft" className={INPUT} />
            </FocusField>
            <FocusField label="Max area" htmlFor="nl-maxa" optional>
              <Input id="nl-maxa" type="number" min="0" value={p.maxArea ?? ""} onChange={(e) => setPref("maxArea", e.target.value)} placeholder="sq ft" className={INPUT} />
            </FocusField>
          </FieldRow>
        )}
        {!form.category && (
          <p className="rounded-lg border border-dashed px-4 py-3 text-[14px] text-muted-foreground">
            Pick a property category on the Requirement step to add BHK, facing or area.
          </p>
        )}
      </FocusSection>
    );
  } else {
    body = (
      <>
        <FocusSection title="First follow-up" description="When to get back to them, and anything to remember.">
          <FieldRow>
            <FocusField label="Next follow-up" optional error={errors.followUp}>
              <DateTimePicker value={form.followUp} onChange={(d) => set("followUp", d)} placeholder="Pick date & time" className={cn(FOCUS_FIELD, "h-9 w-full justify-start border")} />
            </FocusField>
            <FocusField label="Priority" optional>
              <FormSelect name="priority" placeholder="Select" className={SELECT} value={form.priority || null} options={PRIORITIES} onValueChange={(v) => set("priority", v)} />
            </FocusField>
          </FieldRow>
          <FocusField label="Notes" htmlFor="nl-notes" optional>
            <Textarea id="nl-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="What did they ask about?" className={cn(FOCUS_FIELD, "min-h-20 resize-y py-2")} />
          </FocusField>
        </FocusSection>
        <FocusSection title="Assignment" description="Who works this lead. The routing queue lets a team lead hand it out later.">
          <FieldRow>
            <FocusField label="Assign to" error={errors.assignee}>
              {!isStaff && staff === null ? loading : (
                <FormSelect name="assignee" placeholder="Select" className={SELECT}
                  value={form.assignee || (isStaff ? "me" : null)} options={assigneeOptions} onValueChange={(v) => set("assignee", v)} />
              )}
            </FocusField>
          </FieldRow>
        </FocusSection>
      </>
    );
  }

  return (
    <FocusModal
      open={open}
      onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}
      title="New lead"
      steps={steps}
      active={active}
      onStepChange={(k) => jump(k as StepKey)}
      footer={
        <>
          <button type="button" className={FOCUS_BUTTON.secondary} onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</button>
          {index > 0 && (
            <button type="button" className={FOCUS_BUTTON.secondary} onClick={() => go(STEPS[index - 1].key)} disabled={submitting}>Back</button>
          )}
          <button type="button" className={last ? FOCUS_BUTTON.primary : FOCUS_BUTTON.secondary} onClick={next} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {last ? (submitting ? "Creating…" : "Create lead") : "Continue"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => { e.preventDefault(); next(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); next(); }
        }}
      >
        {body}
        {/* Enter in a text field moves on, like pressing Continue. */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </FocusModal>
  );
}
