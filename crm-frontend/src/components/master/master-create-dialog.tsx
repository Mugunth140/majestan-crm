"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconPicker } from "@/components/shared/icon-picker";
import { FurnishingIconPicker } from "@/components/shared/furnishing-icons";
import { FOCUS_BUTTON } from "@/components/shared/focus-modal";
import { apiFetch } from "@/lib/api-fetch";
import { AMENITY_CATEGORIES, INDIA_STATES, MASTER_KINDS, roomDimensionName, type MasterKind } from "@/lib/master-kinds";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type Form = {
  name: string; category: string; icon: string; lengthFt: string; widthFt: string;
  state: string; cityId: string; postalCode: string; description: string;
};

/** What's created and the payload the master page sends for it. */
function request(kind: MasterKind, f: Form): { body: Record<string, unknown>; name: string } | string {
  const name = f.name.trim();
  switch (kind) {
    case "amenities":
      return name ? { name, body: { name, category: f.category, icon_key: f.icon || undefined } } : "Name is required";
    case "furnishing-items":
    case "utilities":
      return name ? { name, body: { name, icon: f.icon || undefined } } : "Name is required";
    case "room-dimensions": {
      const dims = roomDimensionName(f.lengthFt, f.widthFt);
      if (!dims) return "Enter length and width in feet.";
      return { name: dims, body: { name: dims, lengthFt: Number(f.lengthFt), widthFt: Number(f.widthFt) } };
    }
    case "cities":
      return name && f.state
        ? { name, body: { city_name: name, state_name: f.state, country_name: "India", country_code: "IN", is_active: 1 } }
        : "City name and state are required";
    case "sublocations":
      return f.cityId && name
        ? { name, body: { city_id: Number(f.cityId), locality_name: name, postal_code: f.postalCode.trim() || undefined, description: f.description.trim() || undefined, is_active: 1 } }
        : "City and locality name are required";
    default:
      return name ? { name, body: { name } } : "Name is required";
  }
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export interface MasterCreateDialogProps {
  kind: MasterKind | null;
  /** What the person typed in the search box; starts the name field. */
  initialName?: string;
  /** For a new locality: the cities to map it to, and the one picked in the form. */
  cities?: { id: number | string; name: string }[];
  cityId?: string;
  onClose: () => void;
  /** Called with the created item's name once the master table has it. */
  onCreated: (name: string) => void | Promise<void>;
}

/**
 * The master registry's "Add …" dialog, opened from a form so staff can add a
 * missing amenity, room name, locality and so on without leaving it. Same
 * fields, rules and endpoint as the master page.
 */
export function MasterCreateDialog({ kind, initialName = "", cities = [], cityId = "", onClose, onCreated }: MasterCreateDialogProps) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form>(() => {
    // "12x10" typed into a dimensions search starts both boxes.
    const dims = kind === "room-dimensions" ? initialName.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i) : null;
    return {
      name: initialName, category: "other", icon: "", lengthFt: dims?.[1] ?? "", widthFt: dims?.[2] ?? "", state: "", cityId, postalCode: "", description: "",
    };
  });
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  if (!kind) return null;
  const meta = MASTER_KINDS[kind];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const req = request(kind, form);
    if (typeof req === "string") return void toast.error(req);
    setBusy(true);
    try {
      const res = await apiFetch(`${API_URL}/master/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        toast.error(data?.message || `Failed to add ${meta.noun}`);
        return;
      }
      toast.success(`${meta.title} added`);
      await onCreated(req.name);
      onClose();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const nameField = (label: string, placeholder: string) => (
    <Field label={label} htmlFor="master-create-name">
      <Input id="master-create-name" placeholder={placeholder} value={form.name} onChange={(e) => set({ name: e.target.value })} required autoFocus className="h-10" />
    </Field>
  );

  let fields: ReactNode;
  switch (kind) {
    case "amenities":
      fields = (
        <>
          {nameField("Amenity", "e.g. Swimming Pool")}
          <Field label="Category">
            <Select value={form.category} onValueChange={(v) => set({ category: v ?? "other" })}>
              <SelectTrigger className="h-10 w-full rounded-lg"><SelectValue placeholder="Select a category">{(v: string) => AMENITY_CATEGORIES.find((c) => c.value === v)?.label ?? v}</SelectValue></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {AMENITY_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Icon"><IconPicker value={form.icon || null} onChange={(v) => set({ icon: v })} /></Field>
        </>
      );
      break;
    case "furnishing-items":
    case "utilities":
      fields = (
        <>
          {nameField("Item Name", kind === "utilities" ? "e.g. Water Purifier" : "e.g. Sofa")}
          <Field label="Icon"><FurnishingIconPicker value={form.icon} onChange={(icon) => set({ icon })} /></Field>
        </>
      );
      break;
    case "room-dimensions":
      fields = (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Length (ft)" htmlFor="master-create-length">
            <Input id="master-create-length" type="number" min={0} step="0.5" placeholder="e.g. 12" value={form.lengthFt} onChange={(e) => set({ lengthFt: e.target.value })} autoFocus className="h-10" />
          </Field>
          <Field label="Width (ft)" htmlFor="master-create-width">
            <Input id="master-create-width" type="number" min={0} step="0.5" placeholder="e.g. 10" value={form.widthFt} onChange={(e) => set({ widthFt: e.target.value })} className="h-10" />
          </Field>
        </div>
      );
      break;
    case "cities":
      fields = (
        <>
          {nameField("City Name *", "e.g. Chennai")}
          <Field label="State *">
            <Select required value={form.state} onValueChange={(v) => set({ state: v ?? "" })}>
              <SelectTrigger className="h-10 w-full rounded-lg"><SelectValue placeholder="Select a state" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {INDIA_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </>
      );
      break;
    case "sublocations":
      fields = (
        <>
          <Field label="City *">
            <Select required value={form.cityId} onValueChange={(v) => set({ cityId: v ?? "" })}>
              <SelectTrigger className="h-10 w-full rounded-lg"><SelectValue placeholder="Select a city">{(v: string) => cities.find((c) => String(c.id) === v)?.name ?? "Select a city"}</SelectValue></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {cities.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {nameField("Locality / Sublocation Name *", "e.g. Velachery")}
          <Field label="PIN Code" htmlFor="master-create-pin">
            <Input id="master-create-pin" placeholder="e.g. 600042" value={form.postalCode} onChange={(e) => set({ postalCode: e.target.value })} className="h-10" />
          </Field>
          <Field label="Overview Description" htmlFor="master-create-description">
            <Textarea id="master-create-description" rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })}
              placeholder="Shown on the site as 'Overview of {locality}' — e.g. schools, connectivity, lifestyle..." />
          </Field>
        </>
      );
      break;
    default:
      fields = nameField(meta.fieldLabel, meta.placeholder);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-lg overflow-hidden rounded-2xl p-0">
        <div className="px-5 pt-5 md:px-6 md:pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg font-semibold">Add {meta.title}</DialogTitle>
            <DialogDescription className="mt-1">{meta.description} It&apos;s added to the master list for everyone.</DialogDescription>
          </DialogHeader>
        </div>
        {/* Keys and submits stay here: this dialog sits inside the form that opened it. */}
        <form onSubmit={submit} onKeyDown={(e) => e.stopPropagation()}>
          <div className="space-y-5 px-5 py-5 md:px-6">{fields}</div>
          <DialogFooter className="flex-row items-center gap-2 border-t border-border/60 bg-muted/40 px-5 py-4 md:px-6">
            <div className="ml-auto flex items-center gap-2">
              <button type="button" className={FOCUS_BUTTON.secondary} onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className={FOCUS_BUTTON.primary} disabled={busy}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add {meta.title}
              </button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
