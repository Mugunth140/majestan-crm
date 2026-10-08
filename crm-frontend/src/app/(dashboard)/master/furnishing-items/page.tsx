"use client";

import { apiFetch } from "@/lib/api-fetch";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FurnishingIcon, FurnishingIconPicker } from "@/components/shared/furnishing-icons";

import { MobileHeader } from "@/components/layout/mobile-header";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function FurnishingItemsMasterPage() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", icon: "", is_active: true });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`${API_URL}/master/all-furnishing-items`);
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch furnishing items");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("Name is required");

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/furnishing-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name.trim(), icon: formData.icon || undefined })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Furnishing item added successfully");
        setIsAddOpen(false);
        setFormData({ name: "", icon: "", is_active: true });
        fetchItems();
      } else {
        toast.error(data.message || "Failed to add furnishing item");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !formData.name.trim()) return toast.error("Name is required");

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/furnishing-items/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name.trim(), icon: formData.icon || undefined, is_active: formData.is_active })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Furnishing item updated successfully");
        setIsEditOpen(false);
        fetchItems();
      } else {
        toast.error(data.message || "Failed to update furnishing item");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/furnishing-items/${selectedItem.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Furnishing item deleted successfully");
        setIsDeleteOpen(false);
        fetchItems();
      } else {
        toast.error(data.message || "Failed to delete furnishing item");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (item: any) => {
    setSelectedItem(item);
    setFormData({ name: item.name, icon: item.icon ?? "", is_active: item.is_active });
    setIsEditOpen(true);
  };

  const openDelete = (item: any) => {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    let successCount = 0;
    try {
      await Promise.all(
        bulkDeleteIds.map(async (id) => {
          const res = await apiFetch(`${API_URL}/master/furnishing-items/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) successCount++;
        })
      );
      toast.success(`Deleted ${successCount} furnishing items successfully`);
    } catch {
      toast.error("Some furnishing items failed to delete");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
      fetchItems();
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
    {
      accessorKey: "name",
      header: "Item",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <FurnishingIcon name={row.original.icon} className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="font-medium capitalize">{row.original.name}</span>
        </div>
      )
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

  const filteredItems = items.filter((s) => s.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <MobileHeader title="Master: Furnishing Items" showBack />
      <div className="w-full flex flex-col space-y-6 pt-4 lg:p-0 md:h-full px-4 md:px-8">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-0 md:pr-[150px] min-h-[48px]">
          <h1 className="text-[28px] font-bold tracking-tight hidden md:block">Master: Furnishing Items</h1>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Input
              placeholder="Search furnishing items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-full w-full sm:w-64 bg-background"
            />
            <Button
              className="h-11 px-5 rounded-full bg-[#0052FF] text-white hover:bg-[#0040CC] shrink-0 w-full sm:w-auto shadow-sm"
              onClick={() => { setFormData({ name: "", icon: "", is_active: true }); setIsAddOpen(true); }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Item
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden w-full h-full flex flex-col bg-card border rounded-2xl shadow-sm p-4 md:p-6 mb-20 md:mb-0">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredItems}
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
                <DialogTitle className="text-lg font-semibold">Add Furnishing Item</DialogTitle>
                <DialogDescription className="mt-1">Create a new furnishing item with an icon for property listings.</DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleAdd}>
              <div className="px-5 md:px-6 py-5 space-y-5">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">Item Name</label>
                  <Input id="name" placeholder="e.g. Sofa" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required autoFocus />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Icon</span>
                  <FurnishingIconPicker value={formData.icon} onChange={(icon) => setFormData({ ...formData, icon })} />
                </div>
              </div>
              <DialogFooter className="px-5 md:px-6 py-4 border-t border-border/60 bg-muted/40 flex-row items-center gap-2">
                <div className="ml-auto flex items-center gap-2">
                  <Button type="button" variant="outline" className="h-10 px-5 rounded-xl" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" className="h-10 px-5 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC]" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Add Item
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
                <DialogTitle className="text-lg font-semibold">Edit Furnishing Item</DialogTitle>
                <DialogDescription className="mt-1">Update details and status for this furnishing item.</DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleEdit}>
              <div className="px-5 md:px-6 py-5 space-y-5">
                <div className="space-y-2">
                  <label htmlFor="edit-name" className="text-sm font-medium">Item Name</label>
                  <Input id="edit-name" placeholder="e.g. Sofa" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Icon</span>
                  <FurnishingIconPicker value={formData.icon} onChange={(icon) => setFormData({ ...formData, icon })} />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Active Status</label>
                    <p className="text-xs text-muted-foreground">Inactive items won't appear in property forms.</p>
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
              <DialogTitle>Delete Furnishing Item</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{selectedItem?.name}</strong>? This action cannot be undone and may affect existing properties tied to this item.
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
              <DialogTitle>Delete Furnishing Item{bulkDeleteIds && bulkDeleteIds.length > 1 ? "s" : ""}</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} furnishing item${bulkDeleteIds.length > 1 ? "s" : ""}` : "this furnishing item"}? This action cannot be undone.
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
