"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { DatePicker } from "@/components/shared/date-picker";
import { PriceInput } from "@/components/shared/price-input";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ArrowLeft, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { projectsApi } from "@/lib/projects-api";
import { propertiesApi } from "@/lib/properties-api";
import { parseIndianCurrency } from "@/lib/indian-currency";
import { computeProjectRanges, formatPriceRange } from "@/lib/project-ranges";

const labelClass = "text-xs font-bold uppercase tracking-wider text-muted-foreground";
const inputClass = "h-12 rounded-xl bg-muted/30";

const PROJECT_TYPE_OPTIONS = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
];

const POSSESSION_OPTIONS = [
  { value: "under_construction", label: "Under Construction" },
  { value: "ready_to_move", label: "Ready To Move" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const FACING_OPTIONS = [
  { value: "east", label: "East" },
  { value: "west", label: "West" },
  { value: "north", label: "North" },
  { value: "south", label: "South" },
  { value: "north_east", label: "North East" },
  { value: "north_west", label: "North West" },
  { value: "south_east", label: "South East" },
  { value: "south_west", label: "South West" },
];

const FURNISHED_OPTIONS = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi_furnished", label: "Semi Furnished" },
  { value: "fully_furnished", label: "Fully Furnished" },
];

const UNIT_STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "rented", label: "Rented" },
  { value: "inactive", label: "Inactive" },
];

const slugify = (value: string) =>
  value.trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

interface UnitRow {
  unitCode: string;
  bedrooms: string;
  bathrooms: string;
  carpetAreaSqft: string;
  builtupAreaSqft: string;
  superBuiltupAreaSqft: string;
  price: string;
  facing: string;
  furnishedStatus: string;
  floorPlanImageUrl: string;
  status: string;
}

const emptyUnit = (): UnitRow => ({
  unitCode: "",
  bedrooms: "",
  bathrooms: "",
  carpetAreaSqft: "",
  builtupAreaSqft: "",
  superBuiltupAreaSqft: "",
  price: "",
  facing: "",
  furnishedStatus: "",
  floorPlanImageUrl: "",
  status: "available",
});

interface ProjectFormProps {
  mode: "create" | "edit";
  initialData?: any;
  onSuccess?: () => void;
}

