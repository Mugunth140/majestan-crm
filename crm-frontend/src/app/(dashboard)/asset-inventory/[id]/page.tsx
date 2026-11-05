"use client";

import { assetScoreFields } from "@/lib/record-score";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Database, ExternalLink, FileText, Image as ImageIcon, Layers, Loader2, MapPin, Upload } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/api-fetch";
import {
  ASSET_MEDIA, ASSET_SOURCES, ASSET_ZONES, BUSINESS_MODES, CLASSIFICATION_TYPES, DISTANCE_BANDS, REGISTRATION_TIMES,
  SALEABLE_AREAS, SOIL_TYPES, WATER_DEPTHS, WATER_SOURCES, YES_NO, YES_NO_NA, assetCode, assetPlace, fromLayout, lakhs,
  loPriceText, plainNumber, toLayoutsPayload, toLoPrice, toNumber, type AssetLayout, type AssetMediaSlot,
} from "@/lib/asset-options";
import { formatTableDate, statusPillClass } from "@/components/tables/cells";
import { FieldRow, InlineSelect, InlineText, Section, type Option } from "@/components/record/inline-field";
import { TabHeader } from "@/components/record/feed";
import { HEADER_BUTTON } from "@/components/record/header-actions";
import { DataCard, RecordPage, RecordSkeleton, RecordSummary, type RecordTab } from "@/components/record/record-page";
import { FOCUS_BUTTON } from "@/components/shared/focus-modal";
import { cn } from "@/lib/utils";
import { LayoutsEditor } from "../_components/LayoutsEditor";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type Tab = "overview" | "layouts" | "media";
type Asset = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Doc = { id: number; file_name?: string; file_url: string; file_type?: string; document_category?: string };
type Group = "location" | "features" | "financials";

/** A picker shows the current value even when it's no longer one of the options. */
const withCurrent = (options: Option[], value?: string | null) =>
  !value || options.some((o) => o.value === value) ? options : [{ label: value, value }, ...options];
const sameLayouts = (a: AssetLayout[], b: AssetLayout[]) => JSON.stringify(a) === JSON.stringify(b);

