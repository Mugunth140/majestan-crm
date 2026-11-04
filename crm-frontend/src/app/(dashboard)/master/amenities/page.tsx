"use client";

import { isAdmin } from "@/lib/permissions";
import { AMENITY_CATEGORIES } from "@/lib/master-kinds";
import { apiFetch } from "@/lib/api-fetch";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ActiveCell, IdCell, statusDot } from "@/components/tables/cells";
import { ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { activeValue, moveRow } from "@/lib/move-row";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconPicker, resolveIcon } from "@/components/shared/icon-picker";

import { MobileHeader } from "@/components/layout/mobile-header";
import { PageActions } from "@/components/layout/page-actions";
import { ListBody, ListFrame, ListToolbar, ToolbarSearch, headerPrimaryClass } from "@/components/layout/list-page";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { cn } from "@/lib/utils";


const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";


const categoryLabel = (value: string | null | undefined) =>
  AMENITY_CATEGORIES.find((c) => c.value === value)?.label ?? value ?? "—";

const emptyForm = { name: "", category: "other", icon_key: "", is_active: true };

const FIELDS: ViewField[] = [
  { id: "status", label: "Status", get: (r) => (r.is_active ? "Active" : "Inactive"), order: ["Active", "Inactive"], dot: (v) => statusDot(v) },
  { id: "category", label: "Category", get: (r) => categoryLabel(r.category), capitalize: true },
];

