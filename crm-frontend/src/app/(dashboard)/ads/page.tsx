"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { adsApi } from "@/lib/ads-api";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { ChevronDown, ChevronUp, Edit, Plus, RefreshCw, Search, X } from "lucide-react";

interface AdItem {
  id: number;
  title: string;
  desktopImage?: string;
  mobileImage?: string;
  linkType?: string;
  linkPreset?: string;
  linkCustom?: string;
  placement?: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt?: string;
  createdAt?: string;
}

export default function AdsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Active");
  const [ads, setAds] = useState<AdItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingId, setIsTogglingId] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [role, setRole] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
      setRole(user?.role?.name || user?.role || "");
    } catch { /* ignore */ }
  }, []);

  const tabs = ["Active", "Inactive"];

  const fetchAds = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adsApi.list({ placement: "hero" });
      const items =
        res?.data?.items ?? res?.data?.data ?? (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
      setAds(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Failed to load ads.");
      setAds([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
    window.scrollTo(0, 0);
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, [fetchAds]);

  const displayedAds = useMemo(() => {
    const wantActive = activeTab === "Active";
    let filtered = ads.filter((a) => (wantActive ? a.isActive : !a.isActive));
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((a) => (a.title || "").toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [ads, activeTab, debouncedSearchQuery]);

  const handleToggleStatus = async (ad: AdItem, next: boolean) => {
    setIsTogglingId(ad.id);
    try {
      await adsApi.setStatus(ad.id, next);
      toast.success(next ? "Ad activated." : "Ad deactivated.");
      await fetchAds();
    } catch {
      toast.error("Failed to update ad status.");
    } finally {
      setIsTogglingId(null);
    }
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= displayedAds.length || isReordering) return;
    const swapped = [...displayedAds];
    [swapped[index], swapped[nextIndex]] = [swapped[nextIndex], swapped[index]];
    setIsReordering(true);
    try {
      await adsApi.reorder(swapped.map((a) => a.id));
      toast.success("Ad order updated.");
      await fetchAds();
    } catch {
      toast.error("Failed to reorder ads.");
    } finally {
      setIsReordering(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeleting(true);
    try {
      const results = await Promise.all(
        bulkDeleteIds.map((id) => adsApi.remove(id).then(() => true).catch(() => false))
      );
      const failed = results.filter((r) => !r).length;
      const ok = results.filter((r) => r).length;
      if (failed > 0) toast.error(`Failed to delete ${failed} ad${failed === 1 ? "" : "s"}`);
      if (ok > 0) {
        toast.success(`${ok} ad${ok === 1 ? "" : "s"} deleted successfully`);
        await fetchAds();
      }
    } catch {
      toast.error("Failed to delete ads");
    } finally {
      setIsDeleting(false);
      setBulkDeleteIds(null);
    }
  };

  const columns: ColumnDef<AdItem>[] = [
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
      id: "thumbnail",
      header: "Thumbnail",
      cell: ({ row }) => {
        const src = row.original.desktopImage;
        return (
          <div className="flex items-center justify-center">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={row.original.title || "Ad"}
                className="h-10 w-20 rounded-md border border-border/60 object-cover bg-muted"
                loading="lazy"
              />
            ) : (
              <div className="h-10 w-20 rounded-md border border-border/60 bg-muted flex items-center justify-center text-[11px] text-muted-foreground">
                No image
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => {
        const title = row.original.title || "-";
        return (
          <span className="font-medium text-foreground truncate max-w-[220px] inline-block" title={title}>
            {title}
          </span>
        );
      },
    },
    {
      accessorKey: "placement",
      header: "Placement",
      cell: ({ row }) => (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 font-medium shadow-sm border capitalize">
          {row.original.placement || "hero"}
        </Badge>
      ),
    },
    {
      accessorKey: "sortOrder",
      header: "Order",
      cell: ({ row }) => {
        const index = displayedAds.findIndex((a) => a.id === row.original.id);
        return (
          <div className="flex items-center justify-center gap-1">
            <span className="font-semibold tabular-nums min-w-[2ch]">{row.original.sortOrder ?? "-"}</span>
            <div className="flex flex-col">
              <button
                onClick={(e) => { e.stopPropagation(); handleMove(index, -1); }}
                disabled={index <= 0 || isReordering}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                title="Move up"
                aria-label="Move ad up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleMove(index, 1); }}
                disabled={index < 0 || index >= displayedAds.length - 1 || isReordering}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                title="Move down"
                aria-label="Move ad down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const ad = row.original;
        return (
          <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={!!ad.isActive}
              disabled={isTogglingId === ad.id}
              onCheckedChange={(next) => handleToggleStatus(ad, next)}
              aria-label={`Toggle status for ${ad.title}`}
            />
            <span className={cn("text-xs font-medium", ad.isActive ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>
              {ad.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {row.original.updatedAt ? new Date(row.original.updatedAt).toLocaleDateString("en-GB") : "-"}
        </span>
      ),
    },
  ];

  const tableProps = {
    flush: true as const,
    columns,
    data: displayedAds,
    showToolbar: true,
    showDeleteAction: role === "Admin",
    onDeleteSelected: (rows: AdItem[]) => setBulkDeleteIds(rows.map((r) => r.id)),
    renderToolbarActions: (selectedRows: AdItem[], clearSelection: () => void) => {
      const isSingle = selectedRows.length === 1;
      const row = selectedRows[0];
      return (
        <>
          {isSingle && (
            <Button variant="outline" size="sm" onClick={() => { router.push(`/ads/new?edit=${row.id}`); clearSelection(); }}>
              <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          )}
        </>
      );
    },
  };

  const searchBar = (isMobile: boolean) => (
    <div className="relative flex-1">
      <Search className={isMobile ? "absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" : "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"} />
      <Input
        placeholder="Search ads by title..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className={isMobile
          ? "pl-11 h-12 bg-black/5 dark:bg-white/10 border-transparent rounded-2xl text-[16px] focus-visible:ring-1 focus-visible:ring-primary shadow-none"
          : "pl-9 h-10 bg-muted/30 rounded-xl border-border/60 text-[13.5px]"}
      />
      {isMobile && searchQuery && (
        <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 bg-muted-foreground/20 rounded-full text-foreground hover:bg-muted-foreground/30">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  const pillTabs = (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 h-10 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all border active:scale-95",
              isActive ? "bg-foreground text-background border-foreground shadow-sm" : "bg-card text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );

  const tableSection = (
    <div className="w-full max-w-full min-w-0 md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col">
      {isLoading ? <TableSkeleton columns={7} rows={10} flush /> : <DataTable {...tableProps} />}
    </div>
  );

  const desktopFilters = (
    <div className="bg-card border rounded-xl overflow-hidden shadow-sm md:flex md:flex-col md:flex-1 md:min-h-0">
      <div className="flex items-center justify-between px-6 border-b bg-muted/10 pt-4 gap-4">
        <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide relative">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={"relative pb-4 text-[15px] whitespace-nowrap font-semibold transition-colors duration-200 ease-out " + (activeTab === tab ? "text-[#0052FF]" : "text-muted-foreground hover:text-foreground")}
            >
              {tab}
              {activeTab === tab && (
                <motion.div layoutId="desktopActiveTabUnderline" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0052FF] rounded-t-full" initial={false} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b bg-background">
        <div className="flex-1 min-w-[240px] max-w-md">{searchBar(false)}</div>
        {searchQuery && (
          <Button variant="ghost" size="icon" onClick={() => setSearchQuery("")} className="h-10 w-10 rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors" title="Clear Search">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="w-full max-w-full min-w-0 md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col">{tableSection}</div>
    </div>
  );

  const mobileFilters = (
    <div className="px-4 pb-2 space-y-4">
      <div className="flex items-center gap-2">
        {searchBar(true)}
      </div>
      <Link href="/ads/new" className="flex h-11 w-full rounded-xl bg-[#0052FF] px-4 text-[14px] font-semibold text-white shadow-md hover:bg-[#0052FF]/90 items-center justify-center gap-2 transition-transform active:scale-95">
        <Plus size={18} />
        Add Ad
      </Link>
      {pillTabs}
    </div>
  );

  return (
    <>
      <MobileHeader title="Ads" />
      <div className="w-full flex flex-col space-y-6 pt-4 lg:p-0 md:h-full">
        <Device
          mobile={null}
          desktop={
            <div className="flex items-center justify-between pr-[150px] min-h-[48px]">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight">Ads</h1>
                <p className="text-muted-foreground text-sm mt-0.5">Manage your hero carousel ads</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border/60" onClick={() => fetchAds()} title="Refresh">
                  <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                </Button>
                <Link href="/ads/new" className="inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95">
                  <Plus size={18} />
                  Add Ad
                </Link>
              </div>
            </div>
          }
        />

        <Device mobile={mobileFilters} desktop={desktopFilters} />
        <Device desktop={null} mobile={<div className="w-full px-4 md:px-0">{tableSection}</div>} />

      </div>

      <Dialog open={bulkDeleteIds !== null} onOpenChange={(open) => { if (!open) setBulkDeleteIds(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Ad{bulkDeleteIds && bulkDeleteIds.length > 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} ad${bulkDeleteIds.length > 1 ? "s" : ""}` : "this ad"}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBulkDeleteIds(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
