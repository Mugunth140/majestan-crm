"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, FileText, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { propertiesApi } from "@/lib/properties-api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getFloorPlanTitle } from "./property-form-documents";

export interface PropertyFloorPlan {
  fileKey: string;
  fileName: string;
  fileUrl?: string;
  mimeType?: string;
  fileSize?: number;
  title?: string;
}

export interface PropertyFloorPlansSectionProps {
  plans: PropertyFloorPlan[];
  onChange: (plans: PropertyFloorPlan[]) => void;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
}

type UploadedDocument = PropertyFloorPlan;

interface UploadDocumentsResponse {
  success?: boolean;
  data?: UploadedDocument[];
}

export const MAX_FLOOR_PLANS = 5;
export const MAX_FLOOR_PLAN_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

export function validateFloorPlanFile(file: Pick<File, "name" | "type" | "size">): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.type ? !ALLOWED_MIME_TYPES.has(file.type.toLowerCase()) : !ALLOWED_EXTENSIONS.has(extension)) {
    return `${file.name} must be a PDF, JPG, PNG, or WebP file.`;
  }
  if (!file.size) return `${file.name} is empty. Choose a file with content.`;
  if (file.size > MAX_FLOOR_PLAN_FILE_SIZE) return `${file.name} exceeds the 15 MB limit.`;
  return null;
}

export function removeFloorPlan(plans: PropertyFloorPlan[], index: number): PropertyFloorPlan[] {
  return plans.filter((_, planIndex) => planIndex !== index);
}

export function nextFloorPlanIndex(currentIndex: number, step: number, count: number): number {
  return count > 0 ? (currentIndex + step + count) % count : -1;
}

export function isCrossOriginLocalPdf(url: string, currentOrigin: string): boolean {
  try {
    const parsed = new URL(url, currentOrigin);
    return parsed.pathname.startsWith("/local/") && parsed.origin !== currentOrigin;
  } catch {
    return false;
  }
}

