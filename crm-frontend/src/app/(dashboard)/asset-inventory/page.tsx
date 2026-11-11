"use client";

import { extraColumns } from "@/components/tables/extra-columns";
import { isAdmin } from "@/lib/permissions";
import { apiFetch } from "@/lib/api-fetch";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ModuleMobileRows, ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { IdCell, StatusCell, statusDot } from "@/components/tables/cells";
import { ASSET_STATUSES } from "@/lib/asset-options";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Eye, Search, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ListFrame, ListToolbar, ToolbarEnd, ToolbarSearch, headerPrimaryClass, toolbarFilterButton } from "@/components/layout/list-page";
import { ClearFilters, FilterStrip, QuickFilter } from "@/components/shared/quick-filters";
import { PageActions } from "@/components/layout/page-actions";
import { Device } from "@/components/shared/device";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { AssetForm } from "./_components/AssetForm";


const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const ASSET_FIELDS: ViewField[] = [
  { id: "status", label: "Status", get: (a) => a.status || "New", order: ASSET_STATUSES, dot: (v) => statusDot(v, v === "Sold" ? "violet" : undefined) },
  { id: "district", label: "District", get: (a) => a.location?.district },
  { id: "zone", label: "Zone", get: (a) => a.location?.zone },
];

export default function AssetInventoryPage() {
  const router = useRouter();
  const views = useModuleView("assets", ASSET_FIELDS);
  const [assets, setAssets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = usePersistedState("assets:search", "");
  const [filters, setFilters] = usePersistedState("assets:filters", { status: "" });

  const [creating, setCreating] = useState(false);
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

  useEffect(() => { fetchAssets(); window.scrollTo(0, 0); const main = document.querySelector("main"); if (main) main.scrollTop = 0; }, [fetchAssets]);

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
    if (!expectation) return "—";
    const val = expectation * 100000;
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(2)} Lakhs`;
    return String(val);
  }

  function formatTotalPrice(price: number | null | undefined): string {
    if (!price) return "—";
    if (price >= 10000000) return `${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `${(price / 100000).toFixed(2)} Lakhs`;
    return String(price);
  }

  const filteredAssets = useMemo(() => {
    let filtered = assets;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a => {
        const id = `AST${String(a.id).padStart(5, "0")}`.toLowerCase();
        const owner = (a.owner_name || "").toLowerCase();
        const loc = a.location;
        const address = [loc?.district, loc?.taluk, loc?.village, loc?.zone].filter(Boolean).join(" ").toLowerCase();
        return id.includes(q) || owner.includes(q) || address.includes(q);
      });
    }
    if (filters.status) {
      filtered = filtered.filter(a => a.status === filters.status);
    }
    return filtered;
  }, [assets, searchQuery, filters]);

  // Every status, not just the ones some asset has today, plus any old value still in the data.
  const uniqueStatuses = Array.from(new Set([...ASSET_STATUSES, ...assets.map(a => a.status).filter(Boolean)]));
  const activeFiltersCount = Object.values(filters).filter(v => v !== "").length;
  const clearFilters = () => setFilters({ status: "" });

  const renderFilterPopover = (isMobile: boolean) => (
    <Popover>
      <PopoverTrigger render={
        isMobile ? (
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-[11px] bg-foreground/[0.06] border-transparent relative shrink-0">
            <Filter className="h-5 w-5 text-foreground" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#017D58] border-2 border-background text-white text-[10px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        ) : (
          toolbarFilterButton(activeFiltersCount)
        )
      } />
      <PopoverContent align={isMobile ? "end" : "start"} className="w-[calc(100vw-32px)] sm:w-80 p-0 rounded-2xl shadow-xl overflow-hidden border-border/60 mx-4 sm:mx-0">
        <div className="flex items-center justify-between p-4 border-b bg-muted/10">
          <h4 className="font-semibold text-foreground text-sm">Filter Assets</h4>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground hover:text-red-600">
              Clear All
            </Button>
          )}
        </div>
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</label>
            <FormSelect
              name="status"
              options={uniqueStatuses.map(s => ({label: s, value: s as string}))}
              value={filters.status}
              onValueChange={v => setFilters(f => ({...f, status: v || ""}))}
              placeholder="All Statuses"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

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
      header: "ID",
      cell: ({ row }) => (
        <IdCell href={`/asset-inventory/${row.original.id}`}>AST{String(row.original.id).padStart(5, "0")}</IdCell>
      ),
    },
    {
      id: "address",
      header: "Address",
      cell: ({ row }) => {
        const loc = row.original.location;
        if (!loc) return <span className="text-muted-foreground">—</span>;
        const parts = [loc.district, loc.taluk, loc.village].filter(Boolean);
        const zone = loc.zone || null;
        return (
          <div>
            <div className="font-medium text-foreground">{parts.join(", ") || "—"}</div>
            {zone && <div className="text-[12px] text-muted-foreground">{zone}</div>}
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
        return <span className="whitespace-nowrap tabular-nums">{extent != null ? `${extent} Acres` : "—"}</span>;
      },
    },
    {
      id: "budget",
      header: "Budget",
      cell: ({ row }) => {
        const fin = row.original.financials;
        return <span className="whitespace-nowrap tabular-nums">{formatBudget(fin?.expectation)}</span>;
      },
    },
    {
      id: "total_price",
      header: "Total Price",
      cell: ({ row }) => {
        const fin = row.original.financials;
        return <span className="whitespace-nowrap tabular-nums">{formatTotalPrice(fin?.land_price)}</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status || "New";
        return <StatusCell status={status} tone={status === "Sold" ? "violet" : undefined} />;
      },
    },
    ...extraColumns([
      { id: "display_id", label: "Asset code", value: (r) => r.display_id },
      { id: "owner_name", label: "Owner", value: (r) => r.owner_name },
      { id: "mobile_number", label: "Mobile", value: (r) => r.mobile_number },
      { id: "source", label: "Source", value: (r) => r.source, kind: "label" },
      { id: "mediator_name", label: "Mediator", value: (r) => r.mediator_name },
      { id: "road_name", label: "Road", value: (r) => r.location?.road_name },
      { id: "junction_name", label: "Junction", value: (r) => r.location?.junction_name },
      { id: "distance_from_main", label: "Distance from main road", value: (r) => r.location?.distance_from_main },
      { id: "soil_type", label: "Soil type", value: (r) => r.feature?.soil_type, kind: "label" },
      { id: "water_source", label: "Water source", value: (r) => r.feature?.water_source, kind: "label" },
      { id: "saleable_area", label: "Saleable area", value: (r) => r.feature?.saleable_area },
      { id: "dtcp_price", label: "DTCP price", value: (r) => r.financials?.dtcp_price },
      { id: "business_mode", label: "Business mode", value: (r) => r.financials?.business_mode, kind: "label" },
      { id: "visited_date", label: "Site visit", value: (r) => r.visited_date, kind: "date" },
      { id: "outcome", label: "Outcome", value: (r) => r.outcome },
      { id: "quality_score", label: "Quality score", value: (r) => r.quality_score, kind: "number" },
      { id: "created_at", label: "Added on", value: (r) => r.created_at, kind: "date" },
    ]),
  ];

  const tableProps = {
    flush: true as const,
    columns,
    data: filteredAssets,
    showToolbar: true,
    showDeleteAction: isAdmin({ role }),
    onDeleteSelected: (rows: any[]) => setBulkDeleteIds(rows.map(r => r.id)),
    renderToolbarActions: (selectedRows: any[]) => {
      if (selectedRows.length !== 1) return null;
      const row = selectedRows[0];
      return (
        <>
          <Button variant="outline" size="sm" onClick={() => router.push("/asset-inventory/" + row.id)}>
            <Eye size={15} className="mr-1.5" /> View
          </Button>
        </>
      );
    },
  };

  type Row = (typeof filteredAssets)[number];
  const rowCard = (a: Row) => ({ title: [a.location?.district, a.location?.taluk, a.location?.village].filter(Boolean).join(", ") || "Asset", avatar: false, id: `AST${String(a.id).padStart(5, "0")}`, href: `/asset-inventory/${a.id}`, subtitle: a.feature?.extent != null ? `${a.feature.extent} Acres` : undefined, tag: a.location?.zone });
  const openRow = (a: Row) => router.push(`/asset-inventory/${a.id}`);

  const mobileFilters = (
    <div className="px-4 pb-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground" />
          <Input
            placeholder="Search Assets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-foreground/[0.06] border-transparent rounded-[11px] text-[16px] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[#017D58]/30 shadow-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 bg-muted-foreground/20 rounded-full text-foreground hover:bg-muted-foreground/30">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {renderFilterPopover(true)}
      </div>
    </div>
  );

  const desktopFilters = (
    <ListFrame>
      <ListToolbar className="md:flex-nowrap">
        <FilterStrip>
          <QuickFilter label="Status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={uniqueStatuses.map((s) => ({ label: s as string, value: s as string, dot: statusDot(s as string, s === "Sold" ? "violet" : undefined) }))} />
          <ClearFilters show={activeFiltersCount > 0 || !!searchQuery} onClick={() => { clearFilters(); setSearchQuery(""); }} />
        </FilterStrip>
        <ToolbarEnd>
          {views.picker}
          <ToolbarSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search ID, Owner, Address" className="md:[&_input]:w-56" />
        </ToolbarEnd>
      </ListToolbar>

      {/* Table */}
      <div className="flex w-full min-w-0 flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
        {isLoading ? <TableSkeleton flush /> : <ModuleViews
          state={views}
          data={filteredAssets}
          columns={columns}
          list={
            <DataTable {...tableProps} variant="list" />
          }
          getKey={(a) => a.id}
          onOpen={openRow}
          card={rowCard}
          noun="assets"
        />}
      </div>
    </ListFrame>
  );

  return (
    <>
      <MobileHeader title="Assets" />
      {views.switcher}

      <div className="flex flex-col space-y-4 md:space-y-0 md:h-full">
        {/* Desktop page header */}
        <PageActions>
          <button type="button" onClick={() => setCreating(true)} className={headerPrimaryClass}>
            <Plus className="size-4" />
            Add Asset
          </button>
        </PageActions>

        {/* Filters + Table */}
        <Device mobile={mobileFilters} desktop={desktopFilters} />

        {/* Mobile table */}
        <Device
          desktop={null}
          mobile={
            <ModuleMobileRows state={views} card={rowCard} onOpen={openRow}>
            <div className="w-full pb-4">
              {isLoading ? <TableSkeleton /> : <DataTable {...tableProps} />}
            </div>
            </ModuleMobileRows>
          }
        />
      </div>

      {creating && <AssetForm onClose={() => setCreating(false)} onCreated={(id) => router.push(`/asset-inventory/${id}`)} />}

      <Dialog open={deleteId !== null || bulkDeleteIds !== null} onOpenChange={(open) => {
        if (!open) { setDeleteId(null); setBulkDeleteIds(null); }
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
    </>
  );
}
