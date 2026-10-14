"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/shared/form-select";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ApiError } from "@/lib/api-fetch";
import { adsApi } from "@/lib/ads-api";
import { ADS_LINK_PRESETS, ADS_PLACEMENTS, getPlacement, ratioLabel, type AdRatio } from "@/lib/ads-link-presets";

export interface AdFormProps {
  mode: "create" | "edit";
  initial?: any;
  /** Preselected placement for a new ad (from the list page's current tab). */
  defaultPlacement?: string;
}

const labelClass = "text-xs font-bold uppercase tracking-wider text-muted-foreground";
const inputClass = "h-12 rounded-xl bg-muted/30";
const fileInputClass =
  "h-12 rounded-xl bg-muted/30 file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium";
const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const RATIO_TOLERANCE = 0.02; // matches the site backend
const ALL_AUDIENCES = "__all";

const PLACEMENT_OPTIONS = ADS_PLACEMENTS.map((p) => ({ label: p.label, value: p.value }));
const LINK_PRESET_OPTIONS = ADS_LINK_PRESETS.map((p) => ({ label: p.label, value: p.value }));

function checkFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return `"${file.name}" exceeds 5MB. Please pick a smaller file.`;
  return null;
}

// Catch a wrong-size creative before uploading; the server re-checks.
function readRatio(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

interface ImageSlot {
  file: File | null;
  preview: string;
  touched: boolean;
  /** Edit mode: user removed the stored optional image. */
  cleared: boolean;
}

const slotFrom = (url?: string | null): ImageSlot => ({ file: null, preview: url ?? "", touched: false, cleared: false });

function ImagePicker({
  label,
  ratio,
  example,
  required,
  slot,
  mode,
  onPick,
  onClear,
  previewClass,
}: {
  label: string;
  ratio: AdRatio;
  example: string;
  required: boolean;
  slot: ImageSlot;
  mode: "create" | "edit";
  onPick: (file: File | undefined) => void;
  onClear?: () => void;
  previewClass: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <label className={labelClass}>
        {label} {required ? "*" : <span className="normal-case font-medium tracking-normal">(optional)</span>}
      </label>
      <p className="text-xs text-muted-foreground">
        {ratioLabel(ratio)}, e.g. {example} — JPEG, PNG or WebP, max 5MB.
        {!required && " Falls back to the desktop image when empty."}
      </p>
      <Input ref={inputRef} type="file" accept={ACCEPT} onChange={(e) => onPick(e.target.files?.[0])} className={fileInputClass} />
      {slot.preview ? (
        <div className="space-y-1">
          <div className="relative inline-block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slot.preview}
              alt={`${label} preview`}
              style={{ aspectRatio: `${ratio[0]} / ${ratio[1]}` }}
              className={"rounded-xl border border-border/60 object-cover bg-muted " + previewClass}
            />
            {onClear && (
              <button
                type="button"
                onClick={() => {
                  if (inputRef.current) inputRef.current.value = "";
                  onClear();
                }}
                className="absolute top-2 left-2 h-7 w-7 rounded-full bg-background/90 border border-border/60 flex items-center justify-center text-muted-foreground hover:text-red-500"
                title="Remove image"
                aria-label={`Remove ${label}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {mode === "edit" && !slot.touched && (
            <p className="text-xs text-muted-foreground">Current image — pick a new file to replace it.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AdForm({ mode, initial, defaultPlacement }: AdFormProps) {
  const router = useRouter();
  const d = initial as any;
  const originalPlacement: string | undefined = d?.placement;

  const [title, setTitle] = useState(d?.title ?? "");
  const [placement, setPlacement] = useState<string>(d?.placement ?? getPlacement(defaultPlacement).value);
  const [audience, setAudience] = useState<string>(d?.audience ?? ALL_AUDIENCES);
  const [linkPreset, setLinkPreset] = useState<string>(
    d?.linkPreset ?? (d?.linkType === "custom" ? "custom" : ADS_LINK_PRESETS[0].value),
  );
  const [linkCustom, setLinkCustom] = useState<string>(d?.linkCustom != null ? String(d.linkCustom) : "");
  const [isActive, setIsActive] = useState<boolean>(d?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const [desktop, setDesktop] = useState<ImageSlot>(() => slotFrom(d?.desktopImage));
  const [mobile, setMobile] = useState<ImageSlot>(() => slotFrom(d?.mobileImage));

  const spec = getPlacement(placement);
  const placementChanged = mode === "edit" && placement !== originalPlacement;
  const audienceOptions = [
    { label: "All — fallback", value: ALL_AUDIENCES },
    ...spec.audiences.map((a) => ({ label: a.label, value: a.value })),
  ];

  // Revoke blob preview URLs on unmount.
  const previewsRef = useRef<string[]>([]);
  useEffect(() => {
    previewsRef.current = [desktop.preview, mobile.preview];
  }, [desktop.preview, mobile.preview]);
  useEffect(() => () => previewsRef.current.forEach((p) => p.startsWith("blob:") && URL.revokeObjectURL(p)), []);

  const changePlacement = (next: string) => {
    setPlacement(next);
    const nextSpec = getPlacement(next);
    if (!nextSpec.audiences.some((a) => a.value === audience)) setAudience(ALL_AUDIENCES);
    // Stored images were sized for the old slot; picked files may not fit the
    // new ratio either — start the images over so previews never mislead.
    if (next !== placement) {
      setDesktop(next === originalPlacement ? slotFrom(d?.desktopImage) : slotFrom());
      setMobile(next === originalPlacement ? slotFrom(d?.mobileImage) : slotFrom());
    }
  };

  const pickFile = async (file: File | undefined, which: "desktop" | "mobile") => {
    if (!file) return;
    const err = checkFile(file);
    if (err) return void toast.error(err);
    const slotSpec = which === "desktop" ? spec.desktop : spec.mobile;
    if (!slotSpec) return;
    const actual = await readRatio(file);
    const expected = slotSpec.ratio[0] / slotSpec.ratio[1];
    if (actual && Math.abs(actual - expected) / expected > RATIO_TOLERANCE) {
      toast.error(`"${file.name}" isn't ${ratioLabel(slotSpec.ratio)} — please use e.g. ${slotSpec.example}.`);
      return;
    }
    const setSlot = which === "desktop" ? setDesktop : setMobile;
    setSlot((prev) => {
      if (prev.preview.startsWith("blob:")) URL.revokeObjectURL(prev.preview);
      return { file, preview: URL.createObjectURL(file), touched: true, cleared: false };
    });
  };

  const clearMobile = () =>
    setMobile((prev) => {
      if (prev.preview.startsWith("blob:")) URL.revokeObjectURL(prev.preview);
      return { file: null, preview: "", touched: true, cleared: true };
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return void toast.error("Title is required.");
    if (!desktop.file && !desktop.preview) return void toast.error(`${spec.desktop.label} is required.`);
    if (spec.mobile?.required && !mobile.file && !mobile.preview) return void toast.error("Mobile image is required.");
    if (placementChanged && !desktop.file) {
      return void toast.error("Each placement has its own image size — upload new images for the new placement.");
    }
    if (linkPreset === "custom") {
      const customPath = linkCustom.trim();
      if (!customPath) return void toast.error("Custom path is required when link is Custom.");
      if (!/^\/[^/\s]/.test(customPath)) {
        return void toast.error("Custom path must be an internal path starting with “/” (e.g. /offers/diwali).");
      }
    }

    setIsSaving(true);
    try {
      // Upload only newly-picked files; edit mode keeps stored images otherwise.
      const desktopImageKey = desktop.file ? await adsApi.uploadTemp(desktop.file) : undefined;
      const mobileImageKey = spec.mobile && mobile.file ? await adsApi.uploadTemp(mobile.file) : undefined;

      const payload: Record<string, any> = {
        title: trimmedTitle,
        placement,
        audience: spec.audiences.length && audience !== ALL_AUDIENCES ? audience : null,
        linkType: linkPreset === "custom" ? "custom" : "preset",
        linkPreset,
        isActive,
      };
      if (linkPreset === "custom") payload.linkCustom = linkCustom.trim();
      if (desktopImageKey) payload.desktopImageKey = desktopImageKey;
      if (mobileImageKey) payload.mobileImageKey = mobileImageKey;
      else if (mode === "edit" && mobile.cleared) payload.mobileImageKey = null;

      const result: any = mode === "create" ? await adsApi.create(payload) : await adsApi.update(d.id, payload);
      if (result && result.success === false) {
        toast.error(result.message ?? `Failed to ${mode === "create" ? "create" : "update"} advertisement.`);
        return;
      }

      toast.success(mode === "create" ? "Advertisement created successfully!" : "Advertisement updated successfully!");
      router.push("/ads");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2.5 md:px-0 mt-2 md:mt-0 mb-20 md:mb-0">
      <MobileHeader title={mode === "create" ? "Add Advertisement" : "Edit Advertisement"} showBack />

      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{mode === "create" ? "Add New Advertisement" : "Edit Advertisement"}</h1>
          <p className="text-sm text-muted-foreground mt-1">Pick where it shows on the site, upload the creative, and choose where a click goes.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card border rounded-2xl p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <label className={labelClass}>Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali Home Fest" required className={inputClass} />
            <p className="text-xs text-muted-foreground">Used as the image&apos;s alt text on the site.</p>
          </div>

          <div className={spec.audiences.length ? "grid grid-cols-1 md:grid-cols-2 gap-6" : ""}>
            <div className="space-y-2">
              <label className={labelClass}>Placement</label>
              <FormSelect
                name="placement"
                placeholder="Select placement"
                options={PLACEMENT_OPTIONS}
                value={placement}
                onValueChange={(v) => changePlacement(v || "hero")}
              />
            </div>
            {spec.audiences.length > 0 && (
              <div className="space-y-2">
                <label className={labelClass}>Show on</label>
                <FormSelect
                  name="audience"
                  placeholder="Select audience"
                  options={audienceOptions}
                  value={audience}
                  onValueChange={(v) => setAudience(v || ALL_AUDIENCES)}
                />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground -mt-3">{spec.description}</p>
          {placementChanged && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 -mt-3">
              Moving to a different placement needs new images sized for it.
            </p>
          )}

          <div className={spec.mobile ? "grid grid-cols-1 md:grid-cols-2 gap-6" : ""}>
            <ImagePicker
              label={spec.desktop.label}
              ratio={spec.desktop.ratio}
              example={spec.desktop.example}
              required
              slot={desktop}
              mode={mode}
              onPick={(f) => pickFile(f, "desktop")}
              previewClass={spec.mobile ? "w-full" : "w-full max-w-sm"}
            />
            {spec.mobile && (
              <ImagePicker
                label="Mobile image"
                ratio={spec.mobile.ratio}
                example={spec.mobile.example}
                required={spec.mobile.required}
                slot={mobile}
                mode={mode}
                onPick={(f) => pickFile(f, "mobile")}
                onClear={!spec.mobile.required && mobile.preview ? clearMobile : undefined}
                previewClass={spec.mobile.ratio[0] < spec.mobile.ratio[1] ? "w-32" : "w-full"}
              />
            )}
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Link — where a click goes</label>
            <FormSelect name="linkPreset" placeholder="Select link" options={LINK_PRESET_OPTIONS} value={linkPreset} onValueChange={(v) => setLinkPreset(v)} />
            <p className="text-xs text-muted-foreground">Buy and Rent links open for the visitor&apos;s selected city.</p>
          </div>

          {linkPreset === "custom" && (
            <div className="space-y-2">
              <label className={labelClass}>Custom path *</label>
              <Input value={linkCustom} onChange={(e) => setLinkCustom(e.target.value)} placeholder="/offers/diwali" required className={inputClass} />
            </div>
          )}

          <label className="flex items-center space-x-3 bg-muted/10 border border-border/40 p-4 h-12 rounded-xl transition-colors hover:bg-muted/30 cursor-pointer">
            <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
            <span className="text-sm font-medium">Active</span>
          </label>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving} className="h-12 px-8 rounded-xl bg-[#0052FF] hover:bg-[#0052FF]/90">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isSaving ? "Saving..." : mode === "create" ? "Create Advertisement" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
