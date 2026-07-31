"use client";

import { apiFetch } from "@/lib/api-fetch";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MobileHeader } from "@/components/layout/mobile-header";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const STATUS_STYLES: Record<string, string> = {
  "New": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  "Sold": "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  "Available": "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400",
  "Pending": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function AssetInventoryPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
        setRole(user?.role?.name || user?.role || "");
      } catch {}
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(API_URL + "/assets");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAssets(data.data);
      } else {
        setAssets([]);
      }
    } catch {
      toast.error("Failed to load assets.");
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await apiFetch(API_URL + "/assets/" + deleteId, { method: "DELETE" });
      if (res.ok) {
        toast.success("Asset deleted successfully");
        fetchAssets();
      } else {
        toast.error("Failed to delete asset");
      }
    } catch {
      toast.error("Failed to delete asset");
    } finally {
      setDeleteId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const promises = bulkDeleteIds.map(id => apiFetch(API_URL + "/assets/" + id, { method: "DELETE" }));
      await Promise.all(promises);
      toast.success(`${bulkDeleteIds.length} asset(s) deleted successfully`);
      fetchAssets();
    } catch {
      toast.error("Failed to delete some or all assets");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
    }
  };

  function formatBudget(expectation: number | null | undefined): string {
    if (!expectation) return "-";
    // expectation is in lakhs; multiply by 1,00,000 to get actual value
    const val = expectation * 100000;
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(2)} Lakhs`;
    return String(val);
  }

  function formatTotalPrice(price: number | null | undefined): string {
    if (!price) return "-";
    if (price >= 10000000) return `${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `${(price / 100000).toFixed(2)} Lakhs`;
    return String(price);
  }

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
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: "Asset ID",
      cell: ({ row }) => (
        <Link href={`/asset-inventory/${row.original.id}`} className="text-[#0052FF] hover:underline font-medium">
          AST{String(row.original.id).padStart(5, "0")}
        </Link>
      ),
    },
    {
      id: "address",
      header: "Address",
      cell: ({ row }) => {
        const loc = row.original.location;
        if (!loc) return <span className="text-muted-foreground">-</span>;
        const parts = [loc.district, loc.taluk, loc.village].filter(Boolean);
        const zone = loc.zone || null;
        return (
          <div>
            <div className="font-medium">{parts.join(", ") || "-"}</div>
            {zone && <div className="text-xs text-muted-foreground">{zone}</div>}
          </div>
        );
      },
    },
    {
      id: "extent",
      header: "Extent",
      cell: ({ row }) => {
        const feat = row.original.feature;
        const extent = feat?.extent ?? null;
        return <div className="text-muted-foreground">{extent != null ? `${extent} Acres` : "-"}</div>;
      },
    },
    {
      id: "budget",
      header: "Budget",
      cell: ({ row }) => {
        const fin = row.original.financials;
        return <div className="text-muted-foreground">{formatBudget(fin?.expectation)}</div>;
      },
    },
    {
      id: "total_price",
      header: "Total Price",
      cell: ({ row }) => {
        const fin = row.original.financials;
        return <div className="text-muted-foreground">{formatTotalPrice(fin?.land_price)}</div>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status || "New";
        const style = STATUS_STYLES[status] || "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300";
        return (
          <Badge variant="outline" className={`font-semibold border ${style}`}>
            {status}
          </Badge>
        );
      },
    }
  ];

  return (
    <div className="flex flex-col space-y-6">
      <MobileHeader title="Assets" />
      <div className="hidden md:flex h-[48px] items-center justify-between pr-[150px]">
        <h1 className="text-[28px] font-bold tracking-tight">Asset Inventory</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border/60" onClick={fetchAssets} title="Refresh">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </Button>
          <Link href="/asset-inventory/new" className="inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95">
            <Plus size={18} />
            Add New Asset
          </Link>
        </div>
      </div>
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden p-6">
        <DataTable 
          columns={columns} 
          data={assets} 
          showToolbar={true}
          showDeleteAction={role === "Admin"}
          onDeleteSelected={(rows) => setBulkDeleteIds(rows.map(r => r.id))}
          renderToolbarActions={(selectedRows) => {
            if (selectedRows.length !== 1) return null;
            const row = selectedRows[0];
            return (
              <>
                <Button variant="outline" size="sm" onClick={() => router.push("/asset-inventory/" + row.id)}>
                  <Eye size={15} className="mr-1.5" /> View
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push("/asset-inventory/new?edit=" + row.id)}>
                  <Edit size={15} className="mr-1.5" /> Edit
                </Button>
              </>
            );
          }}
        />
      </div>

      <Dialog open={deleteId !== null || bulkDeleteIds !== null} onOpenChange={(open) => {
        if (!open) {
          setDeleteId(null);
          setBulkDeleteIds(null);
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Asset(s)</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} asset(s)` : 'this asset'}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setDeleteId(null); setBulkDeleteIds(null); }} disabled={isDeletingBulk}>Cancel</Button>
            <Button variant="destructive" onClick={bulkDeleteIds ? handleBulkDelete : handleDelete} disabled={isDeletingBulk}>
              {isDeletingBulk ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
