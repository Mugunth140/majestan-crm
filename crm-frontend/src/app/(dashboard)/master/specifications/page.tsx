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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { MobileHeader } from "@/components/layout/mobile-header";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function SpecificationsMasterPage() {
  const [specifications, setSpecifications] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedSpec, setSelectedSpec] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", is_active: true });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const fetchSpecs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`${API_URL}/master/all-specifications`);
      const data = await res.json();
      if (data.success) {
        setSpecifications(data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch specifications");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpecs();
  }, [fetchSpecs]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("Name is required");

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/specifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name.trim() })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Specification added successfully");
        setIsAddOpen(false);
        setFormData({ name: "", is_active: true });
        fetchSpecs();
      } else {
        toast.error(data.message || "Failed to add specification");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpec || !formData.name.trim()) return toast.error("Name is required");

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/specifications/${selectedSpec.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name.trim(), is_active: formData.is_active })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Specification updated successfully");
        setIsEditOpen(false);
        fetchSpecs();
      } else {
        toast.error(data.message || "Failed to update specification");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSpec) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/specifications/${selectedSpec.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Specification deleted successfully");
        setIsDeleteOpen(false);
        fetchSpecs();
      } else {
        toast.error(data.message || "Failed to delete specification");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (spec: any) => {
    setSelectedSpec(spec);
    setFormData({ name: spec.name, is_active: spec.is_active });
    setIsEditOpen(true);
  };

  const openDelete = (spec: any) => {
    setSelectedSpec(spec);
    setIsDeleteOpen(true);
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    let successCount = 0;
    try {
      await Promise.all(
        bulkDeleteIds.map(async (id) => {
          const res = await apiFetch(`${API_URL}/master/specifications/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) successCount++;
        })
      );
      toast.success(`Deleted ${successCount} specifications successfully`);
    } catch {
      toast.error("Some specifications failed to delete");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
      fetchSpecs();
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
      header: "Specification",
      cell: ({ row }) => (
        <span className="font-medium capitalize">{row.original.name}</span>
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

  const filteredSpecs = specifications.filter((s) => s.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <MobileHeader title="Master: Specifications" showBack />
      <div className="w-full flex flex-col space-y-6 pt-4 lg:p-0 md:h-full px-4 md:px-8">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-0 md:pr-[150px] min-h-[48px]">
          <h1 className="text-[28px] font-bold tracking-tight hidden md:block">Master: Specifications</h1>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Input
              placeholder="Search specifications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-full w-full sm:w-64 bg-background"
            />
            <Button
              className="h-11 px-5 rounded-full bg-[#0052FF] text-white hover:bg-[#0040CC] shrink-0 w-full sm:w-auto shadow-sm"
              onClick={() => { setFormData({ name: "", is_active: true }); setIsAddOpen(true); }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Specification
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
              data={filteredSpecs}
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
                <DialogTitle className="text-lg font-semibold">Add Specification</DialogTitle>
                <DialogDescription className="mt-1">Create a new specification label for projects.</DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleAdd}>
              <div className="px-5 md:px-6 py-5 space-y-2">
                <label htmlFor="name" className="text-sm font-medium">Specification</label>
                <Input id="name" placeholder="e.g. Flooring" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required autoFocus />
              </div>
              <DialogFooter className="px-5 md:px-6 py-4 border-t border-border/60 bg-muted/40 flex-row items-center gap-2">
                <div className="ml-auto flex items-center gap-2">
                  <Button type="button" variant="outline" className="h-10 px-5 rounded-xl" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" className="h-10 px-5 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC]" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Add Specification
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
                <DialogTitle className="text-lg font-semibold">Edit Specification</DialogTitle>
                <DialogDescription className="mt-1">Update details and status for this specification.</DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleEdit}>
              <div className="px-5 md:px-6 py-5 space-y-5">
                <div className="space-y-2">
                  <label htmlFor="edit-name" className="text-sm font-medium">Specification</label>
                  <Input id="edit-name" placeholder="e.g. Flooring" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Active Status</label>
                    <p className="text-xs text-muted-foreground">Inactive specifications won&apos;t appear in the dropdowns.</p>
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
              <DialogTitle>Delete Specification</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{selectedSpec?.name}</strong>? This action cannot be undone and may affect existing projects tied to this specification.
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
              <DialogTitle>Delete Specification{bulkDeleteIds && bulkDeleteIds.length > 1 ? "s" : ""}</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} specification${bulkDeleteIds.length > 1 ? "s" : ""}` : "this specification"}? This action cannot be undone.
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
