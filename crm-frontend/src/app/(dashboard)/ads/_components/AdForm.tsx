"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/shared/form-select";
import { FOCUS_BUTTON, FOCUS_FIELD, FieldRow, FocusField, FocusModal, ToggleCard } from "@/components/shared/focus-modal";
import { FOCUS_INPUT, FOCUS_SELECT, StepFooter, StepSection, useFocusSteps } from "@/components/shared/focus-steps";
import { cn } from "@/lib/utils";
import { validateAdImage, isInternalAdPath, readAdImageRatio } from "@/lib/ads-validation";
import { persistedStateKey } from "@/hooks/use-persisted-state";
import { adsApi, type Advertisement, type AdSavePayload } from "@/lib/ads-api";
import { ADS_LINK_PRESETS, ADS_PLACEMENTS, getPlacement, ratioLabel, type AdRatio } from "@/lib/ads-link-presets";

export interface AdFormProps {
  mode: "create" | "edit";
  initial?: Advertisement;
  /** Preselected placement for a new ad (from the list page's current tab). */
  defaultPlacement?: string;
  /** Opened over a page: close back to it. Without it, the form leaves for the list. */
  onClose?: () => void;
  /** Called once saved, with where the ad now shows. */
  onSuccess?: (saved: { id?: number; placement: string; isActive: boolean }) => void;
}

const AD_STEPS = [
  { key: "placement", label: "Placement" },
  { key: "images", label: "Images" },
  { key: "link", label: "Link & status" },
] as const;
type AdStep = (typeof AD_STEPS)[number]["key"];

