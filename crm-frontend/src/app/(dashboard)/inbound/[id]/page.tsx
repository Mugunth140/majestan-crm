"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Database, ExternalLink, History, ImageIcon, Info, Loader2, Lock, MapPin, MessagesSquare, Plus, Upload, Wallet, X,
} from "lucide-react";
import { apiFetch, apiJson } from "@/lib/api-fetch";
import { canViewInboundContacts } from "@/lib/permissions";
import { sortContactLogs } from "@/lib/contact-log-utils";
import { formatIndianCurrencyShort, parseIndianCurrency } from "@/lib/indian-currency";
import { INBOUND_STATUS_OPTIONS } from "@/lib/inbound-status";
import {
  ADVANCE_MONTHS, BHK_CHOICES, BROKERAGE_ACCEPTED, BROKERAGE_PAYERS, BROKERAGE_TYPES, INBOUND_CATEGORIES, INBOUND_PURPOSES, INDIAN_STATES,
  INBOUND_STATUSES, INBOUND_STATUS_TONES, INBOUND_TYPES, KEY_HOLDERS, PRIMARY_CONTACTS, SPECIAL_PURPOSES,
  hasBhk, hasFloor, hasFloorPricing, inboundErrorMessage, normalizeCategoryAndType, parseInboundPrice, typeLabel,
} from "@/lib/inbound-form";
import { statusDot, statusPillClass } from "@/components/tables/cells";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MobileHeader } from "@/components/layout/mobile-header";
import { PageActions } from "@/components/layout/page-actions";
import { FieldRow, InlineMulti, InlineSelect, InlineText, Section, type Option } from "@/components/record/inline-field";
import { Feed, TabHeader } from "@/components/record/feed";
import { AssigneeButton, HEADER_BUTTON, StatusMenu, type StatusOption } from "@/components/record/header-actions";
import { ScoreRing } from "@/components/record/score-ring";
import { activityItems, type ActivityEntry } from "@/components/record/activity";
import { INBOUND_ACTIVITY } from "@/components/inbound/inbound-activity";
import { INBOUND_ENTITY, LeadConversation } from "@/components/record/conversation";
import { FollowUpComposer } from "@/components/record/follow-up-composer";
import { AttachmentsArt, EmptyState } from "@/components/record/empty-state";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type Tab = "activity" | "conversation" | "data" | "pricing" | "photo";
type Inbound = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Patch = Record<string, unknown>;

const YES_NO: Option[] = [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }];
const yesNo = (v: unknown) => (v ? "yes" : "no");

const inboundCode = (i: Inbound) => i.property_id || `IN${String(i.id).padStart(5, "0")}`;
const rupees = (v: unknown) => (v == null || v === "" ? "" : Number(v) === 0 ? "0" : formatIndianCurrencyShort(Number(v)));

function PageSkeleton() {
  return (
    <div className="flex flex-col md:h-full md:flex-row lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden h-11 items-center gap-5 border-b px-5 md:flex">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-4 w-20" />)}
        </div>
        <div className="space-y-6 p-4 md:p-10">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full max-w-lg rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden w-[340px] shrink-0 border-l md:block xl:w-[360px]">
        <div className="flex items-center gap-3 border-b p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
        </div>
        <div className="space-y-3 p-4">{[...Array(9)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count, className }: {
  active: boolean; onClick: () => void; icon: typeof Info; label: string; count?: number; className?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-colors md:h-11 md:rounded-none md:px-0.5",
        active
          ? "bg-[#017D58] text-white dark:bg-[#2FB585] dark:text-black md:bg-transparent md:text-foreground md:dark:bg-transparent md:dark:text-foreground"
          : "bg-foreground/[0.06] text-foreground/80 md:bg-transparent md:text-muted-foreground md:hover:text-foreground",
        className,
      )}
    >
      <Icon className="hidden h-4 w-4 md:block" />
      {label}
      {count ? (
        <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums", active ? "bg-white/20 md:bg-foreground/[0.08]" : "bg-foreground/[0.08]")}>{count}</span>
      ) : null}
      {active && <span aria-hidden className="absolute inset-x-0 -bottom-px hidden h-0.5 rounded-full bg-foreground md:block" />}
    </button>
  );
}

