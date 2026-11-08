"use client";

import { isAdmin } from "@/lib/permissions";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/tables/data-table";
import { DateCell, IdCell, NameCell, formatTableDate, statusDot } from "@/components/tables/cells";
import { ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileHeader } from "@/components/layout/mobile-header";
import { EmptyState as IllustratedEmpty } from "@/components/shared/empty-state";
import { ListBody, ListFrame, ListToolbar, ToolbarClear, ToolbarEnd, ToolbarSearch, headerPrimaryClass, headerButtonClass } from "@/components/layout/list-page";
import { FilterStrip, QuickFilter } from "@/components/shared/quick-filters";
import { PageActions } from "@/components/layout/page-actions";
import { Device } from "@/components/shared/device";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { adsApi } from "@/lib/ads-api";
import { ADS_PLACEMENTS, getPlacement } from "@/lib/ads-link-presets";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Edit, Plus, Search, X } from "lucide-react";
import { AdForm } from "./_components/AdForm";

interface AdItem {
  id: number;
  title: string;
  desktopImage?: string;
  mobileImage?: string;
  linkType?: string;
  linkPreset?: string;
  linkCustom?: string;
  placement?: string;
  audience?: string | null;
  sortOrder: number;
  isActive: boolean;
  updatedAt?: string;
  createdAt?: string;
}

