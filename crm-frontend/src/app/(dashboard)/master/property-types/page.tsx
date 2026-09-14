"use client";

import { apiFetch } from "@/lib/api-fetch";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { MobileHeader } from "@/components/layout/mobile-header";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function PropertyTypesMasterPage() {
  const [types, setTypes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const [selectedType, setSelectedType] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", value: "", is_active: true });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const fetchTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`${API_URL}/master/all-property-types`);
      const data = await res.json();
      if (data.success) {
        setTypes(data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch property types");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.value.trim()) return toast.error("Name and value are required");
    
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/property-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name.trim(), value: formData.value.trim().toLowerCase(), is_active: formData.is_active })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Property type added successfully");
        setIsAddOpen(false);
        setFormData({ name: "", value: "", is_active: true });
        fetchTypes();
      } else {
        toast.error(data.message || "Failed to add property type");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !formData.name.trim() || !formData.value.trim()) return toast.error("Name and value are required");
    
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/property-types/${selectedType.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name.trim(), value: formData.value.trim().toLowerCase(), is_active: formData.is_active })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Property type updated successfully");
        setIsEditOpen(false);
        fetchTypes();
      } else {
        toast.error(data.message || "Failed to update property type");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedType) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/property-types/${selectedType.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Property type deleted successfully");
        setIsDeleteOpen(false);
        fetchTypes();
      } else {
        toast.error(data.message || "Failed to delete property type");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    let successCount = 0;
    try {
      await Promise.all(
        bulkDeleteIds.map(async (id) => {
          const res = await apiFetch(`${API_URL}/master/property-types/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) successCount++;
        })
      );
      toast.success(`Deleted ${successCount} property types successfully`);
    } catch {
      toast.error("Some property types failed to delete");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
      fetchTypes();
    }
  };

  const openEdit = (type: any) => {
    setSelectedType(type);
    setFormData({ name: type.name, value: type.value, is_active: type.is_active });
    setIsEditOpen(true);
  };

  const openDelete = (type: any) => {
    setSelectedType(type);
    setIsDeleteOpen(true);
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
      accessorKey: "name", 
      header: "Type Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Building2 size={15} className="text-muted-foreground" />
          </div>
          <span className="font-medium capitalize">{row.original.name}</span>
        </div>
      )
    },
    { 
      accessorKey: "value", 
      header: "Value (DB Key)",
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-xs">{row.original.value}</span>
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

  const filteredTypes = types.filter((s) => 
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    s.value?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col space-y-6 mb-20 md:mb-0 px-4 md:px-8 mt-2 md:mt-0">
      <MobileHeader title="Master: Property Types" showBack />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-0 md:pr-[150px] min-h-12">
        <h1 className="text-3xl font-bold tracking-tight hidden md:block">Master: Property Types</h1>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <Input
            placeholder="Search types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-xl w-full sm:w-64 bg-background"
          />
          <Button 
            className="h-11 px-5 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC] shrink-0 w-full sm:w-auto"
            onClick={() => { setFormData({ name: "", value: "", is_active: true }); setIsAddOpen(true); }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Type
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
            data={filteredTypes} 
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
            <DialogTitle>Add Property Type</DialogTitle>
            <DialogDescription>Create a new property classification.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Display Name</label>
              <Input id="name" placeholder="e.g. Independent House" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="value" className="text-sm font-medium">Internal Value (DB Key)</label>
              <Input id="value" placeholder="e.g. individual_portion" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} required />
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Active Status</label>
                <p className="text-xs text-muted-foreground">Show in property forms</p>
              </div>
              <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#0052FF] text-white hover:bg-[#0040CC]" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Add Type
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-5 md:p-6">
          <DialogHeader>
            <DialogTitle>Edit Property Type</DialogTitle>
            <DialogDescription>Update details for this property type.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="edit-name" className="text-sm font-medium">Display Name</label>
              <Input id="edit-name" placeholder="e.g. Independent House" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-value" className="text-sm font-medium">Internal Value (DB Key)</label>
              <Input id="edit-value" placeholder="e.g. individual_portion" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} required />
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Active Status</label>
                <p className="text-xs text-muted-foreground">Inactive types won't appear in the dropdowns.</p>
              </div>
              <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#0052FF] text-white hover:bg-[#0040CC]" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-5 md:p-6">
          <DialogHeader>
            <DialogTitle>Delete Property Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedType?.name}</strong>? This action cannot be undone.
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
            <DialogTitle>Delete Type{bulkDeleteIds && bulkDeleteIds.length > 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} type${bulkDeleteIds.length > 1 ? "s" : ""}` : "this type"}? This action cannot be undone.
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