function formatFileSize(size?: number) {
  if (size == null || !Number.isFinite(size)) return "Floor plan";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PropertyFloorPlansSection({
  plans,
  onChange,
  disabled = false,
  onUploadingChange,
}: PropertyFloorPlansSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [previewFileKey, setPreviewFileKey] = useState<string | null>(null);
  const [previewSession, setPreviewSession] = useState(0);
  const [localPreviewUrls, setLocalPreviewUrls] = useState<Record<string, string>>({});
  const [imageFailed, setImageFailed] = useState(false);
  const [localPdfResult, setLocalPdfResult] = useState<{ fileKey: string; session: number; url?: string; failed?: boolean } | null>(null);
  const localPreviewUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const activeKeys = new Set(plans.map((plan) => plan.fileKey));
    const next = { ...localPreviewUrlsRef.current };
    for (const [fileKey, url] of Object.entries(next)) {
      if (!activeKeys.has(fileKey)) {
        URL.revokeObjectURL(url);
        delete next[fileKey];
      }
    }
    localPreviewUrlsRef.current = next;
    setLocalPreviewUrls(next);
  }, [plans]);

  useEffect(() => () => {
    Object.values(localPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length || uploadingRef.current || disabled) return;
    const selected = Array.from(fileList);
    const remaining = MAX_FLOOR_PLANS - plans.length;
    if (remaining <= 0) {
      toast.error("You can add up to five floor plans.");
      return;
    }

    const accepted: File[] = [];
    const errors: string[] = [];
    for (const file of selected) {
      const validationError = validateFloorPlanFile(file);
      if (validationError) errors.push(validationError);
      else if (accepted.length < remaining) accepted.push(file);
      else errors.push(`${file.name} was not added. You can add up to five floor plans.`);
    }
    errors.forEach((error) => toast.error(error));
    if (!accepted.length) return;

    uploadingRef.current = true;
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const result = (await propertiesApi.uploadDocs(accepted)) as UploadDocumentsResponse;
      const uploadedItems = Array.isArray(result?.data) ? result.data : [];
      if (!result?.success || uploadedItems.length !== accepted.length || uploadedItems.some((item) => !item?.fileKey)) {
        throw new Error("The floor plans could not be uploaded. Please try again.");
      }

      const mapped = accepted.map((file, index) => {
        const item = uploadedItems[index];
        const previewUrl = URL.createObjectURL(file);
        localPreviewUrlsRef.current[item.fileKey] = previewUrl;
        return {
          fileKey: item.fileKey,
          fileName: item.fileName || file.name,
          fileUrl: item.fileUrl,
          mimeType: item.mimeType || file.type,
          fileSize: item.fileSize ?? file.size,
          title: getFloorPlanTitle({ title: item.title, fileName: item.fileName || file.name }),
        } satisfies PropertyFloorPlan;
      });
      setLocalPreviewUrls({ ...localPreviewUrlsRef.current });
      onChange([...plans, ...mapped]);
      toast.success(`${mapped.length} floor plan${mapped.length === 1 ? "" : "s"} uploaded.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The floor plans could not be uploaded. Please try again.");
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      onUploadingChange?.(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const previewPlan = plans.find((plan) => plan.fileKey === previewFileKey) ?? null;
  const previewUrl = previewPlan ? localPreviewUrls[previewPlan.fileKey] || previewPlan.fileUrl : undefined;
  const previewIndex = previewPlan ? plans.findIndex((plan) => plan.fileKey === previewPlan.fileKey) : -1;
  const isPdf = previewPlan?.mimeType?.toLowerCase() === "application/pdf" || previewPlan?.fileName.toLowerCase().endsWith(".pdf");
  const activePreviewFileKey = previewPlan?.fileKey;
  const requiresLocalPdfFetch = Boolean(previewUrl && isPdf && !previewUrl.startsWith("blob:") && isCrossOriginLocalPdf(previewUrl, typeof window === "undefined" ? "http://localhost" : window.location.origin));

  useEffect(() => {
    if (!activePreviewFileKey || !previewUrl || !requiresLocalPdfFetch) {
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;
    let active = true;
    void fetch(previewUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`PDF request failed with status ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        if (!blob.size) throw new Error("PDF response was empty");
        objectUrl = URL.createObjectURL(blob);
          setLocalPdfResult({ fileKey: activePreviewFileKey, session: previewSession, url: objectUrl });
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setLocalPdfResult({ fileKey: activePreviewFileKey, session: previewSession, failed: true });
        }
      });

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activePreviewFileKey, previewUrl, previewSession, requiresLocalPdfFetch]);

  const currentLocalPdfResult = localPdfResult && localPdfResult.fileKey === previewPlan?.fileKey && localPdfResult.session === previewSession ? localPdfResult : null;
  const currentLocalPdfPreview = currentLocalPdfResult?.url;
  const renderedPdfUrl = requiresLocalPdfFetch ? currentLocalPdfPreview : previewUrl;
  const openPreview = (plan: PropertyFloorPlan) => {
    setPreviewSession((session) => session + 1);
    setImageFailed(false);
    setPreviewFileKey(plan.fileKey);
  };
  const closePreview = () => {
    setPreviewSession((session) => session + 1);
    setPreviewFileKey(null);
  };
  const movePreview = (step: number) => {
    if (previewIndex < 0 || plans.length < 2) return;
    const nextIndex = nextFloorPlanIndex(previewIndex, step, plans.length);
    openPreview(plans[nextIndex]);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-8" aria-labelledby="property-floor-plans-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="property-floor-plans-title" className="text-lg font-semibold text-foreground">Floor plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add up to five plans and name each floor. PDF, JPG, PNG, or WebP, up to 15 MB each.</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground" aria-live="polite">
          {plans.length} of {MAX_FLOOR_PLANS}
        </span>
      </div>

      {plans.length > 0 ? (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border" aria-label="Uploaded floor plans">
          {plans.map((plan, index) => (
            <li key={`${plan.fileKey}-${index}`} className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor={`pf-floorPlanName-${index}`} className="block text-xs font-medium text-muted-foreground">Floor name</label>
                <input
                  id={`pf-floorPlanName-${index}`}
                  name={`floorPlanName-${index}`}
                  value={plan.title ?? getFloorPlanTitle(plan)}
                  onChange={(event) => onChange(plans.map((other, otherIndex) => otherIndex === index ? { ...other, title: event.target.value } : other))}
                  placeholder="e.g. Ground floor"
                  maxLength={255}
                  required
                  disabled={disabled || uploading}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
                <p className="mt-1 truncate text-xs text-muted-foreground" title={plan.fileName}>{plan.fileName} · {formatFileSize(plan.fileSize)}</p>
              </div>
              <button
                type="button"
                onClick={() => openPreview(plan)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Preview ${plan.fileName || plan.title}`}
              >Preview</button>
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => onChange(removeFloorPlan(plans, index))}
                className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Remove ${plan.fileName || plan.title}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <UploadCloud className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-medium text-foreground">No floor plans added</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload a plan to help buyers understand the layout.</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={disabled || uploading || plans.length >= MAX_FLOOR_PLANS}
        onChange={(event) => void handleFiles(event.currentTarget.files)}
        aria-label="Choose floor plan files"
      />
      <button
        type="button"
        disabled={disabled || uploading || plans.length >= MAX_FLOOR_PLANS}
        onClick={() => inputRef.current?.click()}
        className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        {uploading ? "Uploading floor plans…" : "Add floor plans"}
      </button>

      <Dialog open={Boolean(previewPlan)} onOpenChange={(open) => { if (!open) closePreview(); }}>
        {previewPlan && (
          <DialogContent
            className="flex h-dvh w-screen max-w-none flex-col gap-3 overflow-hidden rounded-none border-0 p-3 sm:max-w-none sm:p-5"
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") { event.preventDefault(); movePreview(-1); }
              if (event.key === "ArrowRight") { event.preventDefault(); movePreview(1); }
            }}
          >
            <DialogHeader className="shrink-0 pr-9">
              <DialogTitle className="truncate">{getFloorPlanTitle(previewPlan) || "Floor plan"}</DialogTitle>
              <DialogDescription className="sr-only">Floor plan preview. Use the previous and next buttons or left and right arrow keys to browse plans.</DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-muted/40">
              {previewUrl ? (isPdf ? (
                requiresLocalPdfFetch && currentLocalPdfResult?.failed ? (
                  <p className="px-6 text-center text-sm text-muted-foreground" role="alert">This PDF could not be loaded for preview. Check the file connection and try again.</p>
                ) : requiresLocalPdfFetch && !currentLocalPdfPreview ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Preparing PDF preview…</p>
                ) : (
                  <iframe title={`Preview of ${previewPlan.fileName}`} src={renderedPdfUrl} className="h-full w-full border-0" />
                )
              ) : imageFailed ? (
                <p role="alert" className="px-6 text-center text-sm text-muted-foreground">This image could not be loaded. Try another floor plan or check the file.</p>
              ) : (
                <Image key={previewPlan.fileKey} unoptimized width={1600} height={1200} src={previewUrl} alt={`Floor plan: ${previewPlan.fileName}`} onError={() => setImageFailed(true)} className="max-h-full max-w-full object-contain" />
              )) : (
                <p role="alert" className="px-6 text-center text-sm text-muted-foreground">A preview is not available for this floor plan.</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2 overflow-x-auto py-1" role="group" aria-label="Choose a floor plan">
              {plans.map((plan) => (
                <button key={plan.fileKey} type="button" onClick={() => openPreview(plan)} aria-pressed={plan.fileKey === previewPlan.fileKey}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${plan.fileKey === previewPlan.fileKey ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {getFloorPlanTitle(plan) || "Floor plan"}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3">
              <button type="button" onClick={() => movePreview(-1)} disabled={plans.length < 2} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50" aria-label="Previous floor plan"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Previous</button>
              <span className="min-w-0 truncate text-center text-xs text-muted-foreground" aria-live="polite">{previewIndex + 1} of {plans.length} · {getFloorPlanTitle(previewPlan)}</span>
              <button type="button" onClick={() => movePreview(1)} disabled={plans.length < 2} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50" aria-label="Next floor plan">Next<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
