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

const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

const emptyForm = { city_name: "", state_name: "", country_name: "India", country_code: "IN", is_active: 1 };

export default function MasterCitiesPage() {
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

  const fetchCities = useCallback(async (q = search) => {
    setIsLoading(true);
    try {
      const url = new URL(`${API_URL}/master/all-cities`, window.location.origin);
      if (q) url.searchParams.set("search", q);
      const res = await apiFetch(url.toString());
      const data = await res.json();
      if (data.success) setCities(data.data ?? []);
    } catch {
      toast.error("Failed to fetch cities");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => fetchCities(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { fetchCities(""); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.city_name.trim() || !form.state_name) return toast.error("City name and state are required");
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/cities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city_name: form.city_name.trim(),
          state_name: form.state_name,
          country_name: form.country_name,
          country_code: form.country_code,
          is_active: form.is_active,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("City added successfully");
        setIsAddOpen(false);
        setForm({ ...emptyForm });
        fetchCities(search);
      } else {
        toast.error(data.message || "Failed to add city");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !form.city_name.trim()) return toast.error("City name is required");
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/cities/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city_name: form.city_name.trim(),
          state_name: form.state_name,
          country_name: form.country_name,
          country_code: form.country_code,
          is_active: form.is_active,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("City updated successfully");
        setIsEditOpen(false);
        fetchCities(search);
      } else {
        toast.error(data.message || "Failed to update city");
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
      const res = await apiFetch(`${API_URL}/master/cities/${selected.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("City deleted");
        setIsDeleteOpen(false);
        fetchCities(search);
      } else {
        toast.error(data.message || "Failed to delete city");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (city: any) => {
    setSelected(city);
    setForm({
      city_name: city.city_name ?? "",
      state_name: city.state_name ?? "",
      country_name: city.country_name ?? "India",
      country_code: city.country_code ?? "IN",
      is_active: city.is_active ?? 1,
    });
    setIsEditOpen(true);
  };

  const openDelete = (city: any) => {
    setSelected(city);
    setIsDeleteOpen(true);
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    let successCount = 0;
    try {
      await Promise.all(
        bulkDeleteIds.map(async (id) => {
          const res = await apiFetch(`${API_URL}/master/cities/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) successCount++;
        })
      );
      toast.success(`Deleted ${successCount} cities successfully`);
    } catch {
      toast.error("Some cities failed to delete");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
      fetchCities(search);
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
      accessorKey: "city_name",
      header: "City",
      cell: ({ row }) => (
        <span className="font-medium capitalize">{row.original.city_name}</span>
      ),
    },
    {
      id: "location",
      header: "State / Country",
      cell: ({ row }) => (
        <div>
          <div className="capitalize">{row.original.state_name || "—"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{row.original.country_name || "India"} ({row.original.country_code || "IN"})</div>
        </div>
      ),
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
      meta: { fixedWidth: 96 },
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
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

  return (
    <div className="flex flex-col space-y-6 mb-20 md:mb-0 px-4 md:px-8 mt-2 md:mt-0">
      <MobileHeader title="Master: Cities" showBack />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-0 md:pr-[150px] min-h-12">
        <h1 className="text-3xl font-bold tracking-tight hidden md:block">Master: Cities</h1>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <Input
            placeholder="Search cities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-xl w-full sm:w-64 bg-background"
          />
          <Button
            className="h-11 px-5 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC] shrink-0 w-full sm:w-auto"
            onClick={() => { setForm({ ...emptyForm }); setIsAddOpen(true); }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add City
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
            data={cities}
            showToolbar={true}
            showDeleteAction={true}
            onDeleteSelected={(rows) => setBulkDeleteIds(rows.map((r) => r.id))}
          />
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-0 overflow-hidden">
          <div className="px-5 md:px-6 pt-5 md:pt-6">
            <DialogHeader className="text-left">
              <DialogTitle className="text-lg font-semibold">Add City</DialogTitle>
              <DialogDescription className="mt-1">Create a new city for property listings.</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleAdd}>
            <div className="px-5 md:px-6 py-5 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">City Name *</label>
                <Input placeholder="e.g. Chennai" value={form.city_name} onChange={(e) => setForm({ ...form, city_name: e.target.value })} required className="h-10" autoFocus />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">State *</label>
                <Select required value={form.state_name} onValueChange={(val) => setForm({ ...form, state_name: val ?? "" })}>
                  <SelectTrigger className="h-10 w-full rounded-lg border border-input bg-transparent dark:bg-input/30 px-3 py-2 text-sm focus:ring-3 focus:ring-ring/50">
                    <SelectValue placeholder="Select a state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {INDIA_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Active Status</label>
                  <p className="text-xs text-muted-foreground">Show this city in property forms</p>
                </div>
                <Switch checked={form.is_active === 1} onCheckedChange={(v) => setForm({ ...form, is_active: v ? 1 : 0 })} />
              </div>
            </div>
            <DialogFooter className="px-5 md:px-6 py-4 border-t border-border/60 bg-muted/40 flex-row items-center gap-2">
              <div className="ml-auto flex items-center gap-2">
                <Button type="button" variant="outline" className="h-10 px-5 rounded-xl" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" className="h-10 px-5 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC]" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add City
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-0 overflow-hidden">
          <div className="px-5 md:px-6 pt-5 md:pt-6">
            <DialogHeader className="text-left">
              <DialogTitle className="text-lg font-semibold">Edit City</DialogTitle>
              <DialogDescription className="mt-1">Update city details.</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleEdit}>
            <div className="px-5 md:px-6 py-5 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">City Name *</label>
                <Input value={form.city_name} onChange={(e) => setForm({ ...form, city_name: e.target.value })} required className="h-10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">State *</label>
                <Select required value={form.state_name} onValueChange={(val) => setForm({ ...form, state_name: val ?? "" })}>
                  <SelectTrigger className="h-10 w-full rounded-lg border border-input bg-transparent dark:bg-input/30 px-3 py-2 text-sm focus:ring-3 focus:ring-ring/50">
                    <SelectValue placeholder="Select a state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {INDIA_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Active Status</label>
                  <p className="text-xs text-muted-foreground">Inactive cities won't appear in property forms</p>
                </div>
                <Switch checked={form.is_active === 1} onCheckedChange={(v) => setForm({ ...form, is_active: v ? 1 : 0 })} />
              </div>
            </div>
            <DialogFooter className="px-5 md:px-6 py-4 border-t border-border/60 bg-muted/40 flex-row items-center gap-2">
              <div className="ml-auto flex items-center gap-2">
                <Button type="button" variant="outline" className="h-10 px-5 rounded-xl" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button type="submit" className="h-10 px-5 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC]" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-5 md:p-6">
          <DialogHeader>
            <DialogTitle>Delete City</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selected?.city_name}</strong>? This will also affect any sublocations linked to it.
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
            <DialogTitle>Delete Cit{bulkDeleteIds && bulkDeleteIds.length > 1 ? "ies" : "y"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} cit${bulkDeleteIds.length > 1 ? "ies" : "y"}` : "this city"}? This action cannot be undone.
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
