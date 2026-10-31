"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/shared/form-select";
import { MobileHeader } from "@/components/layout/mobile-header";
import { validateAdImage, isInternalAdPath, readAdImageRatio } from "@/lib/ads-validation";
import { persistedStateKey } from "@/hooks/use-persisted-state";
import { adsApi, type Advertisement, type AdSavePayload } from "@/lib/ads-api";
import { ADS_LINK_PRESETS, ADS_PLACEMENTS, getPlacement, ratioLabel, type AdRatio } from "@/lib/ads-link-presets";

export interface AdFormProps {
  mode: "create" | "edit";
  initial?: Advertisement;
  /** Preselected placement for a new ad (from the list page's current tab). */
  defaultPlacement?: string;
}

const labelClass = "text-sm font-semibold text-foreground";
const inputClass = "h-12 rounded-xl bg-muted/30";
const fileInputClass =
  "h-12 rounded-xl bg-muted/30 file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium";
const ACCEPT = "image/jpeg,image/png,image/webp";
const RATIO_TOLERANCE = 0.02; // matches the site backend
const ALL_AUDIENCES = "__all";

const PLACEMENT_OPTIONS = ADS_PLACEMENTS.map((p) => ({ label: p.label, value: p.value }));
const LINK_PRESET_OPTIONS = ADS_LINK_PRESETS.map((p) => ({ label: p.label, value: p.value }));

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
  onReset,
  previewClass,
  error,
}: {
  label: string;
  ratio: AdRatio;
  example: string;
  required: boolean;
  slot: ImageSlot;
  mode: "create" | "edit";
  onPick: (file: File | undefined) => void;
  onClear?: () => void;
  onReset?: () => void;
  previewClass: string;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className={labelClass}>
        {label} {required ? "*" : <span className="normal-case font-medium tracking-normal">(optional)</span>}
      </label>
      <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
        {ratioLabel(ratio)}, e.g. {example} — JPEG, PNG or WebP, max 5MB.
        {!required && " Falls back to the desktop image when empty."}
      </p>
      <Input id={inputId} ref={inputRef} type="file" accept={ACCEPT} aria-invalid={!!error} aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ""}`} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} className={fileInputClass} />
      {error && <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
      {error && onClear && !slot.preview && <button type="button" onClick={onClear} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Remove {label.toLowerCase()}</button>}
      {error && onReset && <button type="button" onClick={onReset} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Keep current {label.toLowerCase()}</button>}
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
  const d = initial;
  const originalPlacement: string | undefined = d?.placement;

  const [title, setTitle] = useState(d?.title ?? "");
  const [placement, setPlacement] = useState<string>(d?.placement ?? getPlacement(defaultPlacement).value);
  const [audience, setAudience] = useState<string>(d?.audience ?? ALL_AUDIENCES);
  const [linkPreset, setLinkPreset] = useState<string>(
    d?.linkType === "custom" ? "custom" : (d?.linkPreset ?? ADS_LINK_PRESETS[0].value),
  );
  const [linkCustom, setLinkCustom] = useState<string>(d?.linkCustom != null ? String(d.linkCustom) : "");
  const [isActive, setIsActive] = useState<boolean>(d?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingChecks, setPendingChecks] = useState({ desktop: false, mobile: false });
  const pendingImages = Number(pendingChecks.desktop) + Number(pendingChecks.mobile);
  const [imageErrors, setImageErrors] = useState<Partial<Record<"desktop" | "mobile", string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const pickVersions = useRef({ desktop: 0, mobile: 0 });

  const [desktop, setDesktop] = useState<ImageSlot>(() => slotFrom(d?.desktopImage));
  const [mobile, setMobile] = useState<ImageSlot>(() => slotFrom(d?.mobileImage));

  const spec = getPlacement(placement);
  const placementChanged = mode === "edit" && placement !== originalPlacement;
  const audienceOptions = [
    { label: "All — fallback", value: ALL_AUDIENCES },
    ...spec.audiences.map((a) => ({ label: a.label, value: a.value })),
  ];

  useEffect(() => () => { if (desktop.preview.startsWith("blob:")) URL.revokeObjectURL(desktop.preview); }, [desktop.preview]);
  useEffect(() => () => { if (mobile.preview.startsWith("blob:")) URL.revokeObjectURL(mobile.preview); }, [mobile.preview]);
  useEffect(() => () => { pickVersions.current.desktop++; pickVersions.current.mobile++; }, []);

  const changePlacement = (next: string) => {
    setPlacement(next);
    const nextSpec = getPlacement(next);
    if (!nextSpec.audiences.some((a) => a.value === audience)) setAudience(ALL_AUDIENCES);
    // Stored images were sized for the old slot; picked files may not fit the
    // new ratio either — start the images over so previews never mislead.
    if (next !== placement) {
      pickVersions.current.desktop++;
      pickVersions.current.mobile++;
      setImageErrors({});
      setPendingChecks({ desktop: false, mobile: false });
      setDesktop(next === originalPlacement ? slotFrom(d?.desktopImage) : slotFrom());
      setMobile(next === originalPlacement ? slotFrom(d?.mobileImage) : slotFrom());
    }
  };

  const pickFile = async (file: File | undefined, which: "desktop" | "mobile") => {
    if (!file) return;
    const version = ++pickVersions.current[which];
    setImageErrors((prev) => ({ ...prev, [which]: undefined }));
    setPendingChecks((prev) => ({ ...prev, [which]: false }));
    const err = validateAdImage(file);
    if (err) { setImageErrors((prev) => ({ ...prev, [which]: err })); return; }
    const slotSpec = which === "desktop" ? spec.desktop : spec.mobile;
    if (!slotSpec) return;
    setPendingChecks((prev) => ({ ...prev, [which]: true }));
    try {
      const actual = await readAdImageRatio(file);
      if (pickVersions.current[which] !== version) return;
      const expected = slotSpec.ratio[0] / slotSpec.ratio[1];
      if (!actual || Math.abs(actual - expected) / expected > RATIO_TOLERANCE) {
        setImageErrors((prev) => ({ ...prev, [which]: !actual ? "This image could not be read. Choose another file." : `Use a ${ratioLabel(slotSpec.ratio)} image, for example ${slotSpec.example} pixels.` }));
        return;
      }
      const setSlot = which === "desktop" ? setDesktop : setMobile;
      setSlot({ file, preview: URL.createObjectURL(file), touched: true, cleared: false });
    } catch {
      if (pickVersions.current[which] === version) setImageErrors((prev) => ({ ...prev, [which]: "This image could not be read. Choose another file." }));
    } finally {
      if (pickVersions.current[which] === version) setPendingChecks((prev) => ({ ...prev, [which]: false }));
    }
  };

  const clearMobile = () => {
    pickVersions.current.mobile++;
    setPendingChecks((prev) => ({ ...prev, mobile: false }));
    setImageErrors((prev) => ({ ...prev, mobile: undefined }));
    setMobile({ file: null, preview: "", touched: true, cleared: true });
  };

  const resetImage = (which: "desktop" | "mobile") => {
    pickVersions.current[which]++;
    setPendingChecks((prev) => ({ ...prev, [which]: false }));
    setImageErrors((prev) => ({ ...prev, [which]: undefined }));
    (which === "desktop" ? setDesktop : setMobile)(slotFrom(which === "desktop" ? d?.desktopImage : d?.mobileImage));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || pendingImages > 0 || Object.values(imageErrors).some(Boolean)) return;
    setFormError(null);
    const fail = (message: string) => setFormError(message);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return void fail("Title is required.");
    if (!desktop.file && !desktop.preview) return void fail(`${spec.desktop.label} is required.`);
    if (spec.mobile?.required && !mobile.file && !mobile.preview) return void fail("Mobile image is required.");
    if (placementChanged && !desktop.file) {
      return void fail("Each placement has its own image size — upload new images for the new placement.");
    }
    if (linkPreset === "custom") {
      const customPath = linkCustom.trim();
      if (!customPath) return void fail("Custom path is required when link is Custom.");
      if (!isInternalAdPath(customPath)) {
        return void fail("Custom path must be an internal path starting with “/” (e.g. /offers/diwali).");
      }
    }

    setIsSaving(true);
    try {
      // Upload only newly-picked files; edit mode keeps stored images otherwise.
      const desktopImageKey = desktop.file ? await adsApi.uploadTemp(desktop.file) : undefined;
      const mobileImageKey = spec.mobile && mobile.file ? await adsApi.uploadTemp(mobile.file) : undefined;

      const payload: AdSavePayload = {
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

      const result = mode === "create" ? await adsApi.create(payload) : await adsApi.update(d!.id, payload);
      if (result && result.success === false) {
        setFormError(result.message ?? `Failed to ${mode === "create" ? "create" : "update"} advertisement.`);
        return;
      }

      toast.success(mode === "create" ? "Advertisement created." : "Advertisement updated.");
      // Return to the saved placement/status so the result is immediately visible.
      try {
        sessionStorage.setItem(persistedStateKey("ads:placement"), JSON.stringify(placement));
        sessionStorage.setItem(persistedStateKey("ads:tab"), JSON.stringify(isActive ? "Active" : "Inactive"));
        sessionStorage.setItem(persistedStateKey("ads:search"), JSON.stringify(""));
      } catch { /* Saving still succeeds when browser storage is unavailable. */ }
      router.push("/ads");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save this advertisement. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4 md:px-0 mt-2 md:mt-0 mb-20 md:mb-0">
      <MobileHeader title={mode === "create" ? "Add Advertisement" : "Edit Advertisement"} showBack />

      <Link href="/ads" className="hidden md:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">← Back to advertisements</Link>

      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{mode === "create" ? "Add New Advertisement" : "Edit Advertisement"}</h1>
          <p className="text-sm text-muted-foreground mt-1">Pick where it shows on the site, upload the creative, and choose where a click goes.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset disabled={isSaving} className="bg-card border rounded-2xl p-4 md:p-8 shadow-sm space-y-6 disabled:opacity-70">
          <legend className="sr-only">Advertisement details</legend>
          <div className="space-y-2">
            <label htmlFor="ad-title" className={labelClass}>Title *</label>
            <Input id="ad-title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali Home Fest" required className={inputClass} />
            <p className="text-xs text-muted-foreground">Used as the image&apos;s alt text on the site.</p>
          </div>

          <div className={spec.audiences.length ? "grid grid-cols-1 md:grid-cols-2 gap-6" : ""}>
            <div className="space-y-2">
              <label htmlFor="ad-placement" className={labelClass}>Placement</label>
              <FormSelect
                id="ad-placement"
                name="placement"
                placeholder="Select placement"
                options={PLACEMENT_OPTIONS}
                value={placement}
                onValueChange={(v) => changePlacement(v || "hero")}
              />
            </div>
            {spec.audiences.length > 0 && (
              <div className="space-y-2">
                <label htmlFor="ad-audience" className={labelClass}>Show on</label>
                <FormSelect
                  id="ad-audience"
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
              key={`${placement}-desktop`}
              error={imageErrors.desktop}
              label={spec.desktop.label}
              ratio={spec.desktop.ratio}
              example={spec.desktop.example}
              required
              slot={desktop}
              mode={mode}
              onPick={(f) => pickFile(f, "desktop")}
              onReset={placement === originalPlacement && d?.desktopImage ? () => resetImage("desktop") : undefined}
              previewClass={spec.mobile ? "w-full" : "w-full max-w-sm"}
            />
            {spec.mobile && (
              <ImagePicker
                key={`${placement}-mobile`}
                error={imageErrors.mobile}
                label="Mobile image"
                ratio={spec.mobile.ratio}
                example={spec.mobile.example}
                required={spec.mobile.required}
                slot={mobile}
                mode={mode}
                onPick={(f) => pickFile(f, "mobile")}
                onReset={placement === originalPlacement && d?.mobileImage ? () => resetImage("mobile") : undefined}
                onClear={!spec.mobile.required ? clearMobile : undefined}
                previewClass={spec.mobile.ratio[0] < spec.mobile.ratio[1] ? "w-32" : "w-full"}
              />
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="ad-link" className={labelClass}>Click destination</label>
            <FormSelect id="ad-link" name="linkPreset" placeholder="Select link" options={LINK_PRESET_OPTIONS} value={linkPreset} onValueChange={(v) => setLinkPreset(v)} />
            <p className="text-xs text-muted-foreground">Buy and Rent links open for the visitor&apos;s selected city.</p>
          </div>

          {linkPreset === "custom" && (
            <div className="space-y-2">
              <label htmlFor="ad-custom-path" className={labelClass}>Custom path *</label>
              <Input id="ad-custom-path" maxLength={500} value={linkCustom} onChange={(e) => setLinkCustom(e.target.value)} placeholder="/offers/diwali" required className={inputClass} />
            </div>
          )}

          <label className="flex items-center space-x-3 bg-muted/10 border border-border/40 p-4 h-12 rounded-xl transition-colors hover:bg-muted/30 cursor-pointer">
            <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
            <span className="text-sm font-medium">Active on the website</span>
          </label>
        </fieldset>

        {formError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{formError}</div>}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => router.push("/ads")} className="h-12 px-4">Cancel</Button>
          <Button type="submit" disabled={isSaving || pendingImages > 0 || Object.values(imageErrors).some(Boolean)} className="h-12 px-8 rounded-xl bg-[#0052FF] hover:bg-[#0052FF]/90">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {pendingImages > 0 ? "Checking images…" : isSaving ? "Saving..." : mode === "create" ? "Create Advertisement" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
