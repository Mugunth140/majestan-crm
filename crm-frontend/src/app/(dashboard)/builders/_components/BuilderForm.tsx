"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Upload, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MobileHeader } from "@/components/layout/mobile-header";
import { buildersApi } from "@/lib/builders-api";
import { propertiesApi } from "@/lib/properties-api";

export interface BuilderFormProps {
  mode: "create" | "edit";
  initial?: any;
}

const labelClass = "text-xs font-bold uppercase tracking-wider text-muted-foreground";
const inputClass = "h-12 rounded-xl bg-muted/30";

export function BuilderForm({ mode, initial }: BuilderFormProps) {
  const router = useRouter();
  const d = initial as any;

  const [name, setName] = useState(d?.name ?? "");
  const [logoKey, setLogoKey] = useState<string>(d?.rawLogoKey ?? d?.logoUrl ?? "");
  const [logoPreview, setLogoPreview] = useState<string>(d?.logoUrl ?? "");
  const [phone, setPhone] = useState(d?.phone ?? "");
  const [email, setEmail] = useState(d?.email ?? "");
  const [website, setWebsite] = useState(d?.website ?? "");
  const [experienceYears, setExperienceYears] = useState(
    d?.experienceYears != null ? String(d.experienceYears) : ""
  );
  const [completedProjects, setCompletedProjects] = useState(
    d?.completedProjects != null ? String(d.completedProjects) : ""
  );
  const [ongoingProjects, setOngoingProjects] = useState(
    d?.ongoingProjects != null ? String(d.ongoingProjects) : ""
  );
  const [description, setDescription] = useState(d?.description ?? "");
  const [isActive, setIsActive] = useState<boolean>(d?.isActive !== false);

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      return;
    }
    setIsUploadingLogo(true);
    try {
      const res = await propertiesApi.uploadImages([file]);
      const item = res?.data?.[0];
      if (!res?.success || !item?.imageKey) {
        throw new Error("Upload failed");
      }
      setLogoKey(item.imageKey);
      setLogoPreview(URL.createObjectURL(file));
      toast.success("Logo uploaded successfully");
    } catch {
      toast.error("Failed to upload logo image");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoKey("");
    setLogoPreview("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Builder name is required");
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        logoUrl: logoKey.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        experienceYears:
          experienceYears.trim() === "" ? null : Number(experienceYears),
        completedProjects:
          completedProjects.trim() === "" ? 0 : Number(completedProjects),
        ongoingProjects:
          ongoingProjects.trim() === "" ? 0 : Number(ongoingProjects),
        description: description.trim() || undefined,
        isActive,
      };

      if (mode === "create") {
        await buildersApi.create(payload);
        toast.success("Builder created successfully");
      } else {
        await buildersApi.update(d.id, payload);
        toast.success("Builder updated successfully");
      }
      router.push("/builders");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save builder");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2.5 md:px-0 mt-2 md:mt-0 mb-20 md:mb-0">
      <MobileHeader
        title={mode === "create" ? "Add Builder" : "Edit Builder"}
        showBack
      />

      {/* Desktop Header */}
      <div className="hidden md:flex items-center gap-4 min-h-[48px]">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={() => router.push("/builders")}
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === "create" ? "Add New Builder" : "Edit Builder"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Card */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
            Basic Information
          </h3>

          {/* Logo Upload Section */}
          <div className="space-y-2">
            <label className={labelClass}>Logo</label>
            <div className="flex items-center gap-4 pt-1">
              <div className="relative h-20 w-20 rounded-xl border border-dashed border-border bg-muted/20 overflow-hidden flex items-center justify-center shrink-0">
                {logoPreview ? (
                  <>
                    <Image
                      src={logoPreview}
                      alt="Logo preview"
                      fill
                      className="object-contain p-1.5"
                      unoptimized={logoPreview.startsWith("blob:")}
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                      title="Remove logo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground font-medium">No Logo</span>
                )}
              </div>

              <div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/60 hover:bg-muted text-sm font-medium border border-border/60 transition-colors">
                    {isUploadingLogo ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#0052FF]" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {isUploadingLogo ? "Uploading..." : "Upload Logo"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={isUploadingLogo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className={labelClass}>Builder Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Prestige Group"
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Website</label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                type="url"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
            Contact Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className={labelClass}>Mobile Number</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Email Address</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@builder.com"
                type="email"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Track Record & Experience */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
            Track Record
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className={labelClass}>Experience (Years)</label>
              <Input
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                placeholder="e.g. 15"
                type="number"
                min="0"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Completed Projects</label>
              <Input
                value={completedProjects}
                onChange={(e) => setCompletedProjects(e.target.value)}
                placeholder="e.g. 24"
                type="number"
                min="0"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Ongoing Projects</label>
              <Input
                value={ongoingProjects}
                onChange={(e) => setOngoingProjects(e.target.value)}
                placeholder="e.g. 3"
                type="number"
                min="0"
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className={labelClass}>About Builder</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter builder background, company overview..."
              rows={4}
              className="rounded-xl bg-muted/30 resize-y"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm font-semibold">Active Status</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 px-6 rounded-xl font-medium"
            onClick={() => router.push("/builders")}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="h-12 px-8 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC] font-semibold shadow-md active:scale-[0.98] transition-all"
            disabled={isSaving || isUploadingLogo}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving
              ? "Saving..."
              : mode === "create"
              ? "Create Builder"
              : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
