"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useProjectsList } from "@/hooks/use-projects-list";
import { computeProjectRanges, formatPriceRange } from "@/lib/project-ranges";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { Edit, Eye, Filter, Plus, RefreshCw, Search, X } from "lucide-react";

const PROJECT_TYPE_OPTIONS = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
];

const BHK_FILTER_OPTIONS = [1, 2, 3, 4, 5];

const STATUS_STYLES: Record<string, string> = {
  published: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  draft: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  booked: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  archived: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400",
};

const PROJECT_TYPE_STYLES: Record<string, string> = {
  apartment: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  villa: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  plot: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export default function ProjectsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All");
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [filters, setFilters] = useState({ projectType: "", minPrice: "", maxPrice: "", bhk: [] as number[], locality: "", minUnits: "" });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [role, setRole] = useState("");

  const { projects, totalCount, isLoading, fetchProjects, deleteBulk } = useProjectsList();

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
      setRole(user?.role?.name || user?.role || "");
    } catch { /* ignore */ }
  }, []);

  const tabs = ["All", "Published", "Draft", "Booked", "Archived"];

  useEffect(() => {
    fetchProjects({ pagination, debouncedSearchQuery, activeTab, filters });
  }, [fetchProjects, pagination, debouncedSearchQuery, activeTab, filters]);

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
      header: "Id",
      cell: ({ row }) => (
        <Link href={`/projects/${row.original.id}`} className="text-[#0052FF] hover:underline font-medium font-mono text-xs tracking-wide">
          {row.original.projectCode || row.original.id}
        </Link>
      ),
    },
    {
      accessorKey: "name",
      header: "Project",
      cell: ({ row }) => {
        const name = row.original.name || "-";
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center font-bold text-xs text-rose-900 dark:text-rose-300 shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <Link href={`/projects/${row.original.id}`} className="font-medium text-foreground hover:text-[#0052FF] hover:underline truncate max-w-[220px] block" title={name}>
                {name}
              </Link>
              {row.original.city && <div className="text-xs text-muted-foreground truncate">{row.original.city}</div>}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "projectType",
      header: "Type",
      cell: ({ row }) => {
        const t = (row.original.projectType || "").toLowerCase();
        const cls = PROJECT_TYPE_STYLES[t] ?? "bg-gray-100 text-gray-800 border-gray-200";
        return (
          <Badge className={"font-medium shadow-sm border capitalize " + cls}>
            {row.original.projectType || "-"}
          </Badge>
        );
      },
    },
    {
      id: "priceRange",
      header: "Price Range",
      cell: ({ row }) => {
        const r = computeProjectRanges(row.original.units);
        return <span className="font-semibold whitespace-nowrap">{formatPriceRange(r.minPrice, r.maxPrice)}</span>;
      },
    },
    {
      id: "bhk",
      header: "BHK",
      cell: ({ row }) => {
        const r = computeProjectRanges(row.original.units);
        return <span className="whitespace-nowrap">{r.bhk.length ? `${r.bhk.join(",")} BHK` : "-"}</span>;
      },
    },
    {
      id: "units",
      header: "Units",
      cell: ({ row }) => {
        const count = (row.original.units ?? []).length;
        return <span>{count}</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = (row.original.status || "").toLowerCase();
        const cls = STATUS_STYLES[s] ?? "bg-gray-100 text-gray-800 border-gray-200";
        return <Badge className={"font-medium shadow-sm border whitespace-nowrap capitalize " + cls}>{s || "-"}</Badge>;
      },
    },
  ];

  const tableProps = {
    flush: true as const,
    columns,
    data: projects,
    showToolbar: true,
    showDeleteAction: role === "Admin",
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
  const toggleBhk = (b: number) => {
    setFilters((f) => ({ ...f, bhk: f.bhk.includes(b) ? f.bhk.filter((x) => x !== b) : [...f.bhk, b].sort((a, x) => a - x) }));
    resetPage();
  };

  const renderFilterPopover = (isMobile: boolean) => (
    <Popover>
      <PopoverTrigger render={
        isMobile ? (
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl bg-black/5 dark:bg-white/10 border-transparent relative shrink-0">
            <Filter className="h-5 w-5 text-foreground" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#0052FF] border-2 border-background text-white text-[10px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        ) : (
          <Button variant="outline" className="h-10 rounded-xl bg-muted/30 border-border/60 px-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-[13.5px]">Filters</span>
            {activeFiltersCount > 0 && (
              <Badge className="ml-1 bg-[#0052FF] text-white px-1.5 py-0.5 rounded-md text-[10px]">{activeFiltersCount}</Badge>
            )}
          </Button>
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
            <div className="flex flex-wrap gap-2">
              {BHK_FILTER_OPTIONS.map((b) => {
                const isActive = filters.bhk.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBhk(b)}
                    className={cn(
                      "h-9 min-w-9 px-3 rounded-full text-[13px] font-semibold border transition-all active:scale-95",
                      isActive ? "bg-foreground text-background border-foreground shadow-sm" : "bg-card text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Locality</label>
            <Input
              placeholder="e.g. Whitefield"
              value={filters.locality}
              onChange={(e) => { setFilters((f) => ({ ...f, locality: e.target.value })); resetPage(); }}
              className="h-10 rounded-xl bg-muted/30 border-border/60 text-[13.5px]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Units</label>
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="Min units"
              value={filters.minUnits}
              onChange={(e) => { setFilters((f) => ({ ...f, minUnits: e.target.value })); resetPage(); }}
              className="h-10 rounded-xl bg-muted/30 border-border/60 text-[13.5px]"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const searchBar = (isMobile: boolean) => (
    <div className="relative flex-1">
      <Search className={isMobile ? "absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" : "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"} />
      <Input
        placeholder={isMobile ? "Search projects..." : "Search name, builder, city..."}
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }}
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
            onClick={() => { setActiveTab(tab); resetPage(); }}
            className={cn(
              "px-5 h-10 rouTrusted and Reliable Liaisoningnded-full text-[14px] font-semibold whitespace-nowrap transition-all border active:scale-95",
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
      {isLoading ? <TableSkeleton columns={8} rows={10} flush /> : <DataTable {...tableProps} />}
    </div>
  );

  const desktopFilters = (
    <div className="bg-card border rounded-xl overflow-hidden shadow-sm md:flex md:flex-col md:flex-1 md:min-h-0">
      <div className="flex items-center justify-between px-6 border-b bg-muted/10 pt-4 gap-4">
        <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide relative">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); resetPage(); }}
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
        {renderFilterPopover(false)}
        {(searchQuery || activeFiltersCount > 0) && (
          <Button variant="ghost" size="icon" onClick={() => { setSearchQuery(""); clearFilters(); }} className="h-10 w-10 rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors" title="Clear Search & Filters">
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
        {renderFilterPopover(true)}
      </div>
      <Link href="/projects/new" className="flex h-11 w-full rounded-xl bg-[#0052FF] px-4 text-[14px] font-semibold text-white shadow-md hover:bg-[#0052FF]/90 items-center justify-center gap-2 transition-transform active:scale-95">
        <Plus size={18} />
        Add Project
      </Link>
      {pillTabs}
    </div>
  );

  return (
    <>
      <MobileHeader title="Projects" />
      <div className="w-full flex flex-col space-y-6 pt-4 lg:p-0 md:h-full">
        <Device
          mobile={null}
          desktop={
            <div className="flex h-[48px] items-center justify-between pr-[150px]">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight">Projects</h1>
                {/* <p className="text-muted-foreground text-sm mt-0.5">Manage your villa and apartment projects</p> */}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border/60" onClick={() => fetchProjects({ pagination, debouncedSearchQuery, activeTab, filters })} title="Refresh">
                  <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                </Button>
                <Link href="/projects/new" className="inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95">
                  <Plus size={18} />
                  Add Project
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
    </>
  );
}