/** A value the viewer isn't allowed to see. */
function Restricted({ label }: { label: string }) {
  return (
    <FieldRow label={label}>
      <span className="flex h-8 items-center gap-1.5 px-2 text-[13px] text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Restricted</span>
    </FieldRow>
  );
}

/** One group of fields on the Data tab, two columns wide on desktop. */
function DataCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="@container overflow-hidden rounded-xl border bg-card">
      <h3 className="flex h-11 items-center border-b px-4 text-[14px] font-semibold text-foreground">{title}</h3>
      <div className="grid gap-x-8 px-3 py-2 @xl:grid-cols-2 md:px-4">{children}</div>
    </section>
  );
}

function InboundDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [inbound, setInbound] = useState<Inbound | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("activity");
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [mailRefresh, setMailRefresh] = useState(0);
  const [cities, setCities] = useState<Option[]>([]);
  const [localities, setLocalities] = useState<{ city: string; options: Option[] } | null>(null);
  const [staff, setStaff] = useState<{ canAssign: boolean; people: { id: number; name: string }[] }>({ canAssign: false, people: [] });
  const [photoOpen, setPhotoOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const canSeeContacts = canViewInboundContacts();
  // Editing or deleting someone's follow-up is for admins, as on the lead page.
  const [isAdmin] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("crm_user") || "{}");
      return ["Admin", "Super Admin"].includes(u?.role?.name || u?.role);
    } catch { return false; }
  });

  // Loads (and later reloads) the inbound; the skeleton shows only the first time.
  const loadInbound = useCallback(async (): Promise<Inbound | null> => {
    try {
      const res = await apiFetch(`${API_URL}/inbounds/${id}`);
      const result = await res.json();
      const data = result?.data ?? result;
      if (res.ok && data?.id) return data;
      toast.error("Inbound not found");
      router.push("/inbound");
    } catch {
      toast.error("Failed to load the inbound");
    }
    return null;
  }, [id, router]);
  // The Activity history; an older backend without it just shows none.
  const loadActivity = useCallback(
    () => apiJson<{ data?: ActivityEntry[] }>(`${API_URL}/inbounds/${id}/activity`).then((r) => r.data ?? [], () => []),
    [id],
  );
  const refreshActivity = useCallback(() => { void loadActivity().then(setActivity); }, [loadActivity]);
  const fetchInbound = useCallback(() => loadInbound().then((data) => { if (data) setInbound(data); }), [loadInbound]);

  useEffect(() => {
    let live = true;
    loadInbound().then((data) => {
      if (!live) return;
      if (data) setInbound(data);
      setIsLoading(false);
    });
    loadActivity().then((entries) => { if (live) setActivity(entries); });
    return () => { live = false; };
  }, [loadInbound, loadActivity]);

  useEffect(() => {
    let live = true;
    apiFetch(`${API_URL}/master/cities`).then((r) => r.json()).then((d) => { if (live && d.success) setCities(d.data); }).catch(() => {});
    apiJson<{ canAssign?: boolean; data?: { id: number; name: string }[] }>(`${API_URL}/inbounds/staff-list`)
      .then((r) => { if (live) setStaff({ canAssign: !!r.canAssign, people: r.data ?? [] }); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const city: string | undefined = inbound?.city;
  useEffect(() => {
    if (!city) return;
    let live = true;
    apiFetch(`${API_URL}/master/sublocations?city_name=${encodeURIComponent(city)}`)
      .then((r) => r.json())
      .then((d) => { if (live && d.success) setLocalities({ city, options: d.data }); })
      .catch(() => {});
    return () => { live = false; };
  }, [city]);

  // A switches between Activity and Conversation, as on the lead page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (e.key.toLowerCase() === "a" && !e.metaKey && !e.ctrlKey && !e.altKey && el?.tagName !== "INPUT" && el?.tagName !== "TEXTAREA" && !el?.isContentEditable) {
        e.preventDefault();
        setActiveTab((prev) => (prev === "conversation" ? "activity" : "conversation"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Saves some fields in place. Only the changed fields are taken from the reply, so masked contacts stay masked. */
  const save = async (patch: Patch) => {
    try {
      const res = await apiFetch(`${API_URL}/inbounds/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(inboundErrorMessage(result) || "Couldn't save the change");
      const saved = result?.data ?? result ?? {};
      setInbound((prev) => prev && {
        ...prev,
        ...Object.fromEntries(Object.keys(patch).map((k) => [k, k in saved ? saved[k] : patch[k]])),
        quality_score: saved.quality_score ?? prev.quality_score,
        updated_at: saved.updated_at ?? prev.updated_at,
      });
      toast.success("Saved");
      refreshActivity();
      if ("status" in patch) setMailRefresh((n) => n + 1); // an approval can draft an email
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't save the change");
      throw reason;
    }
  };
  const saveText = (key: string, number = false) => (v: string) =>
    save({ [key]: v.trim() === "" ? null : number ? Number(v) : v.trim() });
  const readPrice = (v: string) => {
    try {
      return parseInboundPrice(v);
    } catch (error) {
      toast.error("Enter a valid price.");
      throw error;
    }
  };

  const followUps = useMemo(() => inbound?.follow_ups ?? [], [inbound]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API rows, as on the lead page
  const contactLogs: any[] = useMemo(() => sortContactLogs(inbound?.contact_logs ?? []), [inbound]);
  const activityFeed = useMemo(() => activityItems(activity ?? [], INBOUND_ACTIVITY), [activity]);

  if (isLoading) return <PageSkeleton />;
  if (!inbound) return null;

  const normalized = normalizeCategoryAndType(inbound.property_category ?? null, inbound.property_type ?? null);
  const category = normalizeCategoryAndType(inbound.property_category ?? null, null).category ?? normalized.category;
  const type = normalized.type;
  const status: string = inbound.status || "New Inbound";
  const statusOptions: Option[] = [...(INBOUND_STATUSES.includes(status) ? [] : [status]), ...INBOUND_STATUSES]
    .map((s) => ({ label: s, value: s, dot: statusDot(s, INBOUND_STATUS_TONES[s]) }));
  const assignee = staff.people.find((p) => p.id === inbound.assigned_staff_id)?.name;
  const title: string = inbound.property_title || [typeLabel(type), inbound.locality || inbound.area, inbound.city].filter(Boolean).join(", ") || `Inbound ${inboundCode(inbound)}`;
  const rent = inbound.purpose === "Rent";
  const brokered = inbound.brokerage_accepted === "Yes" || inbound.brokerage_accepted === "Negotiable";
  const special: string[] = inbound.special_purpose ? String(inbound.special_purpose).split(",").map((s) => s.trim()).filter(Boolean) : [];
  const paidBy: string[] = Array.isArray(inbound.brokerage_paid_by) ? inbound.brokerage_paid_by : (() => {
    try { return JSON.parse(inbound.brokerage_paid_by || "[]"); } catch { return []; }
  })();
  const localityOptions = localities && localities.city === inbound.city ? localities.options : [];
  const hasMap = inbound.latitude != null && inbound.longitude != null;
  const units: { floor_label: string; area?: string | null; price?: number | null; notes?: string | null }[] = inbound.units ?? [];
  const saveUnits = (next: typeof units) => save({ units: next.map((u) => ({ floor_label: u.floor_label, area: u.area || null, price: u.price ?? null, notes: u.notes || null })) });

  const statusMenu = (size: "h-7" | "h-8", align: "start" | "end" = "end") => (
    <StatusMenu status={status} options={statusOptions as StatusOption[]} pillClass={statusPillClass(status, INBOUND_STATUS_TONES[status])}
      onChange={(v) => void save({ status: v }).catch(() => {})} size={size} align={align} />
  );

  const assign = async (staffId: number | null) => {
    try {
      await apiJson(`${API_URL}/inbounds/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inboundIds: [inbound.id], staffId }) });
      toast.success(staffId === null ? "Returned to the queue." : "Assigned.");
      setInbound((prev) => prev && { ...prev, assigned_staff_id: staffId, is_queued: staffId === null });
      refreshActivity();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Assignment failed");
      throw reason;
    }
  };
  const assigneeButton = (variant: "header" | "field" | "phone") => (
    <AssigneeButton name={assignee} empty={inbound.is_queued ? "In the queue" : "Unassigned"} variant={variant}
      people={staff.people} value={inbound.assigned_staff_id} onPick={staff.canAssign ? assign : undefined} clearLabel="Return to the queue" />
  );

  /** Latitude and longitude, checked before saving. */
  const saveCoordinate = (key: "latitude" | "longitude") => async (v: string) => {
    const n = Number(v.trim());
    const max = key === "latitude" ? 90 : 180;
    if (v.trim() && (!Number.isFinite(n) || Math.abs(n) > max)) {
      toast.error(`${key === "latitude" ? "Latitude" : "Longitude"} must be a number between -${max} and ${max}.`);
      throw new Error("invalid coordinate");
    }
    return save({ [key]: v.trim() ? n : null });
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return void toast.error("Photos must be 10 MB or smaller.");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await apiFetch(`${API_URL}/inbounds/${id}/image`, { method: "POST", body });
      if (!res.ok) throw new Error();
      toast.success("Photo uploaded.");
      void fetchInbound();
      refreshActivity();
    } catch {
      toast.error("The photo didn't upload.");
    } finally {
      setUploading(false);
    }
  };

  // ── Fields: a short summary in the side panel, everything on the Data tab ──
  const contact = (label: string, key: string, kind: "tel" | "email" | "text" = "tel", placeholder?: string) =>
    canSeeContacts
      ? <InlineText label={label} type={kind === "text" ? "text" : kind} value={inbound[key]} placeholder={placeholder} onSave={saveText(key)} />
      : <Restricted label={label} />;
  const added = new Date(inbound.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const assigneeField = <FieldRow label="Assigned to">{assigneeButton("field")}</FieldRow>;
  // A picker shows the current value even when it's no longer one of the options.
  const withCurrent = (options: Option[], value?: string | null) =>
    !value || options.some((o) => o.value === value) ? options : [{ label: value, value }, ...options];

  const summary = (
    <Section title="Details">
      <InlineSelect label="Status" value={status} options={statusOptions} onSave={(v) => save({ status: v })} />
      <InlineSelect label="Availability" value={inbound.inbound_status} options={INBOUND_STATUS_OPTIONS} onSave={(v) => save({ inbound_status: v })} />
      {assigneeField}
      <InlineText label="Owner" value={inbound.owner_name} onSave={saveText("owner_name")} />
      {contact("Mobile", "mobile_number")}
      <FieldRow label="Added"><span className="px-2 text-[14px] text-foreground">{added}</span></FieldRow>
    </Section>
  );

  const data: ReactNode = (
    <div className="pb-6">
      <TabHeader title="Data" />
      <div className="space-y-5 px-3 sm:px-10">
        <DataCard title="Property">
          <InlineText label="Title" value={inbound.property_title} placeholder={title} onSave={saveText("property_title")} />
          <InlineSelect label="Category" value={category} options={withCurrent(INBOUND_CATEGORIES, category)} onSave={(v) => save({ property_category: v })} />
          <InlineSelect label="Type" value={type} options={withCurrent((category && INBOUND_TYPES[category]) || [], type)} placeholder={category ? "Select…" : "Pick a category first"} disabled={!category} onSave={(v) => save({ property_type: v })} />
          {(hasBhk(category, type) || inbound.bhk) && <InlineSelect label="BHK" value={inbound.bhk} options={withCurrent(BHK_CHOICES, inbound.bhk)} onSave={(v) => save({ bhk: v })} />}
          <InlineSelect label="Purpose" value={inbound.purpose} options={withCurrent(INBOUND_PURPOSES, inbound.purpose)} onSave={(v) => save({ purpose: v })} />
          {(category === "commercial" || special.length > 0) && (
            <InlineMulti label="Suits" values={special} options={[...new Set([...SPECIAL_PURPOSES, ...special])].map((s) => ({ label: s, value: s }))} onSave={(v) => save({ special_purpose: v.length ? v.join(", ") : null })} />
          )}
          <InlineSelect label="Availability" value={inbound.inbound_status} options={INBOUND_STATUS_OPTIONS} onSave={(v) => save({ inbound_status: v })} />
          {assigneeField}
          <FieldRow label="Added"><span className="px-2 text-[14px] text-foreground">{added}</span></FieldRow>
        </DataCard>

        <DataCard title="Location">
          <InlineSelect searchable label="State" value={inbound.state} options={withCurrent(INDIAN_STATES, inbound.state)} onSave={(v) => save({ state: v })} />
          <InlineSelect searchable label="City" value={inbound.city} options={withCurrent(cities, inbound.city)} onSave={(v) => save({ city: v })} />
          <InlineSelect searchable label="Locality" value={inbound.locality} options={withCurrent(localityOptions, inbound.locality)}
            placeholder={inbound.city ? "Select…" : "Pick a city first"} disabled={!inbound.city} onSave={(v) => save({ locality: v })} />
          <InlineText label="Area" value={inbound.area} placeholder="1500 sq ft" onSave={saveText("area")} />
          <InlineText label="Landmark" value={inbound.landmark} onSave={saveText("landmark")} />
          <InlineText label="Latitude" type="number" value={inbound.latitude} placeholder="13.0827" onSave={saveCoordinate("latitude")} />
          <InlineText label="Longitude" type="number" value={inbound.longitude} placeholder="80.2707" onSave={saveCoordinate("longitude")} />
          {hasMap && (
            <FieldRow label="Map">
              <a href={`https://www.google.com/maps?q=${encodeURIComponent(`${inbound.latitude},${inbound.longitude}`)}`} target="_blank" rel="noopener noreferrer"
                className="flex h-8 items-center gap-1.5 px-2 text-[14px] font-medium text-[#017D58] hover:underline dark:text-[#2FB585]">
                Open in Maps <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </FieldRow>
          )}
        </DataCard>

        <DataCard title="Owner">
          <InlineText label="Name" value={inbound.owner_name} onSave={saveText("owner_name")} />
          {contact("Mobile", "mobile_number")}
          {contact("WhatsApp", "whatsapp_number")}
          {contact("Email", "email", "email")}
          {contact("Alternate no.", "alternate_contact")}
          {contact("Other contact", "alternative_contact", "text", "Name or details")}
          <InlineText label="Best time" value={inbound.preferred_contact_time} placeholder="e.g. 10:00" onSave={saveText("preferred_contact_time")} />
          {canSeeContacts ? <InlineText label="Address" multiline value={inbound.address} onSave={saveText("address")} /> : <Restricted label="Address" />}
          <InlineSelect label="PAN" value={yesNo(inbound.pan_available)} options={YES_NO} onSave={(v) => save({ pan_available: v === "yes" })} />
          <InlineSelect label="GST" value={yesNo(inbound.gst_applicable)} options={YES_NO} onSave={(v) => save({ gst_applicable: v === "yes" })} />
        </DataCard>

        <DataCard title="Access">
          <InlineSelect label="Visits via" value={inbound.primary_contact} options={PRIMARY_CONTACTS} onSave={(v) => save({ primary_contact: v })} />
          {inbound.primary_contact && inbound.primary_contact !== "Owner" && (
            <>
              <InlineText label={`${inbound.primary_contact}'s name`} value={inbound.primary_contact_name} onSave={saveText("primary_contact_name")} />
              {contact(`${inbound.primary_contact}'s no.`, "primary_contact_number")}
            </>
          )}
          <InlineSelect label="Keys with" value={inbound.key_available_with} options={KEY_HOLDERS} onSave={(v) => save({ key_available_with: v })} />
          {inbound.key_available_with && inbound.key_available_with !== "Owner" && inbound.key_available_with !== inbound.primary_contact && (
            <>
              <InlineText label="Key holder" value={inbound.key_contact_name} onSave={saveText("key_contact_name")} />
              {contact("Key holder no.", "key_contact_number")}
            </>
          )}
          <InlineSelect label="Appointment" value={yesNo(inbound.prior_appointment_required)} options={YES_NO} onSave={(v) => save({ prior_appointment_required: v === "yes" })} />
        </DataCard>

        <DataCard title="Brokerage">
          <InlineSelect label="Accepted" value={inbound.brokerage_accepted} options={BROKERAGE_ACCEPTED} onSave={(v) => save({ brokerage_accepted: v })} />
          {brokered && (
            <>
              <InlineSelect label="Type" value={inbound.brokerage_type} options={BROKERAGE_TYPES} onSave={(v) => save({ brokerage_type: v })} />
              {inbound.brokerage_type === "Percentage" && <InlineText label="Percentage" type="number" value={inbound.percentage} placeholder="2" onSave={saveText("percentage", true)} />}
              {inbound.brokerage_type === "Fixed" && <InlineText label="Amount" type="number" value={inbound.fixed_amount} placeholder="50000" onSave={saveText("fixed_amount", true)} />}
              {inbound.brokerage_type === "Days" && <InlineText label="Days of rent" type="number" value={inbound.brokerage_days} placeholder="15" onSave={saveText("brokerage_days", true)} />}
              <InlineMulti label="Paid by" values={paidBy} options={BROKERAGE_PAYERS.map((p) => ({ label: p, value: p }))} onSave={(v) => save({ brokerage_paid_by: v })} />
              <InlineText label="Remarks" multiline value={inbound.brokerage_remarks} onSave={saveText("brokerage_remarks")} />
            </>
          )}
        </DataCard>

        <DataCard title="Listing">
          <InlineSelect label="Exclusive" value={yesNo(inbound.is_exclusive)} options={YES_NO} onSave={(v) => save({ is_exclusive: v === "yes" })} />
          <InlineSelect label="Prime location" value={yesNo(inbound.is_prime_location)} options={YES_NO} onSave={(v) => save({ is_prime_location: v === "yes" })} />
          <InlineSelect label="Documents" value={yesNo(inbound.documents_collected)} options={[{ label: "Collected", value: "yes" }, { label: "Not yet", value: "no" }]} onSave={(v) => save({ documents_collected: v === "yes" })} />
        </DataCard>
      </div>
    </div>
  );

  const tabs: { key: Tab; label: string; icon: typeof Info; count?: number }[] = [
    { key: "activity", label: "Activity", icon: History },
    { key: "conversation", label: "Conversation", icon: MessagesSquare, count: followUps.length + contactLogs.length },
    { key: "data", label: "Data", icon: Database },
    { key: "pricing", label: "Pricing", icon: Wallet },
    { key: "photo", label: "Photo", icon: ImageIcon, count: inbound.image_url ? 1 : undefined },
  ];

  const pricing: ReactNode = (
    <div className="pb-6">
      <TabHeader title="Pricing" />
      <div className="space-y-5 px-3 sm:px-10">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="grid gap-x-8 px-3 py-2 md:grid-cols-2 md:px-4">
            <InlineSelect label="Purpose" value={inbound.purpose} options={withCurrent(INBOUND_PURPOSES, inbound.purpose)} onSave={(v) => save({ purpose: v })} />
            {(rent || inbound.total_rent != null) && <InlineText label="Monthly rent" value={rupees(inbound.total_rent)} placeholder="15000" onSave={(v) => save({ total_rent: readPrice(v) })} />}
            {(rent || inbound.rent_per_sqft != null) && <InlineText label="Rent / sq ft" type="number" value={inbound.rent_per_sqft} placeholder="25.5" onSave={saveText("rent_per_sqft", true)} />}
            {((inbound.purpose === "Sale" && category === "residential") || inbound.sale_price != null) && (
              <InlineText label="Sale price" value={rupees(inbound.sale_price)} placeholder="85L" onSave={(v) => save({ sale_price: readPrice(v) })} />
            )}
            {rent ? (
              <InlineSelect label="Advance" value={inbound.advance} options={withCurrent(ADVANCE_MONTHS, inbound.advance)} onSave={(v) => save({ advance: v })} />
            ) : inbound.purpose || inbound.advance ? (
              <InlineText label="Advance" value={inbound.advance && /^\d+$/.test(String(inbound.advance)) ? rupees(inbound.advance) : inbound.advance} placeholder="5L"
                onSave={(v) => save({ advance: v.trim() ? String(parseIndianCurrency(v) || v.trim()) : null })} />
            ) : null}
            {(hasFloor(type) || inbound.floor_number) && <InlineText label="Floor" value={inbound.floor_number} placeholder="Ground, 1st…" onSave={saveText("floor_number")} />}
          </div>
        </section>

        {(hasFloorPricing(category, type) || units.length > 0) && (
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex min-h-11 items-center gap-2 border-b px-4">
              <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">Floors</h3>
              <button type="button" onClick={() => saveUnits([...units, { floor_label: `Floor ${units.length + 1}` }]).catch(() => {})} className={cn(HEADER_BUTTON, "h-7 text-[13px]")}>
                <Plus className="h-3.5 w-3.5 text-muted-foreground" /> Add floor
              </button>
            </div>
            {units.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-muted-foreground">One price for the whole property. Add floors when each has its own price.</p>
            ) : (
              <ul className="divide-y">
                {units.map((u, i) => {
                  const update = (patch: Partial<(typeof units)[number]>) => saveUnits(units.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <li key={i} className="group grid gap-x-6 px-3 py-1.5 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center md:px-4">
                      <InlineText label="Floor" value={u.floor_label} onSave={(v) => (v.trim() ? update({ floor_label: v.trim() }) : undefined)} />
                      <InlineText label="Area" value={u.area} placeholder="1200 sq ft" onSave={(v) => update({ area: v.trim() || null })} />
                      <InlineText label={rent ? "Rent" : "Price"} value={rupees(u.price)} placeholder="50000" onSave={(v) => update({ price: readPrice(v) })} />
                      <button type="button" aria-label={`Remove ${u.floor_label}`} onClick={() => { if (confirm(`Remove ${u.floor_label}?`)) void saveUnits(units.filter((_, j) => j !== i)).catch(() => {}); }}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:opacity-0 md:group-hover:opacity-100">
                        <X className="h-4 w-4" />
                      </button>
                      <div className="md:col-span-4">
                        <InlineText label="Notes" value={u.notes} placeholder="Lift access, separate entrance…" onSave={(v) => update({ notes: v.trim() || null })} />
                      </div>
                    </li>
                  );
                })}
                {units.some((u) => u.price) && (
                  <li className="flex items-center justify-end gap-3 px-4 py-2.5 text-[13px] text-muted-foreground">
                    Total <span className="text-[14px] font-semibold text-foreground">{rupees(units.reduce((s, u) => s + (Number(u.price) || 0), 0))}</span>
                  </li>
                )}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );

  const uploadButton = (
    <button type="button" onClick={() => photoInput.current?.click()} disabled={uploading} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-60">
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {inbound.image_url ? "Replace photo" : "Upload photo"}
    </button>
  );
  const photo: ReactNode = (
    <div className="pb-6">
      <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={uploadPhoto} className="hidden" />
      <TabHeader title="Photo" action={uploadButton} />
      <div className="px-3 sm:px-10">
        {inbound.image_url ? (
          <button type="button" onClick={() => setPhotoOpen(true)} className="block overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element -- photos live on the CDN, not the Next image loader */}
            <img src={inbound.image_url} alt={title} className="max-h-[420px] w-auto object-contain" />
          </button>
        ) : (
          <EmptyState art={<AttachmentsArt />} title="No photo yet" hint="A clear photo of the front helps the team and buyers recognise the place. Its GPS position fills in the location." />
        )}
        {hasMap && (
          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {Number(inbound.latitude).toFixed(5)}, {Number(inbound.longitude).toFixed(5)}
            <a href={`https://www.google.com/maps?q=${encodeURIComponent(`${inbound.latitude},${inbound.longitude}`)}`} target="_blank" rel="noopener noreferrer" className="ml-1 font-medium text-[#017D58] hover:underline dark:text-[#2FB585]">
              Open in Maps
            </a>
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:h-full lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]">
      <MobileHeader title={title} showBack />

      <PageActions>
        <div className="flex items-center gap-2">
          {statusMenu("h-8")}
          {assigneeButton("header")}
        </div>
      </PageActions>

      {/* ── Phone summary ── */}
      <div className="space-y-3 px-4 pb-4 pt-1 md:hidden">
        <div className="flex items-center gap-3">
          <ScoreRing score={Number(inbound.quality_score) || 0} size={40} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
            {statusMenu("h-7", "start")}
            <span>{inboundCode(inbound)}</span>
          </div>
        </div>
        {assigneeButton("phone")}
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
          <div role="tablist" aria-label="Inbound sections"
            className="sticky top-[calc(env(safe-area-inset-top)+2.75rem)] z-20 flex shrink-0 gap-1.5 overflow-x-auto bg-background px-4 py-2 scrollbar-hide md:static md:gap-5 md:border-b md:px-5 md:py-0">
            {tabs.map((t) => (
              <TabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} icon={t.icon} label={t.label} count={t.count} />
            ))}
          </div>

          <div className={cn("md:min-h-0 md:flex-1", activeTab === "conversation" ? "md:flex md:flex-col" : "md:overflow-y-auto")}>
            {activeTab === "activity" && (
              <div className="pb-4">
                <TabHeader title="Activity" />
                {activity === null ? (
                  <p className="flex items-center gap-2 px-3 text-[13px] text-muted-foreground sm:px-10"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</p>
                ) : activityFeed.length ? (
                  <Feed items={activityFeed} />
                ) : (
                  <EmptyState art={<AttachmentsArt />} title="Nothing recorded yet" hint="Status changes, edits, assignments and photos will show up here." />
                )}
              </div>
            )}
            {activeTab === "data" && data}
            {activeTab === "conversation" && (
              <LeadConversation
                leadId={inbound.id}
                leadName={inbound.owner_name}
                entity={INBOUND_ENTITY}
                email={canSeeContacts ? inbound.email : null}
                mobile={canSeeContacts ? inbound.mobile_number : null}
                whatsapp={canSeeContacts ? inbound.whatsapp_number : null}
                followUps={followUps}
                contactLogs={contactLogs}
                composer={<FollowUpComposer api="inbounds" entityId={inbound.id} noun="owner" followUps={followUps} onSaved={() => fetchInbound()} />}
                canEdit
                isAdmin={isAdmin}
                refreshKey={mailRefresh}
                onRefresh={() => fetchInbound()}
              />
            )}
            {activeTab === "pricing" && pricing}
            {activeTab === "photo" && photo}
          </div>
        </div>

        <aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto border-l md:flex xl:w-[360px]">
          <div className="flex items-center gap-3 border-b p-4">
            <ScoreRing score={Number(inbound.quality_score) || 0} />
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold leading-6 text-foreground" title={title}>{title}</p>
              <p className="text-[13px] text-muted-foreground">{inboundCode(inbound)}</p>
            </div>
          </div>
          {summary}
          <p className="mt-auto hidden items-center gap-1.5 px-4 py-3 text-[12px] text-muted-foreground md:flex">
            Press <kbd className="rounded border px-1 font-mono text-[11px]">A</kbd> to switch between activity and conversation.
          </p>
        </aside>
      </div>


      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="h-[90vh] w-full max-w-[95vw] overflow-hidden border-none bg-black/95 p-0 sm:max-w-[95vw]">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- full-size CDN photo */}
          <img src={inbound.image_url} alt={title} className="h-full w-full object-contain p-4" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InboundViewPage() {
  return <InboundDetail />;
}
