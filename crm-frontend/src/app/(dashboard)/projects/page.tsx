"use client";

import { isAdmin } from "@/lib/permissions";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProjectForm } from "./_components/ProjectForm";
import { DataTable } from "@/components/tables/data-table";
import { IdCell, NameCell, StatusCell, statusDot } from "@/components/tables/cells";
import { BOARD_PAGE, ModuleMobileRows, ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { moveRow } from "@/lib/move-row";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ListBody, ListFrame, ListToolbar, SegmentTabs, ToolbarEnd, ToolbarSearch, headerPrimaryClass, toolbarFilterButton } from "@/components/layout/list-page";
import { ClearFilters, FilterDivider, FilterStrip, QuickFilter, RangeQuickFilter } from "@/components/shared/quick-filters";
import { PageActions } from "@/components/layout/page-actions";
import { Device } from "@/components/shared/device";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useClampedPage, usePersistedState } from "@/hooks/use-persisted-state";
import { useProjectsList } from "@/hooks/use-projects-list";
import { computeProjectRanges, formatPriceRange } from "@/lib/project-ranges";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { Edit, Eye, Filter, Plus, Search, X } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const PROJECT_TYPE_OPTIONS = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
];

const BHK_FILTER_OPTIONS = [1, 2, 3, 4, 5].map((b) => ({ value: String(b), label: `${b} BHK` }));

const UNITS_FILTER_OPTIONS = [
  { value: "5", label: "5+ units" },
  { value: "10", label: "10+ units" },
  { value: "25", label: "25+ units" },
  { value: "50", label: "50+ units" },
  { value: "100", label: "100+ units" },
];

const PROJECT_TABS = ["All", "Published", "Draft", "Booked", "Archived"];

const PROJECT_FIELDS: ViewField[] = [
  { id: "status", label: "Status", get: (p) => p.status, order: ["published", "draft", "booked", "archived"], dot: (v) => statusDot(v), capitalize: true },
  { id: "projectType", label: "Type", get: (p) => p.projectType, capitalize: true },
  { id: "city", label: "City", get: (p) => p.city },
];

