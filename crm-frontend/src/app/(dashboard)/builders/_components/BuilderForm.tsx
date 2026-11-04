"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FOCUS_BUTTON, FOCUS_FIELD, FieldRow, FocusField, FocusModal, ToggleCard } from "@/components/shared/focus-modal";
import { StepFooter, StepSection, useFocusSteps } from "@/components/shared/focus-steps";
import { buildersApi } from "@/lib/builders-api";
import { propertiesApi } from "@/lib/properties-api";
import { cn } from "@/lib/utils";

export interface BuilderFormProps {
  mode: "create" | "edit";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the builder API's shape
  initial?: any;
  /** Opened over a page: close back to it. Without it, the form leaves for the list. */
  onClose?: () => void;
  /** Called with the saved builder's id. */
  onSuccess?: (id?: number) => void;
}

const BUILDER_STEPS = [
  { key: "company", label: "Company" },
  { key: "contact", label: "Contact" },
  { key: "record", label: "Track record" },
] as const;
type BuilderStep = (typeof BUILDER_STEPS)[number]["key"];

const field = cn(FOCUS_FIELD, "h-9");

export function BuilderForm({ mode, initial, onClose, onSuccess }: BuilderFormProps) {
  const router = useRouter();
  const d = initial;

  const [name, setName] = useState(d?.name ?? "");
  const [logoKey, setLogoKey] = useState<string>(d?.rawLogoKey ?? d?.logoUrl ?? "");
  const [logoPreview, setLogoPreview] = useState<string>(d?.logoUrl ?? "");
  const [phone, setPhone] = useState(d?.phone ?? "");
  const [email, setEmail] = useState(d?.email ?? "");
  const [website, setWebsite] = useState(d?.website ?? "");
  const [experienceYears, setExperienceYears] = useState(d?.experienceYears != null ? String(d.experienceYears) : "");
  const [completedProjects, setCompletedProjects] = useState(d?.completedProjects != null ? String(d.completedProjects) : "");
  const [ongoingProjects, setOngoingProjects] = useState(d?.ongoingProjects != null ? String(d.ongoingProjects) : "");
  const [description, setDescription] = useState(d?.description ?? "");
  const [isActive, setIsActive] = useState<boolean>(d?.isActive !== false);

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const create = mode === "create";
  const nav = useFocusSteps<BuilderStep>(BUILDER_STEPS, {
    create,
    problem: (key) => (key === "company" && !name.trim() ? "Builder name is required" : null),
  });

  const close = () => (onClose ? onClose() : router.push(d?.id ? `/builders/${d.id}` : "/builders"));

  const handleLogoUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      return;
    }
    setIsUploadingLogo(true);
    try {
      const res = await propertiesApi.uploadImages([file]);
      const item = res?.data?.[0];
      if (!res?.success || !item?.imageKey) throw new Error("Upload failed");
      setLogoKey(item.imageKey);
      setLogoPreview(URL.createObjectURL(file));
      toast.success("Logo uploaded successfully");
    } catch {
      toast.error("Failed to upload logo image");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Builder name is required");
      nav.go("company");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        logoUrl: logoKey.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        experienceYears: experienceYears.trim() === "" ? null : Number(experienceYears),
        completedProjects: completedProjects.trim() === "" ? 0 : Number(completedProjects),
        ongoingProjects: ongoingProjects.trim() === "" ? 0 : Number(ongoingProjects),
        description: description.trim() || undefined,
        isActive,
      };

      let id: number | undefined = d?.id;
      if (create) {
        const result = await buildersApi.create(payload);
        id = (result?.data ?? result)?.id;
        toast.success("Builder created successfully");
      } else {
        await buildersApi.update(d.id, payload);
        toast.success("Builder updated successfully");
      }
      if (onSuccess) onSuccess(id);
      else router.push(id ? `/builders/${id}` : "/builders");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to save builder");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FocusModal
      open
      onOpenChange={(o) => { if (!o && !isSaving) close(); }}
      title={create ? "New builder" : "Edit builder"}
      steps={nav.steps}
      active={nav.step}
      onStepChange={(k) => nav.jump(k as BuilderStep)}
      footer={
        <StepFooter nav={nav} create={create} saving={isSaving} disabled={isUploadingLogo} onCancel={close} onSave={() => void save()} createLabel="Create builder" />
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (create && !nav.last) nav.next();
          else void save();
        }}
      >
        <StepSection title="Company" description="The builder's name and logo, as shown on project pages." hidden={nav.step !== "company"}>
          <FocusField label="Logo">
            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30">
                {logoPreview ? (
                  <>
                    {/* A plain img: logos come from the CDN or a just-picked file, and next/image has no hosts configured. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="Logo preview" className="absolute inset-0 h-full w-full object-contain p-1.5" />
                    <button
                      type="button"
                      onClick={() => { setLogoKey(""); setLogoPreview(""); }}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                      title="Remove logo"
                      aria-label="Remove logo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <span className="text-[12px] text-muted-foreground">No logo</span>
                )}
              </div>
              <label className={cn(FOCUS_BUTTON.secondary, "cursor-pointer")}>
                {isUploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {isUploadingLogo ? "Uploading…" : logoPreview ? "Replace logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  disabled={isUploadingLogo}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void handleLogoUpload(file);
                  }}
                />
              </label>
            </div>
          </FocusField>
          <FieldRow>
            <FocusField label="Builder name" htmlFor="bf-name" required>
              <Input id="bf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Prestige Group" autoFocus className={field} />
            </FocusField>
            <FocusField label="Website" htmlFor="bf-website" optional>
              <Input id="bf-website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" className={field} />
            </FocusField>
          </FieldRow>
          <FocusField label="About the builder" htmlFor="bf-about" optional>
            <Textarea id="bf-about" rows={5} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Company background, history, philosophy…" className={cn(FOCUS_FIELD, "resize-y py-2")} />
          </FocusField>
        </StepSection>

        <StepSection title="Contact" description="How the team reaches the builder." hidden={nav.step !== "contact"}>
          <FieldRow>
            <FocusField label="Mobile number" htmlFor="bf-phone" optional>
              <Input id="bf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className={field} />
            </FocusField>
            <FocusField label="Email address" htmlFor="bf-email" optional>
              <Input id="bf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@builder.com" className={field} />
            </FocusField>
          </FieldRow>
        </StepSection>

        <StepSection title="Track record" description="Shown on the builder's profile on the website." hidden={nav.step !== "record"}>
          <FieldRow cols={3}>
            <FocusField label="Experience (years)" htmlFor="bf-exp">
              <Input id="bf-exp" type="number" min="0" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} placeholder="e.g. 15" className={field} />
            </FocusField>
            <FocusField label="Completed projects" htmlFor="bf-done">
              <Input id="bf-done" type="number" min="0" value={completedProjects} onChange={(e) => setCompletedProjects(e.target.value)} placeholder="e.g. 24" className={field} />
            </FocusField>
            <FocusField label="Ongoing projects" htmlFor="bf-ongoing">
              <Input id="bf-ongoing" type="number" min="0" value={ongoingProjects} onChange={(e) => setOngoingProjects(e.target.value)} placeholder="e.g. 3" className={field} />
            </FocusField>
          </FieldRow>
          <ToggleCard checked={isActive} onCheckedChange={setIsActive} title="Active" description="Active builders can be picked on projects." />
        </StepSection>
      </form>
    </FocusModal>
  );
}