export function ProjectForm({ mode, initialData, onSuccess }: ProjectFormProps) {
  const router = useRouter();
  const d = initialData as any;

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<{ cities: any[]; sublocations: any[] }>({ cities: [], sublocations: [] });

  useEffect(() => {
    propertiesApi
      .formData()
      .then((res: any) => {
        const data = res?.data ?? res ?? {};
        setFormData({
          cities: data.cities ?? [],
          sublocations: data.sublocations ?? [],
        });
      })
      .catch(() => {});
  }, []);

  const cityIdOf = (cityName: string) => {
    const found = formData.cities.find(
      (c: any) => (c.cityName ?? c.city_name ?? "") === cityName
    );
    return found ? String(found.id) : "";
  };

  const [name, setName] = useState(d?.name ?? "");
  const [slug, setSlug] = useState(d?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [projectType, setProjectType] = useState(d?.projectType ?? "apartment");
  const [builderName, setBuilderName] = useState(d?.builderName ?? "");
  const [reraNumber, setReraNumber] = useState(d?.reraNumber ?? "");
  const [possessionDate, setPossessionDate] = useState(d?.possessionDate ? String(d.possessionDate).split("T")[0] : "");
  const [possessionStatus, setPossessionStatus] = useState(d?.possessionStatus ?? "under_construction");
  const [city, setCity] = useState(d?.city ?? "");
  const [state, setState] = useState(d?.state ?? "");
  const [sublocation, setSublocation] = useState(d?.sublocation ?? "");
  const [address, setAddress] = useState(d?.address ?? "");
  const [towers, setTowers] = useState(d?.towers ? String(d.towers) : "");
  const [totalUnits, setTotalUnits] = useState(d?.totalUnits ? String(d.totalUnits) : "");
  const [description, setDescription] = useState(d?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(d?.coverImageUrl ?? "");
  const [coverPreview, setCoverPreview] = useState(d?.coverImageUrl ?? "");
  const [floorPlanPreviews, setFloorPlanPreviews] = useState<Record<number, string>>({});
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFloorPlanIdx, setUploadingFloorPlanIdx] = useState<number | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(d?.status ?? "draft");

  const [units, setUnits] = useState<UnitRow[]>(() => {
    const existing = d?.units ?? d?.__units__ ?? [];
    if (existing.length === 0) return [emptyUnit()];
    return existing.map((u: any) => ({
      unitCode: u.unitCode ?? "",
      bedrooms: u.bedrooms != null ? String(u.bedrooms) : "",
      bathrooms: u.bathrooms != null ? String(u.bathrooms) : "",
      carpetAreaSqft: u.carpetAreaSqft != null ? String(u.carpetAreaSqft) : "",
      builtupAreaSqft: u.builtupAreaSqft != null ? String(u.builtupAreaSqft) : "",
      superBuiltupAreaSqft: u.superBuiltupAreaSqft != null ? String(u.superBuiltupAreaSqft) : "",
      price: u.price != null ? String(u.price) : "",
      facing: u.facing ?? "",
      furnishedStatus: u.furnishedStatus ?? "",
      floorPlanImageUrl: u.floorPlanImageUrl ?? "",
      status: u.status ?? "available",
    }));
  });

  const preview = useMemo(() => {
    const rows = units
      .filter((u) => u.unitCode.trim())
      .map((u) => ({
        price: u.price ? parseIndianCurrency(u.price) || null : null,
        builtupAreaSqft: u.builtupAreaSqft ? Number(u.builtupAreaSqft) : null,
        carpetAreaSqft: u.carpetAreaSqft ? Number(u.carpetAreaSqft) : null,
        superBuiltupAreaSqft: u.superBuiltupAreaSqft ? Number(u.superBuiltupAreaSqft) : null,
        bedrooms: u.bedrooms ? Number(u.bedrooms) : null,
        status: u.status,
      }));
    return computeProjectRanges(rows);
  }, [units]);

  const updateUnit = (idx: number, patch: Partial<UnitRow>) => {
    setUnits((prev) => prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)));
  };

  const removeUnit = (idx: number) => {
    setUnits((prev) => (prev.length === 1 ? [emptyUnit()] : prev.filter((_, i) => i !== idx)));
  };

  const handleCoverFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (!file) return;
    setUploadingCover(true);
    try {
      const result = await propertiesApi.uploadImages([file]);
      const uploaded = result?.data ?? [];
      if (!result?.success || uploaded.length === 0) throw new Error("Upload failed");
      setCoverImageUrl(uploaded[0].imageKey);
      setCoverPreview(URL.createObjectURL(file));
    } catch {
      toast.error("Failed to upload cover image. Please try again.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleFloorPlanFiles = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingFloorPlanIdx(idx);
    try {
      const result = await propertiesApi.uploadImages([file]);
      const uploaded = result?.data ?? [];
      if (!result?.success || uploaded.length === 0) throw new Error("Upload failed");
      updateUnit(idx, { floorPlanImageUrl: uploaded[0].imageKey });
      setFloorPlanPreviews((prev) => ({ ...prev, [idx]: URL.createObjectURL(file) }));
    } catch {
      toast.error("Failed to upload floor plan. Please try again.");
    } finally {
      setUploadingFloorPlanIdx(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required.");
      return;
    }
    if (!city.trim()) {
      toast.error("City is required.");
      return;
    }
    const validUnits = units.filter((u) => u.unitCode.trim());
    setIsLoading(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        projectType,
        builderName: builderName.trim() || undefined,
        reraNumber: reraNumber.trim() || undefined,
        possessionDate: possessionDate || undefined,
        possessionStatus,
        city: city.trim(),
        state: state.trim() || undefined,
        sublocation: sublocation.trim() || undefined,
        address: address.trim() || undefined,
        towers: towers ? Number(towers) : undefined,
        totalUnits: totalUnits ? Number(totalUnits) : undefined,
        description: description.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
        status,
        units: validUnits.map((u) => ({
          unitCode: u.unitCode.trim(),
          bedrooms: u.bedrooms ? Number(u.bedrooms) : undefined,
          bathrooms: u.bathrooms ? Number(u.bathrooms) : undefined,
          carpetAreaSqft: u.carpetAreaSqft ? Number(u.carpetAreaSqft) : undefined,
          builtupAreaSqft: u.builtupAreaSqft ? Number(u.builtupAreaSqft) : undefined,
          superBuiltupAreaSqft: u.superBuiltupAreaSqft ? Number(u.superBuiltupAreaSqft) : undefined,
          price: u.price ? parseIndianCurrency(u.price) || undefined : undefined,
          facing: u.facing || undefined,
          furnishedStatus: u.furnishedStatus || undefined,
          floorPlanImageUrl: u.floorPlanImageUrl.trim() || undefined,
          status: u.status || undefined,
        })),
      };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined) delete payload[k];
      });

      let result: any;
      if (mode === "create") {
        result = await projectsApi.create(payload);
      } else {
        result = await projectsApi.update(d.id, payload);
      }
      if (result && result.success === false) {
        toast.error(result.message ?? `Failed to ${mode} project.`);
        return;
      }
      toast.success(`Project ${mode === "create" ? "created" : "updated"} successfully!`);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/projects");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <MobileHeader title={mode === "create" ? "New Project" : "Edit Project"} showBack />
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6 pb-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            aria-label="Back to projects"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[28px] font-bold tracking-tight">
            {mode === "create" ? "Add New Project" : "Edit Project"}
          </h1>
        </div>
        {preview.unitsCount > 0 && (
          <p className="text-muted-foreground text-sm">
            {`${formatPriceRange(preview.minPrice, preview.maxPrice)} · ${preview.bhk.length ? preview.bhk.map((b) => `${b}BHK`).join(", ") : "No BHK"} · ${preview.unitsCount} unit${preview.unitsCount > 1 ? "s" : ""}`}
          </p>
        )}

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Basic Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={labelClass}>Project Name *</label>
              <Input value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} placeholder="e.g. Emerald Heights" className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Custom URL Slug</label>
              <Input value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} placeholder="e.g. emerald-heights" className={inputClass} />
              <p className="text-xs text-muted-foreground">/{slug.trim() || slugify(name) || "your-slug"}</p>
              {mode === "edit" && (
                <p className="text-xs text-muted-foreground">Changing the slug changes the public URL.</p>
              )}
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Project Type *</label>
              <FormSelect name="projectType" options={PROJECT_TYPE_OPTIONS} value={projectType} onValueChange={(v) => setProjectType(v)} placeholder="Select type" />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Builder</label>
              <Input value={builderName} onChange={(e) => setBuilderName(e.target.value)} placeholder="Builder name" className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>RERA Number</label>
              <Input value={reraNumber} onChange={(e) => setReraNumber(e.target.value)} placeholder="RERA registration no." className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Possession Status</label>
              <FormSelect name="possessionStatus" options={POSSESSION_OPTIONS} value={possessionStatus} onValueChange={(v) => setPossessionStatus(v)} placeholder="Select status" />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Possession Date</label>
              <DatePicker
                value={possessionDate ? new Date(`${possessionDate}T00:00:00`) : undefined}
                onChange={(d) => setPossessionDate(d ? format(d, "yyyy-MM-dd") : "")}
                placeholder="Pick possession date"
                className="h-12 rounded-xl bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>City *</label>
              <FormSelect
                name="city"
                options={formData.cities.map((c: any) => {
                  const n = c.cityName ?? c.city_name ?? "";
                  return { label: n, value: n };
                })}
                value={city}
                onValueChange={(v) => {
                  setCity(v || "");
                  setSublocation("");
                }}
                placeholder="Select city"
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>State</label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Tamil Nadu" className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Sublocation / Locality</label>
              <FormSelect
                name="sublocation"
                options={formData.sublocations
                  .filter((s: any) => {
                    const cid = cityIdOf(city);
                    return !cid || String(s.cityId ?? s.city_id ?? "") === cid;
                  })
                  .map((s: any) => {
                    const n = s.localityName ?? s.locality_name ?? "";
                    return { label: n, value: n };
                  })}
                value={sublocation}
                onValueChange={(v) => setSublocation(v || "")}
                placeholder={city ? "Select locality" : "Select city first"}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Towers</label>
              <Input type="number" min={0} value={towers} onChange={(e) => setTowers(e.target.value)} placeholder="No. of towers" className={inputClass} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className={labelClass}>Address</label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Site address" className="rounded-xl bg-muted/30 min-h-[90px]" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className={labelClass}>Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="About this project..." className="rounded-xl bg-muted/30 min-h-[120px]" />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Cover Image</label>
              <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleCoverFiles} />
              {coverPreview && (coverPreview.startsWith("http") || coverPreview.startsWith("blob:")) ? (
                <div className="relative w-full h-44 rounded-xl overflow-hidden border border-border/60 bg-muted/20">
                  <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageUrl("");
                      setCoverPreview("");
                    }}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 text-white hover:bg-red-600 transition-colors"
                    aria-label="Remove cover image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : coverImageUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-2">
                  <span className="flex-1 truncate text-xs text-muted-foreground">{coverImageUrl}</span>
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="!px-3 !py-1.5 !text-[12px] !font-medium !text-[#0052FF] hover:!bg-[#0052FF]/10 !rounded-lg"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageUrl("");
                      setCoverPreview("");
                    }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50"
                    aria-label="Remove cover image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploadingCover}
                  onClick={() => coverInputRef.current?.click()}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-border/60 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:border-[#0052FF]/50 hover:text-[#0052FF] transition-colors disabled:opacity-60"
                >
                  {uploadingCover ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  {uploadingCover ? "Uploading..." : "Upload cover image"}
                </button>
              )}
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Status</label>
              <FormSelect name="status" options={STATUS_OPTIONS} value={status} onValueChange={(v) => setStatus(v)} placeholder="Select status" />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3 mb-6">
            <h3 className="text-lg font-bold text-foreground">Units ({units.filter((u) => u.unitCode.trim()).length})</h3>
            {preview.unitsCount > 0 && (
              <span className="text-sm font-semibold text-[#0052FF]">
                {formatPriceRange(preview.minPrice, preview.maxPrice)}
              </span>
            )}
          </div>
          <div className="space-y-5">
            {units.map((unit, idx) => (
              <div key={idx} className="border border-border/60 rounded-2xl p-5 space-y-4 bg-muted/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">Unit {idx + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeUnit(idx)}
                    className="h-9 w-9 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Unit Code *</label>
                    <Input value={unit.unitCode} onChange={(e) => updateUnit(idx, { unitCode: e.target.value })} placeholder="e.g. 3BHK-A" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Bedrooms</label>
                    <Input type="number" min={0} value={unit.bedrooms} onChange={(e) => updateUnit(idx, { bedrooms: e.target.value })} placeholder="3" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Bathrooms</label>
                    <Input type="number" min={0} value={unit.bathrooms} onChange={(e) => updateUnit(idx, { bathrooms: e.target.value })} placeholder="2" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Price (₹)</label>
                    <PriceInput value={unit.price} onChange={(v) => updateUnit(idx, { price: v })} placeholder="e.g. 80L or 1.2Cr" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Carpet (sqft)</label>
                    <Input type="number" min={0} value={unit.carpetAreaSqft} onChange={(e) => updateUnit(idx, { carpetAreaSqft: e.target.value })} placeholder="1000" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Built-up (sqft)</label>
                    <Input type="number" min={0} value={unit.builtupAreaSqft} onChange={(e) => updateUnit(idx, { builtupAreaSqft: e.target.value })} placeholder="1200" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Super Built-up</label>
                    <Input type="number" min={0} value={unit.superBuiltupAreaSqft} onChange={(e) => updateUnit(idx, { superBuiltupAreaSqft: e.target.value })} placeholder="1450" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Unit Status</label>
                    <FormSelect name={`unitStatus-${idx}`} options={UNIT_STATUS_OPTIONS} value={unit.status} onValueChange={(v) => updateUnit(idx, { status: v })} placeholder="Status" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Facing</label>
                    <FormSelect name={`facing-${idx}`} options={FACING_OPTIONS} value={unit.facing} onValueChange={(v) => updateUnit(idx, { facing: v || "" })} placeholder="Any" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Furnishing</label>
                    <FormSelect name={`furnished-${idx}`} options={FURNISHED_OPTIONS} value={unit.furnishedStatus} onValueChange={(v) => updateUnit(idx, { furnishedStatus: v || "" })} placeholder="Any" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className={labelClass}>Floor Plan Image</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      data-floorplan-idx={idx}
                      onChange={(e) => handleFloorPlanFiles(e, idx)}
                    />
                    {unit.floorPlanImageUrl ? (
                      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-2">
                        {(floorPlanPreviews[idx] || unit.floorPlanImageUrl.startsWith("http")) && (
                          <img src={floorPlanPreviews[idx] || unit.floorPlanImageUrl} alt="Floor plan" className="h-16 w-16 rounded-lg object-cover bg-white" />
                        )}
                        <span className="flex-1 truncate text-xs text-muted-foreground">{unit.floorPlanImageUrl}</span>
                        <button
                          type="button"
                          onClick={() => {
                            updateUnit(idx, { floorPlanImageUrl: "" });
                            setFloorPlanPreviews((prev) => {
                              const next = { ...prev };
                              delete next[idx];
                              return next;
                            });
                          }}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          aria-label="Remove floor plan"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={uploadingFloorPlanIdx === idx}
                        onClick={(e) => {
                          const input = (e.currentTarget.parentElement?.querySelector("input[type=file]") as HTMLInputElement) ?? null;
                          input?.click();
                        }}
                        className="w-full h-14 rounded-xl border-2 border-dashed border-border/60 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:border-[#0052FF]/50 hover:text-[#0052FF] transition-colors disabled:opacity-60"
                      >
                        {uploadingFloorPlanIdx === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        {uploadingFloorPlanIdx === idx ? "Uploading..." : "Upload floor plan"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setUnits((prev) => [...prev, emptyUnit()])}
              className="w-full border-dashed border-2 h-12"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Unit
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" className="h-11 rounded-full px-5" onClick={() => router.push("/projects")}>
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="h-11 rounded-full bg-[#0052FF] px-6 text-white hover:bg-[#0052FF]/90">
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "create" ? "Create Project" : "Save Changes"}
          </Button>
        </div>
      </form>
    </>
  );
}
