"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api-fetch";
import { Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export interface BuilderRecord {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  website?: string;
  experienceYears?: number;
  completedProjects?: number;
  ongoingProjects?: number;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface BuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  builder?: BuilderRecord | null;
  onSuccess: () => void;
}

export function BuilderDialog({ open, onOpenChange, builder, onSuccess }: BuilderDialogProps) {
  const isEdit = Boolean(builder?.id);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    logoUrl: "",
    phone: "",
    email: "",
    website: "",
    experienceYears: "",
    completedProjects: "",
    ongoingProjects: "",
    description: "",
    isActive: true,
  });

  useEffect(() => {
    if (builder) {
      setFormData({
        name: builder.name || "",
        logoUrl: builder.logoUrl || "",
        phone: builder.phone || "",
        email: builder.email || "",
        website: builder.website || "",
        experienceYears: builder.experienceYears != null ? String(builder.experienceYears) : "",
        completedProjects: builder.completedProjects != null ? String(builder.completedProjects) : "",
        ongoingProjects: builder.ongoingProjects != null ? String(builder.ongoingProjects) : "",
        description: builder.description || "",
        isActive: builder.isActive !== false,
      });
    } else {
      setFormData({
        name: "",
        logoUrl: "",
        phone: "",
        email: "",
        website: "",
        experienceYears: "",
        completedProjects: "",
        ongoingProjects: "",
        description: "",
        isActive: true,
      });
    }
  }, [builder, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Builder name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        name: formData.name.trim(),
        logoUrl: formData.logoUrl.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        website: formData.website.trim() || undefined,
        experienceYears: formData.experienceYears !== "" && !isNaN(Number(formData.experienceYears))
          ? Number(formData.experienceYears)
          : undefined,
        completedProjects: formData.completedProjects !== "" && !isNaN(Number(formData.completedProjects))
          ? Number(formData.completedProjects)
          : undefined,
        ongoingProjects: formData.ongoingProjects !== "" && !isNaN(Number(formData.ongoingProjects))
          ? Number(formData.ongoingProjects)
          : undefined,
        description: formData.description.trim() || undefined,
        isActive: formData.isActive,
      };

      const url = isEdit ? `${API_URL}/builders/${builder!.id}` : `${API_URL}/builders`;
      const method = isEdit ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || `Failed to ${isEdit ? "update" : "create"} builder`);
      }

      toast.success(isEdit ? "Builder updated successfully" : "Builder created successfully");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "An error occurred while saving builder");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        <div className="px-6 pt-6 pb-2 border-b bg-muted/10">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-bold">
              {isEdit ? "Edit Builder" : "Add New Builder"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {isEdit ? "Update details and status for this builder profile." : "Fill in the builder company information and profile details."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Builder Name <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Prestige Group, Godrej Properties"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Logo URL
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Phone
                </label>
                <Input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="contact@builder.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Website
                </label>
                <Input
                  type="url"
                  placeholder="https://builder.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Experience (Years)
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 15"
                  value={formData.experienceYears}
                  onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Completed Projects
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 42"
                  value={formData.completedProjects}
                  onChange={(e) => setFormData({ ...formData, completedProjects: e.target.value })}
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ongoing Projects
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 8"
                  value={formData.ongoingProjects}
                  onChange={(e) => setFormData({ ...formData, ongoingProjects: e.target.value })}
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 md:col-span-1">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Active Status</label>
                  <p className="text-xs text-muted-foreground">Show in project dropdowns</p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </label>
                <Textarea
                  placeholder="Overview of the builder, history, philosophy..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="min-h-[100px] rounded-xl bg-muted/30 resize-y"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/40 flex-row items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 px-5 rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 px-5 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC]"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEdit ? "Save Changes" : "Create Builder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
