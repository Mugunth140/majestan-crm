"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { propertiesApi } from "@/lib/properties-api";
import { BulkImportDialog } from "./_components/BulkImportDialog";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { Edit, Eye, Filter, Plus, RefreshCw, Search, Upload, X } from "lucide-react";

const PROPERTY_TYPE_OPTIONS = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
  { value: "commercial", label: "Commercial Space" },
  { value: "coworking", label: "Co-working" },
  { value: "farmland", label: "Farmland" },
  { value: "industrial", label: "Industrial" },
  { value: "individual_portion", label: "Independent House" },
];

const STATUS_STYLES: Record<string, string> = {
  available: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  unavailable: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  sold: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400",
  rented: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
};

function formatPrice(price: number): string {
  if (!price) return "-";
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
  return `₹${price.toLocaleString("en-IN")}`;
}

export default function PropertiesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Available");
  const [properties, setProperties] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [filters, setFilters] = useState({ propertyType: "", listingType: "", cityId: "" });
  const [cities, setCities] = useState<{ id: number; cityName: string }[]>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [role, setRole] = useState("");

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
      setRole(user?.role?.name || user?.role || "");
    } catch { /* ignore */ }
    propertiesApi.formData()
      .then((res) => {
        const list = res?.data?.cities ?? res?.cities ?? [];
        setCities(list.map((c: any) => ({ id: c.id, cityName: c.cityName ?? c.city_name ?? "" })));
      })
      .catch(() => { /* city filter stays empty */ });
  }, []);

  const tabs = ["Available", "Archived"];

  const fetchProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      };
      if (debouncedSearchQuery.trim()) params.search = debouncedSearchQuery.trim();
      params.status = activeTab === "Archived" ? "archived" : "available";
      if (filters.propertyType) params.propertyType = filters.propertyType;
      if (filters.listingType) params.listingType = filters.listingType;
      if (filters.cityId) params.cityId = filters.cityId;
      const data = await propertiesApi.list(params);
      if (data && data.success !== false) {
        setProperties(data.data ?? []);
        setTotalCount(data.meta?.total ?? 0);
      } else {
        setProperties([]);
        setTotalCount(0);
      }
    } catch {
      toast.error("Failed to load properties.");
      setProperties([]);
    } finally {
      setIsLoading(false);
    }
  }, [pagination, debouncedSearchQuery, activeTab, filters]);

  useEffect(() => {
    fetchProperties();
    window.scrollTo(0, 0);
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, [fetchProperties]);

  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const results = await Promise.all(
        bulkDeleteIds.map((id) =>
          propertiesApi.remove(id).then(() => true).catch(() => false)
        )
      );
      const failed = results.filter((r) => !r).length;
      const ok = results.filter((r) => r).length;
      if (failed > 0) toast.error(`Failed to delete ${failed} properties`);
      if (ok > 0) {
        toast.success(`${ok} propert${ok === 1 ? "y" : "ies"} deleted successfully`);
        setProperties((prev) => prev.filter((p) => !bulkDeleteIds.includes(p.id)));
      }
    } catch {
      toast.error("Failed to delete properties");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
    }
  };

  const handleToggleVisibility = async (id: number) => {
    setIsToggling(true);
    try {
      await propertiesApi.toggleVisibility(id);
      toast.success("Visibility updated.");
      fetchProperties();
    } catch {
      toast.error("Failed to toggle visibility.");
    } finally {
      setIsToggling(false);
    }
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
        <Link href={`/properties/${row.original.id}`} className="text-[#0052FF] hover:underline font-medium">
          #{row.original.id}
        </Link>
      ),
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => {
        const title = row.original.title || "-";
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-xs text-blue-900 dark:text-blue-300 shrink-0">
              {title.charAt(0).toUpperCase()}
            </div>
            <Link href={`/properties/${row.original.id}`} className="font-medium text-foreground hover:text-[#0052FF] hover:underline truncate max-w-[220px]" title={title}>
              {title}
            </Link>
          </div>
        );
      },
    },
    {
      accessorKey: "propertyCode",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.propertyCode || "-"}</span>
      ),
    },
    {
      accessorKey: "propertyType",
      header: "Type",
      cell: ({ row }) => (
        <span className="capitalize">{row.original.propertyType?.replace(/_/g, " ") || "-"}</span>
      ),
    },
    {
      accessorKey: "listingType",
      header: "Listing",
      cell: ({ row }) =>
        row.original.listingType === "Rent" ? (
          <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 font-medium shadow-sm border">Rent</Badge>
        ) : (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 font-medium shadow-sm border">Buy</Badge>
        ),
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => <span className="font-semibold">{formatPrice(Number(row.original.price))}</span>,
    },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => {
        const city = row.original.cityName || row.original.city || "-";
        const locality = row.original.localityName;
        return (
          <div className="min-w-0">
            <div className="font-medium text-foreground text-sm truncate">{city}</div>
            {locality && <div className="text-xs text-muted-foreground truncate">{locality}</div>}
          </div>
        );
      },
    },
    {
      id: "owner",
      header: "Owner",
      cell: ({ row }) =>
        row.original.ownerName || row.original.ownerPhone ? (
          <div className="min-w-0">
            {row.original.ownerName && <div className="font-medium text-foreground text-sm truncate">{row.original.ownerName}</div>}
            {row.original.ownerPhone && <div className="text-xs text-muted-foreground">{row.original.ownerPhone}</div>}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
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
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("en-GB") : "-"}
        </span>
      ),
    },
  ];

  const tableProps = {
    flush: true as const,
    columns,
    data: properties,
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
              <Button variant="outline" size="sm" onClick={() => router.push(`/properties/${row.id}`)}>
                <Eye className="h-3.5 w-3.5 mr-1.5" /> View
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push(`/properties/new?edit=${row.id}`)}>
                <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isToggling}
                onClick={async () => {
                  await handleToggleVisibility(row.id);
                  clearSelection();
                }}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Toggle Visibility
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

  const activeFiltersCount = Object.values(filters).filter((v) => v !== "").length;
  const clearFilters = () => {
    setFilters({ propertyType: "", listingType: "", cityId: "" });
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
          <h4 className="font-semibold text-foreground text-sm">Filter Properties</h4>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground hover:text-red-600">
              Clear All
            </Button>
          )}
        </div>
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Property Type</label>
            <FormSelect name="propertyType" options={PROPERTY_TYPE_OPTIONS} value={filters.propertyType} onValueChange={(v) => { setFilters((f) => ({ ...f, propertyType: v || "" })); resetPage(); }} placeholder="All Types" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Listing Type</label>
            <FormSelect name="listingType" options={[{ label: "Buy", value: "Sell" }, { label: "Rent", value: "Rent" }]} value={filters.listingType} onValueChange={(v) => { setFilters((f) => ({ ...f, listingType: v || "" })); resetPage(); }} placeholder="All Listings" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">City</label>
            <FormSelect name="cityId" options={cities.map((c) => ({ label: c.cityName, value: String(c.id) }))} value={filters.cityId} onValueChange={(v) => { setFilters((f) => ({ ...f, cityId: v || "" })); resetPage(); }} placeholder="All Cities" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const searchBar = (isMobile: boolean) => (
    <div className="relative flex-1">
      <Search className={isMobile ? "absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" : "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"} />
      <Input
        placeholder={isMobile ? "Search properties..." : "Search title, code, owner, city..."}
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
    <div className="w-full md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col">
      {isLoading ? <TableSkeleton /> : <DataTable {...tableProps} />}
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

      <div className="w-full md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col">{tableSection}</div>
    </div>
  );

  const mobileFilters = (
    <div className="px-4 pb-2 space-y-4">
      <div className="flex items-center gap-2">
        {searchBar(true)}
        {renderFilterPopover(true)}
      </div>
      {pillTabs}
    </div>
  );

  return (
    <>
      <MobileHeader title="Properties" />
      <div className="w-full flex flex-col space-y-6 pt-4 lg:p-0 md:h-full">
        <Device
          mobile={null}
          desktop={
            <div className="flex h-[48px] items-center justify-between pr-[150px]">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight">Properties</h1>
                <p className="text-muted-foreground text-sm mt-0.5">Manage your property listings</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border/60" onClick={fetchProperties} title="Refresh">
                  <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                </Button>
                <Button variant="outline" className="h-11 rounded-full border-border/60 px-5 text-[14px] font-medium flex items-center gap-2" onClick={() => setIsBulkImportOpen(true)}>
                  <Upload className="h-4 w-4" />
                  Bulk Import
                </Button>
                <Link href="/properties/new" className="inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95">
                  <Plus size={18} />
                  Add Property
                </Link>
              </div>
            </div>
          }
        />

        <Device mobile={mobileFilters} desktop={desktopFilters} />
        <Device desktop={null} mobile={<div className="w-full px-4 md:px-0">{tableSection}</div>} />

        <BulkImportDialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen} onSuccess={fetchProperties} />
      </div>

      <Dialog open={bulkDeleteIds !== null} onOpenChange={(open) => { if (!open) setBulkDeleteIds(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Propert{bulkDeleteIds && bulkDeleteIds.length > 1 ? "ies" : "y"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} propert${bulkDeleteIds.length > 1 ? "ies" : "y"}` : "this property"}? This action cannot be undone.
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
