"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useState, useEffect, useCallback } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MobileHeader } from "@/components/layout/mobile-header";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const emptyForm = { city_id: "", locality_name: "", postal_code: "", description: "", is_active: 1 };

export default function MasterSublocationsPage() {
  const [sublocations, setSublocations] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const fetchSublocations = useCallback(async (q = search) => {
    setIsLoading(true);
    try {
      const url = new URL(`${API_URL}/master/all-sublocations`, window.location.origin);
      if (q) url.searchParams.set("search", q);
      const res = await apiFetch(url.toString());
      // 304 = data unchanged (backend ETags); keep current rows, no error.
      if (res.status === 304) return;
      const data = await res.json();
      if (data.success) setSublocations(data.data ?? []);
    } catch {
      toast.error("Failed to fetch sublocations");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  const fetchCities = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_URL}/master/all-cities`);
      if (res.status === 304) return;
      const data = await res.json();
      if (data.success) setCities(data.data ?? []);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => { fetchCities(); }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchSublocations(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { fetchSublocations(""); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.city_id || !form.locality_name.trim()) return toast.error("City and locality name are required");
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/sublocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city_id: Number(form.city_id),
          locality_name: form.locality_name.trim(),
          postal_code: form.postal_code.trim() || undefined,
          description: form.description.trim() || undefined,
          is_active: form.is_active,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Sublocation added successfully");
        setIsAddOpen(false);
        setForm({ ...emptyForm });
        fetchSublocations(search);
      } else {
        toast.error(data.message || "Failed to add sublocation");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !form.locality_name.trim()) return toast.error("Locality name is required");
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/sublocations/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city_id: Number(form.city_id),
          locality_name: form.locality_name.trim(),
          postal_code: form.postal_code.trim() || undefined,
          description: form.description.trim() || undefined,
          is_active: form.is_active,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Sublocation updated successfully");
        setIsEditOpen(false);
        fetchSublocations(search);
      } else {
        toast.error(data.message || "Failed to update sublocation");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/sublocations/${selected.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Sublocation deleted");
        setIsDeleteOpen(false);
        fetchSublocations(search);
      } else {
        toast.error(data.message || "Failed to delete sublocation");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (sub: any) => {
    setSelected(sub);
    setForm({
      city_id: String(sub.city_id ?? ""),
      locality_name: sub.locality_name ?? "",
      postal_code: sub.postal_code ?? "",
      description: sub.description ?? "",
      is_active: sub.is_active ?? 1,
    });
    setIsEditOpen(true);
  };

  const openDelete = (sub: any) => {
    setSelected(sub);
    setIsDeleteOpen(true);
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    let successCount = 0;
    try {
      await Promise.all(
        bulkDeleteIds.map(async (id) => {
          const res = await apiFetch(`${API_URL}/master/sublocations/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) successCount++;
        })
      );
      toast.success(`Deleted ${successCount} sublocations successfully`);
    } catch {
      toast.error("Some sublocations failed to delete");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
      fetchSublocations(search);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
    },
    {
      accessorKey: "locality_name",
      header: "Sublocation",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <MapPin size={15} className="text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="font-medium capitalize">{row.original.locality_name}</div>
            {row.original.description ? (
              <div className="text-xs text-muted-foreground truncate max-w-64">{row.original.description}</div>
            ) : (
              <div className="text-xs text-muted-foreground/60 italic">No overview yet</div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "city",
      header: "City",
      cell: ({ row }) => (
        <div>
          <div className="capitalize">{row.original.city_name || "—"}</div>
          <div className="text-xs text-muted-foreground mt-0.5 capitalize">{row.original.state_name || ""}</div>
        </div>
      ),
    },
    {
      accessorKey: "postal_code",
      header: "PIN Code",
      cell: ({ row }) => <span className="text-sm">{row.original.postal_code || "—"}</span>,
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.is_active ? "default" : "secondary"}
          className={row.original.is_active
            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 border-none shadow-none"}
        >
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-[#0052FF] hover:bg-blue-50" onClick={() => openEdit(row.original)}>
            <Edit size={15} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50" onClick={() => openDelete(row.original)}>
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    },
  ];

  const CitySelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select required value={value} onValueChange={(val) => onChange(val ?? "")}>
      <SelectTrigger className="h-10 w-full rounded-lg border border-input bg-transparent dark:bg-input/30 px-3 py-2 text-sm focus:ring-3 focus:ring-ring/50">
        <SelectValue placeholder="— Select a city —">
          {(val: string | null) => {
            if (!val) return "— Select a city —";
            const c = cities.find(city => String(city.id) === val);
            return c ? `${c.city_name}${c.state_name ? ` (${c.state_name})` : ""}` : "— Select a city —";
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {cities.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            {c.city_name}{c.state_name ? ` (${c.state_name})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-col space-y-6 mb-20 md:mb-0 px-4 md:px-8 mt-2 md:mt-0">
      <MobileHeader title="Master: Sublocations" showBack />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-0 md:pr-[150px] min-h-12">
        <h1 className="text-3xl font-bold tracking-tight hidden md:block">Master: Sublocations</h1>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <Input
            placeholder="Search sublocations or cities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-xl w-full sm:w-72 bg-background"
          />
          <Button
            className="h-11 px-5 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC] shrink-0 w-full sm:w-auto"
            onClick={() => { setForm({ ...emptyForm }); setIsAddOpen(true); }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Sublocation
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden shadow-sm p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={sublocations} 
            showToolbar={true}
            showDeleteAction={true}
            onDeleteSelected={(rows) => setBulkDeleteIds(rows.map((r) => r.id))}
          />
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-5 md:p-6">
          <DialogHeader>
            <DialogTitle>Add Sublocation</DialogTitle>
            <DialogDescription>Create a new locality and map it to a city.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">City *</label>
              <CitySelect value={form.city_id} onChange={(v) => setForm({ ...form, city_id: v })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Locality / Sublocation Name *</label>
              <Input placeholder="e.g. Velachery" value={form.locality_name} onChange={(e) => setForm({ ...form, locality_name: e.target.value })} required className="h-10" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">PIN Code</label>
              <Input placeholder="e.g. 600042" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className="h-10" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Overview Description</label>
              <Textarea
                placeholder="Shown on the site as 'Overview of {locality}' — e.g. schools, connectivity, lifestyle..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <label className="text-sm font-medium">Active</label>
                <p className="text-xs text-muted-foreground">Show in property forms</p>
              </div>
              <Switch checked={form.is_active === 1} onCheckedChange={(v) => setForm({ ...form, is_active: v ? 1 : 0 })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#0052FF] text-white hover:bg-[#0040CC]" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add Sublocation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-5 md:p-6">
          <DialogHeader>
            <DialogTitle>Edit Sublocation</DialogTitle>
            <DialogDescription>Update locality details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">City *</label>
              <CitySelect value={form.city_id} onChange={(v) => setForm({ ...form, city_id: v })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Locality / Sublocation Name *</label>
              <Input placeholder="e.g. Velachery" value={form.locality_name} onChange={(e) => setForm({ ...form, locality_name: e.target.value })} required className="h-10" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">PIN Code</label>
              <Input placeholder="e.g. 600042" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className="h-10" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Overview Description</label>
              <Textarea
                placeholder="Shown on the site as 'Overview of {locality}' — e.g. schools, connectivity, lifestyle..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <label className="text-sm font-medium">Active</label>
                <p className="text-xs text-muted-foreground">Inactive localities won't appear in property forms</p>
              </div>
              <Switch checked={form.is_active === 1} onCheckedChange={(v) => setForm({ ...form, is_active: v ? 1 : 0 })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#0052FF] text-white hover:bg-[#0040CC]" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-5 md:p-6">
          <DialogHeader>
            <DialogTitle>Delete Sublocation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selected?.locality_name}</strong>? Properties linked to this locality may be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteIds !== null} onOpenChange={(open) => { if (!open) setBulkDeleteIds(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Sublocation{bulkDeleteIds && bulkDeleteIds.length > 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} sublocation${bulkDeleteIds.length > 1 ? "s" : ""}` : "this sublocation"}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBulkDeleteIds(null)} disabled={isDeletingBulk}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeletingBulk}>
              {isDeletingBulk ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
