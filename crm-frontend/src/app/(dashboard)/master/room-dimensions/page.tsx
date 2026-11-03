"use client";

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

import { MobileHeader } from "@/components/layout/mobile-header";
import { PageActions } from "@/components/layout/page-actions";
import { ListBody, ListFrame, ListToolbar, ToolbarSearch, headerPrimaryClass } from "@/components/layout/list-page";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { cn } from "@/lib/utils";


const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const FIELDS: ViewField[] = [
  { id: "status", label: "Status", get: (r) => (r.is_active ? "Active" : "Inactive"), order: ["Active", "Inactive"], dot: (v) => statusDot(v) },
];

export default function RoomDimensionsMasterPage() {
  const views = useModuleView("master-room-dimensions", FIELDS);
  const [dims, setDims] = useState<any[]>([]);
  const [search, setSearch] = usePersistedState("master-room-dimensions:search", "");
  const [isLoading, setIsLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedDim, setSelectedDim] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", lengthFt: "", widthFt: "", is_active: true });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const fetchDims = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`${API_URL}/master/all-room-dimensions`);
      const data = await res.json();
      if (data.success) {
        setDims(data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch room dimensions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDims();
  }, [fetchDims]);

  const dimensionName = (): string | null => {
    const toNum = (v: string) => {
      const n = Number(v);
      return v.trim() !== "" && Number.isFinite(n) && n > 0 ? String(parseFloat(n.toFixed(2))) : null;
    };
    const len = toNum(formData.lengthFt);
    const wid = toNum(formData.widthFt);
    if (len == null || wid == null) return null;
    return `${len} × ${wid} ft`;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = dimensionName();
    if (!name) return toast.error("Enter length and width in feet.");

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/room-dimensions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          lengthFt: formData.lengthFt.trim() === "" ? null : Number(formData.lengthFt),
          widthFt: formData.widthFt.trim() === "" ? null : Number(formData.widthFt),
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Room dimension added successfully");
        setIsAddOpen(false);
        setFormData({ name: "", lengthFt: "", widthFt: "", is_active: true });
        fetchDims();
      } else {
        toast.error(data.message || "Failed to add room dimension");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = dimensionName();
    if (!selectedDim || !name) return toast.error("Enter length and width in feet.");

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/room-dimensions/${selectedDim.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          lengthFt: formData.lengthFt.trim() === "" ? null : Number(formData.lengthFt),
          widthFt: formData.widthFt.trim() === "" ? null : Number(formData.widthFt),
          is_active: formData.is_active,
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Room dimension updated successfully");
        setIsEditOpen(false);
        fetchDims();
      } else {
        toast.error(data.message || "Failed to update room dimension");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDim) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/master/room-dimensions/${selectedDim.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Room dimension deleted successfully");
        setIsDeleteOpen(false);
        fetchDims();
      } else {
        toast.error(data.message || "Failed to delete room dimension");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (dim: any) => {
    setSelectedDim(dim);
    setFormData({
      name: "",
      lengthFt: dim.lengthFt != null ? String(dim.lengthFt) : "",
      widthFt: dim.widthFt != null ? String(dim.widthFt) : "",
      is_active: dim.is_active,
    });
    setIsEditOpen(true);
  };

  const openDelete = (dim: any) => {
    setSelectedDim(dim);
    setIsDeleteOpen(true);
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    let successCount = 0;
    try {
      await Promise.all(
        bulkDeleteIds.map(async (id) => {
          const res = await apiFetch(`${API_URL}/master/room-dimensions/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) successCount++;
        })
      );
      toast.success(`Deleted ${successCount} room dimensions successfully`);
    } catch {
      toast.error("Some room dimensions failed to delete");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
      fetchDims();
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
      header: "Dimensions",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{row.original.name}</span>
      )
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

  const filteredDims = dims.filter((r) => r.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <MobileHeader title="Master: Room Dimensions" showBack />
      {views.switcher}
      <div className="w-full flex flex-col md:h-full">

        <PageActions>
          <button type="button" className={headerPrimaryClass} onClick={() => { setFormData({ name: "", lengthFt: "", widthFt: "", is_active: true }); setIsAddOpen(true); }}>
            <Plus className="size-4" /> Add Room Dimension
          </button>
        </PageActions>

        <ListFrame>
          <ListToolbar>
            <ToolbarSearch value={search} onChange={setSearch} placeholder="Search room dimensions" className="flex-1 md:flex-none" />
            <button type="button" className={cn(headerPrimaryClass, "md:hidden")} onClick={() => { setFormData({ name: "", lengthFt: "", widthFt: "", is_active: true }); setIsAddOpen(true); }}>
              <Plus className="size-4" /> Add Room Dimension
            </button>
            {views.picker && <div className="ml-auto">{views.picker}</div>}
          </ListToolbar>
          <ListBody>
            {isLoading ? (
              <TableSkeleton columns={5} rows={8} flush />
            ) : (
              <ModuleViews
                state={views}
                data={filteredDims}
                columns={columns}
                list={
                  <DataTable
                variant="list"
                columns={columns}
                data={filteredDims}
                showToolbar={true}
                showDeleteAction={true}
                onDeleteSelected={(rows) => setBulkDeleteIds(rows.map((r) => r.id))}
              />
                }
                getKey={(r) => r.id}
                onOpen={openEdit}
                onMove={(r, column) => {
                  const is_active = activeValue(r.is_active, column === "Active");
                  moveRow({
                    setRows: setDims,
                    row: r,
                    same: (a, b) => a.id === b.id,
                    patch: { is_active },
                    request: { path: `/master/room-dimensions/${r.id}`, method: "PUT", body: { name: r.name, lengthFt: r.lengthFt ?? null, widthFt: r.widthFt ?? null, is_active } },
                    success: `Marked ${column.toLowerCase()}`,
                  });
                }}
                card={(r) => ({ title: r.name, avatar: false, id: r.id })}
              />
            )}
          </ListBody>
        </ListFrame>

        {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-0 overflow-hidden">
          <div className="px-5 md:px-6 pt-5 md:pt-6">
            <DialogHeader className="text-left">
              <DialogTitle className="text-lg font-semibold">Add Room Dimension</DialogTitle>
              <DialogDescription className="mt-1">Create a new room dimension for property locations.</DialogDescription>
            </DialogHeader>
          </div>
            <form onSubmit={handleAdd}>
              <div className="px-5 md:px-6 py-5 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="lengthFt" className="text-sm font-medium">Length (ft)</label>
                  <Input id="lengthFt" type="number" min={0} step="0.5" placeholder="e.g. 12" value={formData.lengthFt} onChange={(e) => setFormData({ ...formData, lengthFt: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="widthFt" className="text-sm font-medium">Width (ft)</label>
                  <Input id="widthFt" type="number" min={0} step="0.5" placeholder="e.g. 10" value={formData.widthFt} onChange={(e) => setFormData({ ...formData, widthFt: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter className="px-5 md:px-6 py-4 border-t border-border/60 bg-muted/40 flex-row items-center gap-2">
              <div className="ml-auto flex items-center gap-2">
                <Button type="button" variant="outline" className="h-10 px-5 rounded-xl" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" className="h-10 px-5 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC]" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Add Room Dimension
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
              <DialogTitle className="text-lg font-semibold">Edit Room Dimension</DialogTitle>
              <DialogDescription className="mt-1">Update details and status for this room dimension.</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleEdit}>
            <div className="px-5 md:px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="edit-lengthFt" className="text-sm font-medium">Length (ft)</label>
                  <Input id="edit-lengthFt" type="number" min={0} step="0.5" placeholder="e.g. 12" value={formData.lengthFt} onChange={(e) => setFormData({ ...formData, lengthFt: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="edit-widthFt" className="text-sm font-medium">Width (ft)</label>
                  <Input id="edit-widthFt" type="number" min={0} step="0.5" placeholder="e.g. 10" value={formData.widthFt} onChange={(e) => setFormData({ ...formData, widthFt: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Active Status</label>
                  <p className="text-xs text-muted-foreground">Inactive room dimensions won't appear in the dropdowns.</p>
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
            <DialogTitle>Delete Room Dimension</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedDim?.name}</strong>? This action cannot be undone and may affect existing properties tied to this room dimension.
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
              <DialogTitle>Delete Room Dimension{bulkDeleteIds && bulkDeleteIds.length > 1 ? "s" : ""}</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} room dimension${bulkDeleteIds.length > 1 ? "s" : ""}` : "this room dimension"}? This action cannot be undone.
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