export default function AmenitiesMasterPage() {
  const views = useModuleView("master-amenities", FIELDS);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [search, setSearch] = usePersistedState("master-amenities:search", "");
  const [isLoading, setIsLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedAmenity, setSelectedAmenity] = useState<any>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const fetchAmenities = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`${API_URL}/master/all-amenities`);
      const data = await res.json();
      if (data.success) {
        setAmenities(data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch amenities");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAmenities();
  }, [fetchAmenities]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("Name is required");

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/amenities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          category: formData.category,
          icon_key: formData.icon_key || undefined,
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Amenity added successfully");
        setIsAddOpen(false);
        setFormData(emptyForm);
        fetchAmenities();
      } else {
        toast.error(data.message || "Failed to add amenity");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmenity || !formData.name.trim()) return toast.error("Name is required");

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/amenities/${selectedAmenity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          category: formData.category,
          icon_key: formData.icon_key || null,
          is_active: formData.is_active,
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Amenity updated successfully");
        setIsEditOpen(false);
        fetchAmenities();
      } else {
        toast.error(data.message || "Failed to update amenity");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAmenity) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/amenities/${selectedAmenity.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Amenity deleted successfully");
        setIsDeleteOpen(false);
        fetchAmenities();
      } else {
        toast.error(data.message || "Failed to delete amenity");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (amenity: any) => {
    setSelectedAmenity(amenity);
    setFormData({
      name: amenity.name,
      category: amenity.category ?? "other",
      icon_key: amenity.icon_key ?? "",
      is_active: amenity.is_active,
    });
    setIsEditOpen(true);
  };

  const openDelete = (amenity: any) => {
    setSelectedAmenity(amenity);
    setIsDeleteOpen(true);
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    let successCount = 0;
    try {
      await Promise.all(
        bulkDeleteIds.map(async (id) => {
          const res = await apiFetch(`${API_URL}/master/amenities/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) successCount++;
        })
      );
      toast.success(`Deleted ${successCount} amenities successfully`);
    } catch {
      toast.error("Some amenities failed to delete");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
      fetchAmenities();
    }
  };

  // Note for future developer:
  // Role permissions can be applied here by checking user's roles context before rendering Edit/Delete actions.
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
    { accessorKey: "id", header: "ID", cell: ({ row }) => <IdCell>{row.original.id}</IdCell> },
    {
      accessorKey: "name",
      header: "Amenity",
      cell: ({ row }) => {
        const Icon = resolveIcon(row.original.icon_key);
        return (
          <div className="flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
              {Icon ? (
                <Icon className="size-3.5 text-muted-foreground" />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
            <span className="font-medium capitalize">{row.original.name}</span>
          </div>
        );
      }
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <span className="capitalize">{categoryLabel(row.original.category)}</span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => <ActiveCell active={row.original.is_active} />,
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

  const filteredAmenities = amenities.filter((a) =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    categoryLabel(a.category).toLowerCase().includes(search.toLowerCase())
  );

  const amenityFormFields = (
    <>
      <div className="space-y-2">
        <label htmlFor="amenity-name" className="text-sm font-medium">Amenity</label>
        <Input id="amenity-name" placeholder="e.g. Swimming Pool" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required autoFocus />
      </div>
      <div className="space-y-2">
        <label htmlFor="amenity-category" className="text-sm font-medium">Category</label>
        <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val ?? "other" })}>
          <SelectTrigger id="amenity-category" className="h-10 w-full rounded-lg">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {AMENITY_CATEGORIES.map((c) => (
              <SelectItem key={c.value || "none"} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Icon</label>
        <IconPicker value={formData.icon_key || null} onChange={(v) => setFormData({ ...formData, icon_key: v })} />
      </div>
    </>
  );

  return (
    <>
      <MobileHeader title="Master: Amenities" showBack />
      {views.switcher}
      <div className="w-full flex flex-col md:h-full">

        <PageActions>
          <button type="button" className={headerPrimaryClass} onClick={() => { setFormData(emptyForm); setIsAddOpen(true); }}>
            <Plus className="size-4" /> Add Amenity
          </button>
        </PageActions>

        <ListFrame>
          <ListToolbar>
            <ToolbarSearch value={search} onChange={setSearch} placeholder="Search amenities" className="flex-1 md:flex-none" />
            <button type="button" className={cn(headerPrimaryClass, "md:hidden")} onClick={() => { setFormData(emptyForm); setIsAddOpen(true); }}>
              <Plus className="size-4" /> Add Amenity
            </button>
            {views.picker && <div className="ml-auto">{views.picker}</div>}
          </ListToolbar>
          <ListBody>
            {isLoading ? (
              <TableSkeleton columns={5} rows={8} flush />
            ) : (
              <ModuleViews
                state={views}
                data={filteredAmenities}
                columns={columns}
                list={
                  <DataTable
                variant="list"
                columns={columns}
                data={filteredAmenities}
                showToolbar={true}
                showDeleteAction={isAdmin()}
                onDeleteSelected={(rows) => setBulkDeleteIds(rows.map((r) => r.id))}
              />
                }
                getKey={(r) => r.id}
                onOpen={openEdit}
                onMove={(r, column) => {
                  const is_active = activeValue(r.is_active, column === "Active");
                  moveRow({
                    setRows: setAmenities,
                    row: r,
                    same: (a, b) => a.id === b.id,
                    patch: { is_active },
                    request: { path: `/master/amenities/${r.id}`, method: "PATCH", body: { name: r.name, category: r.category ?? "other", icon_key: r.icon_key || null, is_active } },
                    success: `Marked ${column.toLowerCase()}`,
                  });
                }}
                card={(r) => ({ title: r.name, avatar: false, id: r.id, subtitle: categoryLabel(r.category) })}
              />
            )}
          </ListBody>
        </ListFrame>

        {/* Add Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-0 overflow-hidden">
            <div className="px-5 md:px-6 pt-5 md:pt-6">
              <DialogHeader className="text-left">
                <DialogTitle className="text-lg font-semibold">Add Amenity</DialogTitle>
                <DialogDescription className="mt-1">Create a new amenity for property and project listings.</DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleAdd}>
              <div className="px-5 md:px-6 py-5 space-y-5">
                {amenityFormFields}
              </div>
              <DialogFooter className="px-5 md:px-6 py-4 border-t border-border/60 bg-muted/40 flex-row items-center gap-2">
                <div className="ml-auto flex items-center gap-2">
                  <Button type="button" variant="outline" className="h-10 px-5 rounded-xl" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" className="h-10 px-5 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC]" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Add Amenity
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
                <DialogTitle className="text-lg font-semibold">Edit Amenity</DialogTitle>
                <DialogDescription className="mt-1">Update details and status for this amenity.</DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleEdit}>
              <div className="px-5 md:px-6 py-5 space-y-5">
                {amenityFormFields}
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Active Status</label>
                    <p className="text-xs text-muted-foreground">Inactive amenities won&apos;t appear in the dropdowns.</p>
                  </div>
                  <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                </div>
              </div>
              <DialogFooter className="px-5 md:px-6 py-4 border-t border-border/60 bg-muted/40 flex-row items-center gap-2">
                <div className="ml-auto flex items-center gap-2">
                  <Button type="button" variant="outline" className="h-10 px-5 rounded-xl" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                  <Button type="submit" className="h-10 px-5 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC]" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Changes
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
              <DialogTitle>Delete Amenity</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{selectedAmenity?.name}</strong>? This action cannot be undone — listings linked to this amenity will lose it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Dialog */}
        <Dialog open={bulkDeleteIds !== null} onOpenChange={(open) => { if (!open) setBulkDeleteIds(null); }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Delete Amenit{bulkDeleteIds && bulkDeleteIds.length > 1 ? "ies" : "y"}</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} amenit${bulkDeleteIds.length > 1 ? "ies" : "y"}` : "this amenity"}? This action cannot be undone — linked listings will lose {bulkDeleteIds && bulkDeleteIds.length > 1 ? "these amenities" : "this amenity"}.
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
    </>
  );
}
