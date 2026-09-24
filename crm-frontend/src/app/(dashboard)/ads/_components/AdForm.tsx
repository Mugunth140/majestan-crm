"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/shared/form-select";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ApiError } from "@/lib/api-fetch";
import { adsApi } from "@/lib/ads-api";
import { ADS_LINK_PRESETS, ADS_PLACEMENTS } from "@/lib/ads-link-presets";

export interface AdFormProps {
  mode: "create" | "edit";
  initial?: any;
}

const labelClass = "text-xs font-bold uppercase tracking-wider text-muted-foreground";
const inputClass = "h-12 rounded-xl bg-muted/30";
const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const PLACEMENT_OPTIONS = ADS_PLACEMENTS.map((p) => ({ label: p.label, value: p.value }));
const LINK_PRESET_OPTIONS = ADS_LINK_PRESETS.map((p) => ({ label: p.label, value: p.value }));

function checkFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return `"${file.name}" exceeds 5MB. Please pick a smaller file.`;
  return null;
}

export function AdForm({ mode, initial }: AdFormProps) {
  const router = useRouter();
  const d = initial as any;

  const [title, setTitle] = useState(d?.title ?? "");
  const [placement, setPlacement] = useState<string>(d?.placement ?? "hero");
  const [linkPreset, setLinkPreset] = useState<string>(
    d?.linkPreset ?? (d?.linkType === "custom" ? "custom" : ADS_LINK_PRESETS[0].value),
  );
  const [linkCustom, setLinkCustom] = useState<string>(d?.linkCustom != null ? String(d.linkCustom) : "");
  const [isActive, setIsActive] = useState<boolean>(d?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);

  // Desktop image: newly-picked file + preview, or the stored image in edit mode.
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [desktopPreview, setDesktopPreview] = useState<string>(d?.desktopImage ?? "");
  const [desktopTouched, setDesktopTouched] = useState(false);
  // Mobile image: same pattern.
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [mobilePreview, setMobilePreview] = useState<string>(d?.mobileImage ?? "");
  const [mobileTouched, setMobileTouched] = useState(false);

  // Revoke blob preview URLs on unmount / replace.
  useEffect(() => {
    return () => {
      if (desktopPreview.startsWith("blob:")) URL.revokeObjectURL(desktopPreview);
      if (mobilePreview.startsWith("blob:")) URL.revokeObjectURL(mobilePreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickFile = (
    file: File | undefined,
    setFile: (f: File | null) => void,
    setPreview: React.Dispatch<React.SetStateAction<string>>,
    setTouched: (b: boolean) => void,
  ) => {
    if (!file) return;
    const err = checkFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setFile(file);
    setPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setTouched(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Title is required.");
      return;
    }
    if (mode === "create" && !desktopFile && !desktopPreview) {
      toast.error("Desktop image is required.");
      return;
    }
    if (mode === "create" && !mobileFile && !mobilePreview) {
      toast.error("Mobile image is required.");
      return;
    }
    if (linkPreset === "custom") {
      if (!linkCustom.trim()) {
        toast.error("Custom path is required when link is Custom.");
        return;
      }
      const customPath = linkCustom.trim();
      if (!/^\/[^/\s]/.test(customPath)) {
        toast.error("Custom path must be an internal path starting with “/” (e.g. /offers/diwali).");
        return;
      }
    }

    setIsSaving(true);
    try {
      // Upload only newly-picked files; edit mode keeps stored images otherwise.
      let desktopImageKey: string | undefined;
      let mobileImageKey: string | undefined;
      if (desktopFile) desktopImageKey = await adsApi.uploadTemp(desktopFile);
      if (mobileFile) mobileImageKey = await adsApi.uploadTemp(mobileFile);

      const payload: Record<string, any> = {
        title: trimmedTitle,
        placement,
        linkType: linkPreset === "custom" ? "custom" : "preset",
        linkPreset,
        isActive,
      };
      if (linkPreset === "custom") {
        payload.linkCustom = linkCustom.trim();
      }
      if (desktopImageKey) payload.desktopImageKey = desktopImageKey;
      if (mobileImageKey) payload.mobileImageKey = mobileImageKey;
      // Create always needs both keys; in edit mode keys are only sent on re-pick.
      if (mode === "create") {
        if (!desktopImageKey || !mobileImageKey) {
          toast.error("Both desktop and mobile images are required.");
          return;
        }
      }

      let result: any;
      if (mode === "create") {
        result = await adsApi.create(payload);
      } else {
        result = await adsApi.update(d.id, payload);
      }

      if (result && result.success === false) {
        toast.error(result.message ?? `Failed to ${mode === "create" ? "create" : "update"} ad.`);
        return;
      }

      toast.success(mode === "create" ? "Ad created successfully!" : "Ad updated successfully!");
      router.push("/ads");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("An unexpected error occurred.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2.5 md:px-0 mt-2 md:mt-0 mb-20 md:mb-0">
      <MobileHeader title={mode === "create" ? "Add Ad" : "Edit Ad"} showBack />

      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{mode === "create" ? "Add New Ad" : "Edit Ad"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "create" ? "Upload both creatives for the hero carousel." : "Update this hero carousel ad."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card border rounded-2xl p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <label className={labelClass}>Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Diwali Home Fest"
              required
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Placement</label>
            <FormSelect
              name="placement"
              placeholder="Select placement"
              options={PLACEMENT_OPTIONS}
              value={placement}
              onValueChange={(v) => setPlacement(v || "hero")}
              disabled
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className={labelClass}>Desktop image *</label>
              <p className="text-xs text-muted-foreground">32:9, e.g. 1920×540 — JPEG, PNG or WebP, max 5MB.</p>
              <Input
                type="file"
                accept={ACCEPT}
                onChange={(e) => pickFile(e.target.files?.[0], setDesktopFile, setDesktopPreview, setDesktopTouched)}
                className="h-12 rounded-xl bg-muted/30 file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              {desktopPreview ? (
                <div className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={desktopPreview}
                    alt="Desktop preview"
                    className="w-full aspect-[32/9] rounded-xl border border-border/60 object-cover bg-muted"
                  />
                  {mode === "edit" && !desktopTouched && (
                    <p className="text-xs text-muted-foreground">Current image — pick a new file to replace it.</p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Mobile image *</label>
              <p className="text-xs text-muted-foreground">4:5, e.g. 1080×1350 — JPEG, PNG or WebP, max 5MB.</p>
              <Input
                type="file"
                accept={ACCEPT}
                onChange={(e) => pickFile(e.target.files?.[0], setMobileFile, setMobilePreview, setMobileTouched)}
                className="h-12 rounded-xl bg-muted/30 file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              {mobilePreview ? (
                <div className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mobilePreview}
                    alt="Mobile preview"
                    className="w-32 aspect-[4/5] rounded-xl border border-border/60 object-cover bg-muted"
                  />
                  {mode === "edit" && !mobileTouched && (
                    <p className="text-xs text-muted-foreground">Current image — pick a new file to replace it.</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Link</label>
            <FormSelect
              name="linkPreset"
              placeholder="Select link"
              options={LINK_PRESET_OPTIONS}
              value={linkPreset}
              onValueChange={(v) => setLinkPreset(v)}
            />
          </div>

          {linkPreset === "custom" && (
            <div className="space-y-2">
              <label className={labelClass}>Custom path *</label>
              <Input
                value={linkCustom}
                onChange={(e) => setLinkCustom(e.target.value)}
                placeholder="/offers/diwali"
                required
                className={inputClass}
              />
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
            {isSaving ? "Saving..." : mode === "create" ? "Create Ad" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