export default function ProjectsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = usePersistedState<string>("projects:tab", "All", { allowed: PROJECT_TABS });
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [creating, setCreating] = useState(false);

  const [searchQuery, setSearchQuery] = usePersistedState("projects:search", "");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [filters, setFilters] = usePersistedState("projects:filters", { projectType: "", minPrice: "", maxPrice: "", bhk: [] as number[], locality: "", minUnits: "" });
  const [pagination, setPagination] = usePersistedState("projects:page", { pageIndex: 0, pageSize: 10 });
  const [role, setRole] = useState("");
  const [localityOptions, setLocalityOptions] = useState<{ value: string; label: string }[]>([]);

  const views = useModuleView("projects", PROJECT_FIELDS);
  const { projects, setProjects, totalCount, isLoading, fetchProjects, deleteBulk } = useProjectsList();
  useClampedPage(pagination, setPagination, totalCount, isLoading);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
      setRole(user?.role?.name || user?.role || "");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(`${API_URL}/master/all-sublocations`, window.location.origin);
        const res = await apiFetch(url.toString());
        const data = await res.json();
        if (data?.success) {
          const names = Array.from(
            new Set(
              (data.data ?? []).map((s: any) => String(s.locality_name ?? "").trim()).filter((n: string) => n !== ""),
            ),
          ).sort((a, b) => (a as string).localeCompare(b as string));
          setLocalityOptions(names.map((n) => ({ value: n as string, label: n as string })));
        }
      } catch { /* non-fatal: locality dropdown stays empty */ }
    })();
  }, []);

  const tabs = PROJECT_TABS;

  useEffect(() => {
    fetchProjects({ pagination: views.isBoard ? BOARD_PAGE : pagination, debouncedSearchQuery, activeTab, filters });
  }, [fetchProjects, pagination, debouncedSearchQuery, activeTab, filters, views.isBoard]);
  const reloadProjects = () => fetchProjects({ pagination: views.isBoard ? BOARD_PAGE : pagination, debouncedSearchQuery, activeTab, filters });

  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, []);

  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    await deleteBulk(bulkDeleteIds);
    setIsDeletingBulk(false);
    setBulkDeleteIds(null);
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
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <IdCell href={`/projects/${row.original.id}`}>{row.original.projectCode || row.original.id}</IdCell>
      ),
    },
    {
      accessorKey: "name",
      header: "Project",
      cell: ({ row }) => {
        const name = row.original.name || "—";
        return <NameCell name={name} avatar sub={row.original.city} className="max-w-[260px]" />;
      },
    },
    {
      accessorKey: "projectType",
      header: "Type",
      cell: ({ row }) => {
        return <span className="capitalize">{row.original.projectType || "—"}</span>;
      },
    },
    {
      id: "priceRange",
      header: "Price Range",
      cell: ({ row }) => {
        const r = computeProjectRanges(row.original.units);
        return <span className="whitespace-nowrap tabular-nums">{formatPriceRange(r.minPrice, r.maxPrice)}</span>;
      },
    },
    {
      id: "bhk",
      header: "BHK",
      cell: ({ row }) => {
        const r = computeProjectRanges(row.original.units);
        return <span className="whitespace-nowrap">{r.bhk.length ? `${r.bhk.join(",")} BHK` : "—"}</span>;
      },
    },
    {
      id: "units",
      header: "Units",
      cell: ({ row }) => {
        const count = (row.original.units ?? []).length;
        return <span className="tabular-nums">{count}</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = (row.original.status || "").toLowerCase();
        return <span className="capitalize"><StatusCell status={s} /></span>;
      },
    },
  ];

  const tableProps = {
    flush: true as const,
    columns,
    data: projects,
    showToolbar: true,
    showDeleteAction: isAdmin({ role }),
    onDeleteSelected: (rows: any[]) => setBulkDeleteIds(rows.map((r) => r.id)),
    renderToolbarActions: (selectedRows: any[], clearSelection: () => void) => {
      const isSingle = selectedRows.length === 1;
      const row = selectedRows[0];
      return (
        <>
          {isSingle && (
            <>
              <Button variant="outline" size="sm" onClick={() => router.push(`/projects/${row.id}`)}>
                <Eye className="h-3.5 w-3.5 mr-1.5" /> View
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push(`/projects/new?edit=${row.id}`)}>
                <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
            </>
          )}
        </>
      );
    },
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pagination.pageSize),
    totalCount,
    pagination,
    onPaginationChange: setPagination,
  };

  const activeFiltersCount =
    (filters.projectType ? 1 : 0) +
    (filters.minPrice !== "" || filters.maxPrice !== "" ? 1 : 0) +
    (filters.bhk.length > 0 ? 1 : 0) +
    (filters.locality.trim() ? 1 : 0) +
    (filters.minUnits !== "" ? 1 : 0);
  const clearFilters = () => {
    setFilters({ projectType: "", minPrice: "", maxPrice: "", bhk: [], locality: "", minUnits: "" });
    resetPage();
  };
  const setBhkFilter = (v: string) => {
    setFilters((f) => ({ ...f, bhk: v ? [Number(v)] : [] }));
    resetPage();
  };

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
      <PopoverContent align="start" className="w-80 p-0 rounded-2xl shadow-xl overflow-hidden border-border/60">
        <div className="flex items-center justify-between p-4 border-b bg-muted/10">
          <h4 className="font-semibold text-foreground text-sm">Filter Projects</h4>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground hover:text-red-600">
              Clear All
            </Button>
          )}
        </div>
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Project Type</label>
            <FormSelect name="projectType" options={PROJECT_TYPE_OPTIONS} value={filters.projectType} onValueChange={(v) => { setFilters((f) => ({ ...f, projectType: v || "" })); resetPage(); }} placeholder="All Types" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Price Range (₹)</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => { setFilters((f) => ({ ...f, minPrice: e.target.value })); resetPage(); }}
                className="h-10 rounded-xl bg-muted/30 border-border/60 text-[13.5px]"
              />
              <span className="text-muted-foreground shrink-0">–</span>
              <Input
                type="number"
                min={0}
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => { setFilters((f) => ({ ...f, maxPrice: e.target.value })); resetPage(); }}
                className="h-10 rounded-xl bg-muted/30 border-border/60 text-[13.5px]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">BHK</label>
            <FormSelect name="bhk" options={BHK_FILTER_OPTIONS} value={filters.bhk[0] != null ? String(filters.bhk[0]) : ""} onValueChange={(v) => setBhkFilter(v || "")} placeholder="All BHK" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Locality</label>
            <FormSelect name="locality" options={localityOptions} value={filters.locality} onValueChange={(v) => { setFilters((f) => ({ ...f, locality: v || "" })); resetPage(); }} placeholder="All Localities" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Units</label>
            <FormSelect name="minUnits" options={UNITS_FILTER_OPTIONS} value={filters.minUnits} onValueChange={(v) => { setFilters((f) => ({ ...f, minUnits: v || "" })); resetPage(); }} placeholder="Any" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const searchBar = (isMobile: boolean) => (
    <div className="relative flex-1">
      <Search className={isMobile ? "absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground" : "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"} />
      <Input
        placeholder={isMobile ? "Search projects..." : "Search name, builder, city..."}
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }}
        className={isMobile
          ? "pl-10 h-10 bg-foreground/[0.06] border-transparent rounded-[11px] text-[16px] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[#017D58]/30 shadow-none"
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
            onClick={() => { setActiveTab(tab); resetPage(); }}
            className={cn(
              "px-3.5 h-8 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors active:opacity-60",
              isActive ? "bg-[#017D58] text-white dark:bg-[#2FB585] dark:text-black" : "bg-foreground/[0.06] text-foreground"
            )}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );

  type Row = (typeof projects)[number];
  const rowCard = (p: Row) => ({
    title: p.name,
    id: p.projectCode || p.id,
    href: `/projects/${p.id}`,
    subtitle: [p.city, formatPriceRange(computeProjectRanges(p.units).minPrice, computeProjectRanges(p.units).maxPrice)].filter((x) => x && x !== "—").join(" · "),
    tag: p.projectType,
  });
  const openRow = (p: Row) => router.push(`/projects/${p.id}`);

  const tableSection = (
    <div className="w-full max-w-full min-w-0 md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col">
      {isLoading ? <TableSkeleton columns={8} rows={10} flush /> : <DataTable {...tableProps} />}
    </div>
  );

  const desktopFilters = (
    <ListFrame>
      <ListToolbar className="md:flex-nowrap">
        <SegmentTabs tabs={tabs} value={activeTab} onChange={(tab) => { setActiveTab(tab); resetPage(); }} label="Projects views" />
        <FilterDivider />
        <FilterStrip>
          <QuickFilter label="Project type" value={filters.projectType} options={PROJECT_TYPE_OPTIONS} onChange={(v) => { setFilters((f) => ({ ...f, projectType: v })); resetPage(); }} />
          <QuickFilter label="Locality" value={filters.locality} options={localityOptions} onChange={(v) => { setFilters((f) => ({ ...f, locality: v })); resetPage(); }} />
          <QuickFilter label="BHK" value={filters.bhk[0] != null ? String(filters.bhk[0]) : ""} options={BHK_FILTER_OPTIONS} onChange={(v) => setBhkFilter(v)} />
          <RangeQuickFilter label="Price" unit="₹" min={filters.minPrice} max={filters.maxPrice} onChange={(minPrice, maxPrice) => { setFilters((f) => ({ ...f, minPrice, maxPrice })); resetPage(); }} />
          <QuickFilter label="Units" value={filters.minUnits} options={UNITS_FILTER_OPTIONS} onChange={(v) => { setFilters((f) => ({ ...f, minUnits: v })); resetPage(); }} />
          <ClearFilters show={activeFiltersCount > 0 || !!searchQuery} onClick={() => { setSearchQuery(""); clearFilters(); }} />
        </FilterStrip>
        <ToolbarEnd>
          {views.picker}
          <ToolbarSearch value={searchQuery} onChange={(v) => { setSearchQuery(v); resetPage(); }} placeholder="Search name, builder, city" className="md:[&_input]:w-56" />
        </ToolbarEnd>
      </ListToolbar>
      <ListBody>
        {isLoading ? <TableSkeleton columns={8} rows={10} flush /> : (
          <ModuleViews
            state={views}
            data={projects}
            columns={columns}
            list={<DataTable {...tableProps} variant="list" />}
            getKey={(p) => p.id}
            onOpen={openRow}
            onMove={(p, status) =>
              moveRow({ setRows: setProjects, row: p, same: (a, b) => a.id === b.id, patch: { status }, request: { path: `/projects/${p.id}/status`, method: "PATCH", body: { status } }, success: `Moved to ${status.charAt(0).toUpperCase()}${status.slice(1)}` })
            }
            card={rowCard}
            totalCount={totalCount}
            noun="projects"
          />
        )}
      </ListBody>
    </ListFrame>
  );

  const mobileFilters = (
    <div className="px-4 pb-2 space-y-3">
      <div className="flex items-center gap-2">
        {searchBar(true)}
        {renderFilterPopover(true)}
      </div>
      {pillTabs}
    </div>
  );

  return (
    <>
      <MobileHeader title="Projects" />
      {views.switcher}
      <div className="w-full flex flex-col space-y-6 pt-4 md:space-y-0 md:pt-0 md:h-full">
        <PageActions>
          <button type="button" onClick={() => setCreating(true)} className={headerPrimaryClass}>
            <Plus className="size-4" />
            Add Project
          </button>
        </PageActions>

        <Device mobile={mobileFilters} desktop={desktopFilters} />
        <Device
          desktop={null}
          mobile={
            <ModuleMobileRows state={views} card={rowCard} onOpen={openRow}>
              <div className="w-full">{tableSection}</div>
            </ModuleMobileRows>
          }
        />

      </div>

      <Dialog open={bulkDeleteIds !== null} onOpenChange={(open) => { if (!open) setBulkDeleteIds(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Project{bulkDeleteIds && bulkDeleteIds.length > 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} project${bulkDeleteIds.length > 1 ? "s" : ""}` : "this project"}? This action cannot be undone.
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
      {creating && (
        <ProjectForm mode="create" onClose={() => setCreating(false)} onSuccess={() => { setCreating(false); reloadProjects(); }} />
      )}
    </>
  );
}