/** Upload button for one media slot. */
function UploadButton({ slot, busy, disabled, onPick }: { slot: AssetMediaSlot; busy: boolean; disabled: boolean; onPick: (files: File[]) => void }) {
  return (
    <label className={cn(FOCUS_BUTTON.secondary, "cursor-pointer", disabled && "pointer-events-none opacity-50")}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
      {busy ? "Uploading…" : "Upload"}
      <input type="file" accept={ASSET_MEDIA[slot].accept} multiple={slot === "images"} className="hidden" disabled={disabled}
        onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) onPick(files); }} />
    </label>
  );
}

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [districts, setDistricts] = useState<Option[]>([]);
  const [layouts, setLayouts] = useState<AssetLayout[]>([]);
  const [savingLayouts, setSavingLayouts] = useState(false);
  const [uploading, setUploading] = useState<AssetMediaSlot | null>(null);

  const loadAsset = useCallback(async (): Promise<Asset | null> => {
    try {
      const result = await apiJson<{ success?: boolean; data?: Asset }>(`${API_URL}/assets/${id}`);
      if (result?.success && result.data) return result.data;
      toast.error("Asset not found");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Failed to load the asset");
    }
    router.push("/asset-inventory");
    return null;
  }, [id, router]);
  const show = useCallback((data: Asset) => {
    setAsset(data);
    setLayouts((data.layouts ?? []).map(fromLayout));
  }, []);

  useEffect(() => {
    let live = true;
    loadAsset().then((data) => {
      if (!live) return;
      if (data) show(data);
      setIsLoading(false);
    });
    return () => { live = false; };
  }, [loadAsset, show]);

  useEffect(() => {
    let live = true;
    apiJson<{ success?: boolean; data?: { city_name: string }[] }>(`${API_URL}/leads/cities`)
      .then((d) => { if (live && d.success) setDistricts((d.data ?? []).map((c) => ({ label: c.city_name, value: c.city_name }))); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  /** Saves part of the asset; the reply is the whole asset. */
  const save = async (patch: Record<string, unknown>, quiet = false) => {
    try {
      const res = await apiFetch(`${API_URL}/assets/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) throw new Error((Array.isArray(result?.message) ? result.message.join(", ") : result?.message) || "Couldn't save the change");
      if ("layouts" in patch) show(result.data);
      else setAsset(result.data);
      if (!quiet) toast.success("Saved");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't save the change");
      throw reason;
    }
  };
  const saveTop = (key: string) => (v: string) => save({ [key]: v.trim() || null });
  const saveRequired = (key: string, what: string) => async (v: string) => {
    if (!v.trim()) {
      toast.error(`The ${what} can't be empty.`);
      throw new Error("required");
    }
    return save({ [key]: v.trim() });
  };
  const saveIn = (group: Group, key: string, convert: (v: string) => unknown = (v) => v.trim() || null) =>
    (v: string) => save({ [group]: { [key]: convert(v) } });

  const upload = async (slot: AssetMediaSlot, files: File[]) => {
    const current = (asset?.documents ?? []).filter((d: Doc) => d.file_type === "image" && (d.document_category ?? "general") === "general").length;
    if (slot === "images" && current + files.length > 4) return void toast.error(`Up to 4 site photos. ${current ? `There ${current === 1 ? "is" : "are"} already ${current}.` : ""}`);
    const form = new FormData();
    files.forEach((f) => form.append(slot, f));
    setUploading(slot);
    try {
      const res = await apiFetch(`${API_URL}/assets/${id}/media`, { method: "POST", body: form });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) throw new Error(result.message || "Upload failed");
      toast.success("Uploaded");
      const data = await loadAsset();
      if (data) setAsset(data);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const saveLayouts = async () => {
    setSavingLayouts(true);
    try { await save({ layouts: toLayoutsPayload(layouts) }); } catch { /* toast shown */ } finally { setSavingLayouts(false); }
  };

  if (isLoading) return <RecordSkeleton title="Asset" />;
  if (!asset) return null;

  const a = asset;
  const loc = a.location ?? {};
  const feat = a.features ?? {};
  const fin = a.financials ?? {};
  const docs: Doc[] = a.documents ?? [];
  const photos = docs.filter((d) => d.file_type === "image" && (d.document_category ?? "general") === "general");
  const files: { slot: Exclude<AssetMediaSlot, "images">; docs: Doc[] }[] = [
    { slot: "document", docs: docs.filter((d) => d.file_type === "document") },
    { slot: "fmb", docs: docs.filter((d) => d.document_category === "fmb") },
    { slot: "barcode", docs: docs.filter((d) => d.document_category === "barcode") },
  ];
  const savedLayouts: AssetLayout[] = (a.layouts ?? []).map(fromLayout);
  const layoutsDirty = !sameLayouts(layouts, savedLayouts);

  const status: string = a.status || "New";
  const place = assetPlace(loc);
  const title = place || a.owner_name || assetCode(a.id);
  const subtitle = [assetCode(a.id), loc.zone].filter(Boolean).join(" · ");
  const extent = feat.extent ? (isNaN(Number(feat.extent)) ? String(feat.extent) : `${plainNumber(feat.extent)} acres`) : null;
  const pill = (size: string) => <span className={cn("inline-flex items-center rounded-md px-2.5 text-[13px] font-medium", size, statusPillClass(status))}>{status}</span>;
  const fact = (label: string, value: ReactNode) => (
    <FieldRow label={label}><span className={cn("px-2 text-[14px]", value ? "text-foreground" : "text-muted-foreground/60")}>{value || "—"}</span></FieldRow>
  );
  const choice = (group: Group, key: string, label: string, options: Option[]) => {
    const value = (group === "location" ? loc : group === "features" ? feat : fin)[key];
    return <InlineSelect label={label} value={value} options={withCurrent(options, value)} onSave={saveIn(group, key)} />;
  };
  const text = (group: Group, key: string, label: string, extra: { placeholder?: string; type?: "number" | "url" } = {}) => {
    const value = (group === "location" ? loc : group === "features" ? feat : fin)[key];
    return <InlineText label={label} value={extra.type === "number" ? plainNumber(value) : value} type={extra.type} placeholder={extra.placeholder}
      onSave={saveIn(group, key, extra.type === "number" ? toNumber : undefined)} />;
  };

  const overview = (
    <div className="pb-6">
      <TabHeader title="Overview" />
      <div className="space-y-5 px-3 sm:px-10">
        <DataCard title="Owner">
          <InlineText label="Owner" value={a.owner_name} onSave={saveRequired("owner_name", "owner name")} />
          <InlineText label="Mobile" type="tel" value={a.mobile_number} onSave={saveRequired("mobile_number", "mobile number")} />
          <InlineSelect label="Source" value={a.source} options={withCurrent(ASSET_SOURCES, a.source)} onSave={(v) => save({ source: v })} />
          {a.source === "Mediator" && <InlineText label="Mediator" value={a.mediator_name} onSave={saveTop("mediator_name")} />}
          {a.source === "CP Reference" && <InlineText label="CP reference" value={a.cp_reference_name} onSave={saveTop("cp_reference_name")} />}
          <InlineText label="Remarks" multiline value={a.remarks} onSave={saveTop("remarks")} />
        </DataCard>

        <DataCard title="Site visit">
          <InlineText label="Visited on" type="date" value={a.visited_date ? String(a.visited_date).slice(0, 10) : ""} onSave={saveTop("visited_date")} />
          <InlineText label="Visited by" value={a.site_visited_done} onSave={saveTop("site_visited_done")} />
          <InlineText label="Checked by" value={a.checked_by} onSave={saveTop("checked_by")} />
          <InlineText label="Approved by" value={a.approved_by} onSave={saveTop("approved_by")} />
        </DataCard>

        <DataCard title="Location">
          <InlineSelect searchable label="District" value={loc.district} options={withCurrent(districts, loc.district)} onSave={saveIn("location", "district")} />
          {text("location", "taluk", "Taluk")}
          {text("location", "village", "Village")}
          {choice("location", "zone", "Zone", ASSET_ZONES)}
          {text("location", "junction_name", "Junction")}
          {text("location", "road_name", "Road")}
          {text("location", "distance_from_main", "Main road (km)", { type: "number" })}
          {text("location", "distance_from_airport", "Airport (km)", { type: "number" })}
          {text("location", "approached_roads", "Approach roads")}
          {text("location", "approached_road_width", "Road width (ft)", { type: "number" })}
          {text("location", "firka_range", "Firka range")}
          {choice("location", "haca_range", "HACA range", YES_NO)}
          {choice("location", "adjacent_layout", "Next to layout", YES_NO_NA)}
          {text("location", "site_location", "Site location")}
          {text("location", "google_pin", "Maps link", { type: "url", placeholder: "https://maps.app.goo.gl/…" })}
          {text("location", "latitude", "Latitude")}
          {text("location", "longitude", "Longitude")}
        </DataCard>

        <DataCard title="Land">
          {text("features", "extent", "Extent (acres)", { type: "number" })}
          {text("features", "tslr", "TSLR")}
          {choice("features", "classification_type", "Classification", CLASSIFICATION_TYPES)}
          {feat.classification_type === "Classified Area" && text("features", "classified_area", "Classified area")}
          {choice("features", "saleable_area", "Saleable area", SALEABLE_AREAS)}
          {choice("features", "soil_type", "Soil", SOIL_TYPES)}
          {choice("features", "water_source", "Water source", WATER_SOURCES)}
          {choice("features", "water_depth", "Water depth", WATER_DEPTHS)}
          {choice("features", "high_voltage_line", "High-voltage line", YES_NO)}
          {choice("features", "presence_of_well", "Well", YES_NO)}
          {choice("features", "borewell", "Borewell", YES_NO)}
          {choice("features", "near_railway", "Railway", DISTANCE_BANDS)}
          {choice("features", "near_water_body", "Water body", DISTANCE_BANDS)}
          {choice("features", "canal", "Canal", DISTANCE_BANDS)}
          {choice("features", "near_burial_ground", "Burial ground", DISTANCE_BANDS)}
        </DataCard>

        <DataCard title="Pricing">
          {choice("financials", "business_mode", "Business mode", BUSINESS_MODES)}
          {text("financials", "land_price", "Land (lakhs)", { type: "number" })}
          {text("financials", "dtcp_price", "DTCP (lakhs)", { type: "number" })}
          {text("financials", "expectation", "Expected (lakhs)", { type: "number" })}
          <InlineText label="LO price" value={loPriceText(fin.lo_price)} placeholder="e.g. 80L" onSave={saveIn("financials", "lo_price", toLoPrice)} />
          {choice("financials", "registration_time", "Registration", REGISTRATION_TIMES)}
          {text("financials", "payment_options", "Payment options")}
        </DataCard>
      </div>
    </div>
  );

  const layoutsTab = (
    <div className="pb-6">
      <TabHeader title="Layouts" action={layoutsDirty ? (
        <div className="flex items-center gap-2">
          <button type="button" className={FOCUS_BUTTON.secondary} disabled={savingLayouts} onClick={() => setLayouts(savedLayouts)}>Discard</button>
          <button type="button" className={FOCUS_BUTTON.primary} disabled={savingLayouts} onClick={() => void saveLayouts()}>
            {savingLayouts && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save layouts
          </button>
        </div>
      ) : undefined} />
      <div className="px-3 sm:px-10">
        {layouts.length === 0 && <p className="mb-3 text-[14px] text-muted-foreground">No layouts recorded for this asset.</p>}
        <LayoutsEditor rows={layouts} onChange={setLayouts} />
      </div>
    </div>
  );

  const mediaTab = (
    <div className="pb-6">
      <TabHeader title="Media" />
      <div className="space-y-5 px-3 sm:px-10">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex h-11 items-center justify-between border-b px-4">
            <h3 className="text-[14px] font-semibold text-foreground">Site photos <span className="font-normal text-muted-foreground">{photos.length}/4</span></h3>
            {photos.length < 4 && <UploadButton slot="images" busy={uploading === "images"} disabled={uploading !== null} onPick={(f) => void upload("images", f)} />}
          </div>
          {photos.length ? (
            <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
              {photos.map((p) => (
                <a key={p.id} href={p.file_url} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-90">
                  {/* eslint-disable-next-line @next/next/no-img-element -- CDN image */}
                  <img src={p.file_url} alt={p.file_name || "Site photo"} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-[14px] text-muted-foreground">No photos yet.</p>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <h3 className="flex h-11 items-center border-b px-4 text-[14px] font-semibold text-foreground">Files</h3>
          {files.map(({ slot, docs: list }) => (
            <div key={slot} className="flex min-h-14 items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-muted-foreground">
                {slot === "document" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-foreground">{ASSET_MEDIA[slot].label}</p>
                {list.length ? list.map((d) => (
                  <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" className="block truncate text-[13px] text-[#0052FF] hover:underline dark:text-[#6F9BFF]">{d.file_name || "Open file"}</a>
                )) : <p className="text-[13px] text-muted-foreground">Not uploaded · {ASSET_MEDIA[slot].hint}</p>}
              </div>
              <UploadButton slot={slot} busy={uploading === slot} disabled={uploading !== null} onPick={(f) => void upload(slot, f.slice(0, 1))} />
            </div>
          ))}
        </section>
      </div>
    </div>
  );

  const tabs: RecordTab<Tab>[] = [
    { key: "overview", label: "Overview", icon: Database },
    { key: "layouts", label: "Layouts", icon: Layers, count: savedLayouts.length },
    { key: "media", label: "Media", icon: ImageIcon, count: docs.length },
  ];
  const mapButton = loc.google_pin ? (
    <a href={loc.google_pin} target="_blank" rel="noreferrer" className={HEADER_BUTTON}>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /> Map
    </a>
  ) : null;

  return (
    <RecordPage
      title={title}
      tabs={tabs}
      active={activeTab}
      onTab={setActiveTab}
      actions={<>{pill("h-8")}{mapButton}</>}
      phone={
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
          {pill("h-7")}
          <span className="truncate">{subtitle}</span>
        </div>
      }
      aside={
        <>
          <RecordSummary score={assetScoreFields(a)} icon={MapPin} title={title} subtitle={subtitle} />
          <Section title="Details">
            {fact("Owner", a.owner_name)}
            {fact("Mobile", a.mobile_number ? <a href={`tel:${a.mobile_number}`} className="hover:underline">{a.mobile_number}</a> : null)}
            {fact("Extent", extent)}
            {fact("Expected", lakhs(fin.expectation))}
            {fact("Business mode", fin.business_mode)}
            {fact("Assigned to", a.assigned_staff?.name)}
            {fact("Added", formatTableDate(a.created_at))}
          </Section>
        </>
      }
    >
      {activeTab === "overview" && overview}
      {activeTab === "layouts" && layoutsTab}
      {activeTab === "media" && mediaTab}
    </RecordPage>
  );
}