export default function AdsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = usePersistedState<string>("ads:tab", "Active", { allowed: ["Active", "Inactive"] });
  const [placement, setPlacement] = usePersistedState<string>("ads:placement", "hero", { allowed: ADS_PLACEMENTS.map((p) => p.value) });
  const placementSpec = getPlacement(placement);
  const adFields: ViewField<AdItem>[] = [
    ...(placementSpec.audiences.length
      ? [{ id: "audience", label: "Shows on", get: (ad: AdItem) => placementSpec.audiences.find((x) => x.value === ad.audience)?.label ?? "All — fallback" }]
      : []),
    { id: "status", label: "Status", get: (ad) => (ad.isActive ? "Active" : "Inactive"), order: ["Active", "Inactive"], dot: (v) => statusDot(v) },
  ];
  const views = useModuleView("ads", adFields, "status");
  const [ads, setAds] = useState<AdItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);
  const [isTogglingId, setIsTogglingId] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [role] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
      return user?.role?.name || user?.role || "";
    } catch { return ""; }
  });

  const [searchQuery, setSearchQuery] = usePersistedState("ads:search", "");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const tabs = ["Active", "Inactive"];

  const fetchAds = useCallback(async () => {
    const request = ++requestId.current;
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await adsApi.list({ placement });
      if (request !== requestId.current) return;
      if (res?.success === false) throw new Error(res.message || "Failed to load advertisements.");
      const items =
        res?.data?.items ?? res?.data?.data ?? (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
      setAds(Array.isArray(items) ? items : []);
    } catch (err) {
      if (request !== requestId.current) return;
      setLoadError(err instanceof Error ? err.message : "Failed to load advertisements.");
      setAds([]);
    } finally {
      if (request === requestId.current) setIsLoading(false);
    }
  }, [placement]);

  useEffect(() => {
    // Synchronize the list with the selected placement; request IDs discard stale responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAds();
    window.scrollTo(0, 0);
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
    return () => { requestId.current += 1; };
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

  const isBusy = isTogglingId !== null || isReordering || isDeleting;
  const activeCount = ads.filter((ad) => ad.isActive).length;

  const handleToggleStatus = async (ad: AdItem, next: boolean) => {
    if (isBusy || isLoading) return;
    setIsTogglingId(ad.id);
    try {
      await adsApi.setStatus(ad.id, next);
      toast.success(next ? "Advertisement activated." : "Advertisement deactivated.");
      await fetchAds();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update ad status.");
    } finally {
      setIsTogglingId(null);
    }
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= displayedAds.length || isBusy || isLoading || searchQuery.trim()) return;
    const current = displayedAds[index];
    const neighbor = displayedAds[nextIndex];
    if (!current || !neighbor) return;
    const full = [...ads].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const fullIndex = full.findIndex((a) => a.id === current.id);
    const fullNeighborIndex = full.findIndex((a) => a.id === neighbor.id);
    if (fullIndex < 0 || fullNeighborIndex < 0) return;
    [full[fullIndex], full[fullNeighborIndex]] = [full[fullNeighborIndex], full[fullIndex]];
    setIsReordering(true);
    try {
      await adsApi.reorder(full.map((a) => a.id));
      toast.success("Advertisement order updated.");
      await fetchAds();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder ads.");
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
            indeterminate={table.getIsSomePageRowsSelected()}
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
            aria-label={`Select ${row.original.title}`}
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => <IdCell href={`/ads/${row.original.id}`}>{row.original.id}</IdCell>,
    },
    {
      id: "thumbnail",
      header: "Thumbnail",
      cell: ({ row }) => {
        const rawSrc = row.original.desktopImage;
        const src = rawSrc && rawSrc.startsWith("http") ? rawSrc : null;
        const [rw, rh] = placementSpec.desktop.ratio;
        return (
          <div className="flex items-center justify-center">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={row.original.title || "Advertisement"}
                style={{ aspectRatio: `${rw} / ${rh}` }}
                className="h-10 w-auto max-w-36 rounded-md border border-border/60 object-cover bg-muted"
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
        const title = row.original.title || "—";
        return (
          <span title={title}><NameCell name={title} className="max-w-[240px]" /></span>
        );
      },
    },
    ...(placementSpec.audiences.length
      ? [
          {
            id: "audience",
            header: "Shows on",
            cell: ({ row }) => {
              const match = placementSpec.audiences.find((x) => x.value === row.original.audience);
              return match ? (
                <span>{match.label}</span>
              ) : (
                <span className="text-muted-foreground" title="Shown wherever no targeted ad is active">All — fallback</span>
              );
            },
          } satisfies ColumnDef<AdItem>,
        ]
      : []),
    {
      accessorKey: "sortOrder",
      header: "Order",
      cell: ({ row }) => {
        const index = displayedAds.findIndex((a) => a.id === row.original.id);
        return (
          <div className="flex items-center justify-center gap-1">
            <span className="font-semibold tabular-nums min-w-[2ch]">{row.original.sortOrder ?? "—"}</span>
            <div className="flex flex-col">
              <button
                onClick={(e) => { e.stopPropagation(); handleMove(index, -1); }}
                disabled={index <= 0 || isBusy || !!searchQuery.trim()}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                title={searchQuery.trim() ? "Clear search to change display order" : "Move up"}
                aria-label="Move ad up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleMove(index, 1); }}
                disabled={index < 0 || index >= displayedAds.length - 1 || isBusy || !!searchQuery.trim()}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                title={searchQuery.trim() ? "Clear search to change display order" : "Move down"}
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
              disabled={isBusy || isLoading}
              onCheckedChange={(next) => handleToggleStatus(ad, next)}
              aria-label={`Toggle status for ${ad.title}`}
            />
            <span className={cn("text-[13px]", ad.isActive ? "text-foreground" : "text-muted-foreground")}>
              {ad.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ row }) => <DateCell value={row.original.updatedAt} />,
    },
  ];

  const tableProps = {
    flush: true as const,
    columns,
    data: displayedAds,
    showToolbar: true,
    showDeleteAction: isAdmin({ role }) && !isBusy,
    persistKey: false as const,
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
      <Search className={isMobile ? "absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground" : "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"} />
      <Input
        aria-label="Search advertisements by title"
        placeholder="Search ads by title..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className={isMobile
          ? "pl-10 h-10 bg-foreground/[0.06] border-transparent rounded-[11px] text-[16px] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[#017D58]/30 shadow-none"
          : "pl-9 h-10 bg-muted/30 rounded-xl border-border/60 text-[13.5px]"}
      />
      {isMobile && searchQuery && (
        <button aria-label="Clear search" onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 bg-muted-foreground/20 rounded-full text-foreground hover:bg-muted-foreground/30">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  const placementPicker = (isMobile: boolean) => (
    <div className={cn("flex items-center gap-2 overflow-x-auto scrollbar-hide", isMobile ? "pb-1 -mx-4 px-4" : "pb-4 shrink-0")}>
      {ADS_PLACEMENTS.map((p) => (
        <button
          key={p.value}
          onClick={() => setPlacement(p.value)}
          aria-pressed={placement === p.value}
          disabled={isBusy}
          title={p.description}
          className={cn(
            "h-9 px-4 rounded-full text-[13px] font-medium whitespace-nowrap transition-all duration-200 border active:scale-95",
            placement === p.value
              ? "bg-[#0052FF] text-white border-[#0052FF] shadow-sm"
              : "bg-background text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
          )}
        >
          {p.label}
        </button>
      ))}
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
            aria-pressed={activeTab === tab}
            disabled={isBusy}
            className={cn(
              "px-3.5 h-8 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors active:opacity-60",
              isActive ? "bg-[#017D58] text-white dark:bg-[#2FB585] dark:text-black" : "bg-foreground/[0.06] text-foreground"
            )}
          >
            {tab} <span className="ml-2 tabular-nums opacity-70">{isLoading ? "…" : tab === "Active" ? activeCount : ads.length - activeCount}</span>
          </button>
        );
      })}
    </div>
  );

  const emptyState = (
    <div role={loadError ? "alert" : "status"}>
      <IllustratedEmpty
        kind={loadError ? "error" : searchQuery.trim() ? "search" : "records"}
        title={loadError ? "Couldn't load advertisements" : searchQuery.trim() ? "No matching advertisements" : `No ${activeTab.toLowerCase()} advertisements`}
        description={loadError || (searchQuery.trim() ? "Try a different title or clear your search." : `Advertisements in ${placementSpec.label.toLowerCase()} will appear here. Add one or set Status to ${activeTab === "Active" ? "Inactive" : "Active"}.`)}
        action={
          loadError ? (
            <button type="button" className={headerButtonClass} onClick={() => fetchAds()}>Try again</button>
          ) : searchQuery.trim() ? (
            <button type="button" className={headerButtonClass} onClick={() => setSearchQuery("")}>Clear search</button>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className={headerPrimaryClass}>Add advertisement</button>
          )
        }
      />
    </div>
  );

  const mobileList = (
    <div className="space-y-4">
      {displayedAds.map((ad, index) => (
        <article key={ad.id} className="space-y-4 rounded-xl border bg-card p-4">
          {ad.desktopImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.desktopImage} alt={ad.title} loading="lazy" className="max-h-48 w-full rounded-lg bg-muted object-contain" />
          )}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <h2 className="break-words text-base font-semibold"><Link href={`/ads/${ad.id}`} className="hover:underline">{ad.title}</Link></h2>
              <p className="text-xs text-muted-foreground">{placementSpec.audiences.find((a) => a.value === ad.audience)?.label || placementSpec.label}</p>
            </div>
            <Switch checked={ad.isActive} disabled={isBusy} onCheckedChange={(next) => handleToggleStatus(ad, next)} aria-label={`${ad.isActive ? "Deactivate" : "Activate"} ${ad.title}`} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn("text-xs font-medium", ad.isActive ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>{ad.isActive ? "Active" : "Inactive"}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-10 w-10" disabled={index === 0 || isBusy || !!searchQuery.trim()} onClick={() => handleMove(index, -1)} aria-label={`Move ${ad.title} up`}><ChevronUp /></Button>
              <Button variant="outline" size="icon" className="h-10 w-10" disabled={index === displayedAds.length - 1 || isBusy || !!searchQuery.trim()} onClick={() => handleMove(index, 1)} aria-label={`Move ${ad.title} down`}><ChevronDown /></Button>
              <Link href={`/ads/new?edit=${ad.id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Edit</Link>
              {["Admin", "Super Admin"].includes(role) && <Button variant="destructive" className="h-10" disabled={isBusy} onClick={() => setBulkDeleteIds([ad.id])}>Delete</Button>}
            </div>
          </div>
        </article>
      ))}
    </div>
  );

  const tableSection = (
    <div className="w-full max-w-full min-w-0 md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col" aria-busy={isLoading}>
      {isLoading ? <TableSkeleton columns={8} rows={6} flush /> : loadError || !displayedAds.length ? emptyState : <Device mobile={mobileList} desktop={
        <ModuleViews
          state={views}
          data={displayedAds}
          columns={columns}
          list={<DataTable key={displayedAds.map((ad) => ad.id).join(",")} {...tableProps} variant="list" />}
          getKey={(ad) => ad.id}
          onOpen={(ad) => router.push(`/ads/${ad.id}`)}
          onMove={(ad, column) => handleToggleStatus(ad, column === "Active")}
          card={(ad) => ({ title: ad.title || "Advertisement", avatar: false, id: ad.id, href: `/ads/${ad.id}`, subtitle: ad.updatedAt ? `Updated ${formatTableDate(ad.updatedAt)}` : undefined, tag: ad.isActive ? undefined : "Inactive" })}
          noun="ads"
        />
      } />}
    </div>
  );

  const desktopFilters = (
    <ListFrame>
      <ListToolbar className="md:flex-nowrap">
        <FilterStrip>
          <QuickFilter label="Placement" required value={placement} onChange={(v) => setPlacement(v as typeof placement)}
            options={ADS_PLACEMENTS.map((p) => ({ value: p.value, label: p.label }))} />
          <QuickFilter label="Status" required value={activeTab} onChange={(v) => setActiveTab(v as typeof activeTab)}
            options={tabs.map((tab) => ({ value: tab, label: isLoading ? tab : `${tab} · ${tab === "Active" ? activeCount : ads.length - activeCount}` }))} />
        </FilterStrip>
        <ToolbarEnd>
          {views.picker}
          <ToolbarSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search ads by title" />
          {searchQuery && <ToolbarClear onClick={() => setSearchQuery("")} title="Clear search" />}
        </ToolbarEnd>
      </ListToolbar>
      <ListBody>{tableSection}</ListBody>
    </ListFrame>
  );

  const mobileFilters = (
    <div className="px-4 pb-2 space-y-3">
      <div className="flex items-center gap-2">
        {searchBar(true)}
      </div>
      <button type="button" onClick={() => setCreating(true)} className="flex h-11 w-full rounded-xl bg-[#0052FF] px-4 text-[14px] font-semibold text-white shadow-md hover:bg-[#0052FF]/90 items-center justify-center gap-2 transition-transform active:scale-95">
        <Plus size={18} />
        Add Advertisement
      </button>
      {placementPicker(true)}
      {pillTabs}
    </div>
  );

  return (
    <>
      <MobileHeader title="Advertisement" />
      {views.switcher}
      <div className="w-full flex flex-col space-y-6 pt-4 md:space-y-0 md:pt-0 md:h-full">
        <PageActions>
          <button type="button" onClick={() => setCreating(true)} className={headerPrimaryClass}>
            <Plus className="size-4" />
            Add Advertisement
          </button>
        </PageActions>

        <Device mobile={mobileFilters} desktop={desktopFilters} />
        <Device desktop={null} mobile={<div className="w-full">{tableSection}</div>} />

      </div>

      {creating && (
        <AdForm
          mode="create"
          defaultPlacement={placement}
          onClose={() => setCreating(false)}
          onSuccess={(saved) => {
            setCreating(false);
            // Show the list the new ad landed in.
            setSearchQuery("");
            setActiveTab(saved.isActive ? "Active" : "Inactive");
            if (saved.placement !== placement) setPlacement(saved.placement);
            else void fetchAds();
          }}
        />
      )}

      <Dialog open={bulkDeleteIds !== null} onOpenChange={(open) => { if (!open && !isDeleting) setBulkDeleteIds(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Advertisement{bulkDeleteIds && bulkDeleteIds.length > 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} advertisement${bulkDeleteIds.length > 1 ? "s" : ""}` : "this advertisement"}? This action cannot be undone.
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