const labelClass = "flex items-center gap-1 text-[14px] font-medium text-foreground";
const fileInputClass = cn(FOCUS_FIELD, "h-9 py-1 file:mr-3 file:h-6 file:rounded file:border-0 file:bg-muted file:px-2.5 file:text-[13px] file:font-medium");
const secondaryButton = cn(FOCUS_BUTTON.secondary, "w-fit");
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
        {label}
        {required ? <span aria-hidden className="-ml-0.5 text-red-500">*</span> : <span className="font-normal text-muted-foreground">(Optional)</span>}
      </label>
      <p id={`${inputId}-hint`} className="text-[13px] text-muted-foreground">
        {ratioLabel(ratio)}, e.g. {example} — JPEG, PNG or WebP, max 5MB.
        {!required && " Falls back to the desktop image when empty."}
      </p>
      <Input id={inputId} ref={inputRef} type="file" accept={ACCEPT} aria-invalid={!!error} aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ""}`} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} className={fileInputClass} />
      {error && <p id={`${inputId}-error`} role="alert" className="text-[13px] text-red-600 dark:text-red-400">{error}</p>}
      {error && onClear && !slot.preview && <button type="button" onClick={onClear} className={secondaryButton}>Remove {label.toLowerCase()}</button>}
      {error && onReset && <button type="button" onClick={onReset} className={secondaryButton}>Keep current {label.toLowerCase()}</button>}
      {slot.preview ? (
        <div className="space-y-1">
          <div className="relative inline-block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slot.preview}
              alt={`${label} preview`}
              style={{ aspectRatio: `${ratio[0]} / ${ratio[1]}` }}
              className={"rounded-lg border object-cover bg-muted " + previewClass}
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
            <p className="text-[13px] text-muted-foreground">Current image — pick a new file to replace it.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AdForm({ mode, initial, defaultPlacement, onClose, onSuccess }: AdFormProps) {
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

  /** What a step still needs, by the same rules as saving. */
  const stepProblem = (key: AdStep): string | null => {
    if (key === "placement" && !title.trim()) return "Title is required.";
    if (key === "images") {
      if (pendingImages > 0) return "Wait for the images to be checked.";
      const imageError = imageErrors.desktop ?? imageErrors.mobile;
      if (imageError) return imageError;
      if (!desktop.file && !desktop.preview) return `${spec.desktop.label} is required.`;
      if (spec.mobile?.required && !mobile.file && !mobile.preview) return "Mobile image is required.";
      if (placementChanged && !desktop.file) return "Each placement has its own image size — upload new images for the new placement.";
    }
    if (key === "link" && linkPreset === "custom") {
      const customPath = linkCustom.trim();
      if (!customPath) return "Custom path is required when link is Custom.";
      if (!isInternalAdPath(customPath)) return "Custom path must be an internal path starting with “/” (e.g. /offers/diwali).";
    }
    return null;
  };
  const create = mode === "create";
  const nav = useFocusSteps<AdStep>(AD_STEPS, { create, problem: stepProblem });
  const close = () => (onClose ? onClose() : router.push(d?.id ? `/ads/${d.id}` : "/ads"));

  const handleSubmit = async () => {
    if (isSaving || pendingImages > 0 || Object.values(imageErrors).some(Boolean)) return;
    setFormError(null);
    // Show the step that's missing something, with the reason.
    for (const { key } of AD_STEPS) {
      const problem = stepProblem(key);
      if (problem) {
        setFormError(problem);
        nav.go(key);
        return;
      }
    }
    const trimmedTitle = title.trim();

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
      if (onSuccess) {
        onSuccess({ id: d?.id ?? (result?.data ?? result)?.id, placement, isActive });
        return;
      }
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
    <FocusModal
      open
      onOpenChange={(o) => { if (!o && !isSaving) close(); }}
      title={create ? "New advertisement" : "Edit advertisement"}
      steps={nav.steps}
      active={nav.step}
      onStepChange={(k) => nav.jump(k as AdStep)}
      footer={
        <StepFooter nav={nav} create={create} saving={isSaving} onCancel={close} onSave={() => void handleSubmit()} createLabel="Create advertisement"
          disabled={pendingImages > 0 || Object.values(imageErrors).some(Boolean)} />
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (create && !nav.last) nav.next();
          else void handleSubmit();
        }}
      >
        {formError && <div role="alert" className="mb-8 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-[14px] text-red-700 dark:text-red-400">{formError}</div>}
        <fieldset disabled={isSaving} className="min-w-0 disabled:opacity-70">
          <legend className="sr-only">Advertisement details</legend>

          <StepSection title="Placement" description="Where the ad shows on the website." hidden={nav.step !== "placement"}>
            <FocusField label="Title" htmlFor="ad-title" required hint="Used as the image's alt text on the site.">
              <Input id="ad-title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali Home Fest" autoFocus className={FOCUS_INPUT} />
            </FocusField>
            {spec.audiences.length ? (
              <FieldRow>
                <FocusField label="Placement" htmlFor="ad-placement">
                  <FormSelect id="ad-placement" name="placement" placeholder="Select placement" options={PLACEMENT_OPTIONS} value={placement} onValueChange={(v) => changePlacement(v || "hero")} className={FOCUS_SELECT} />
                </FocusField>
                <FocusField label="Show on" htmlFor="ad-audience">
                  <FormSelect id="ad-audience" name="audience" placeholder="Select audience" options={audienceOptions} value={audience} onValueChange={(v) => setAudience(v || ALL_AUDIENCES)} className={FOCUS_SELECT} />
                </FocusField>
              </FieldRow>
            ) : (
              <FocusField label="Placement" htmlFor="ad-placement">
                <FormSelect id="ad-placement" name="placement" placeholder="Select placement" options={PLACEMENT_OPTIONS} value={placement} onValueChange={(v) => changePlacement(v || "hero")} className={FOCUS_SELECT} />
              </FocusField>
            )}
            <p className="-mt-2 text-[13px] text-muted-foreground">{spec.description}</p>
            {placementChanged && (
              <p className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
                Moving to a different placement needs new images sized for it.
              </p>
            )}
          </StepSection>

          <StepSection title="Images" description={`Sized for ${spec.label.toLowerCase()}.`} hidden={nav.step !== "images"}>
            <div className={spec.mobile ? "grid grid-cols-1 gap-6 md:grid-cols-2" : ""}>
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
            {pendingImages > 0 && (
              <p role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking images…</p>
            )}
          </StepSection>

          <StepSection title="Link & status" description="Where a click goes, and whether the ad is live." hidden={nav.step !== "link"}>
            <FocusField label="Click destination" htmlFor="ad-link" hint="Buy and Rent links open for the visitor's selected city.">
              <FormSelect id="ad-link" name="linkPreset" placeholder="Select link" options={LINK_PRESET_OPTIONS} value={linkPreset} onValueChange={(v) => setLinkPreset(v)} className={FOCUS_SELECT} />
            </FocusField>
            {linkPreset === "custom" && (
              <FocusField label="Custom path" htmlFor="ad-custom-path" required>
                <Input id="ad-custom-path" maxLength={500} value={linkCustom} onChange={(e) => setLinkCustom(e.target.value)} placeholder="/offers/diwali" className={FOCUS_INPUT} />
              </FocusField>
            )}
            <ToggleCard checked={isActive} onCheckedChange={setIsActive} title="Active on the website" description="Inactive ads are kept but not shown." />
          </StepSection>
        </fieldset>
      </form>
    </FocusModal>
  );
}
