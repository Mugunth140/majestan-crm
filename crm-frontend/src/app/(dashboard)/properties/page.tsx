"use client";

import { PropertyForm } from "./_components/PropertyForm";
import { propertyTypeName } from "./_components/property-form-fields";
import { EMPTY_PROPERTY_FILTERS, propertyUploaderLabel } from "@/lib/property-list-filters";
import { propertyStatusLabel } from "@/lib/property-status";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/tables/data-table";
import { BOARD_PAGE, ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { DateCell, IdCell, NameCell, StatusCell, statusDot, statusTone, type StatusTone } from "@/components/tables/cells";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ListBody, ListFrame, ListToolbar, SegmentTabs, ToolbarEnd, ToolbarSearch, headerPrimaryClass, toolbarFilterButton } from "@/components/layout/list-page";
import { ClearFilters, DateQuickFilter, FilterDivider, FilterStrip, QuickFilter, RangeQuickFilter, TextQuickFilter } from "@/components/shared/quick-filters";
import { PageActions } from "@/components/layout/page-actions";
import { Device } from "@/components/shared/device";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useClampedPage, usePersistedState } from "@/hooks/use-persisted-state";
import { propertiesApi } from "@/lib/properties-api";
import { PROPERTY_TABS } from "@/lib/property-tabs";
import { usePropertiesList } from "@/hooks/use-properties-list";
import { canViewPropertyContacts, isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Check, Edit, Eye, Filter, Lock, Plus, RefreshCw, Search, X } from "lucide-react";

const PROPERTY_TYPE_OPTIONS = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
  { value: "commercial", label: "Commercial" },
  { value: "coworking", label: "Coworking" },
  { value: "farmland", label: "Farmland" },
  { value: "industrial", label: "Industrial" },
  { value: "individual_portion", label: "Independent House" },
  { value: "investment_property", label: "Investment Property" },
  { value: "farm_house", label: "Farm House" },
  { value: "pg_service_apartment", label: "PG / Service Apartment" },
];

const PROPERTY_TONES: Record<string, StatusTone> = {
  available: "green",
  rented: "blue",
  sold: "violet",
  archived: "gray",
  "pending review": "amber",
};

function formatPrice(price: number): string {
  if (!price) return "—";
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
  return `₹${price.toLocaleString("en-IN")}`;
}

const PROPERTY_FIELDS: ViewField[] = [
  { id: "status", label: "Status", get: (p) => propertyStatusLabel(p.status, p.approvalStatus), order: ["available", "Pending review", "rented", "sold", "Archived"], dot: (v) => statusDot(v, PROPERTY_TONES[v.toLowerCase()]), capitalize: true },
  { id: "propertyType", label: "Type", get: (p) => p.propertyType?.replace(/_/g, " "), capitalize: true },
  { id: "listingType", label: "Listing", get: (p) => (p.listingType === "Rent" ? "Rent" : "Buy") },
  { id: "locality", label: "Locality", get: (p) => p.localityName },
  { id: "approval", label: "Approval", get: (p) => p.approvalStatus || "Pending", dot: (v) => statusDot(v), capitalize: true },
];

export default function PropertiesPage() {
  const router = useRouter();
  const views = useModuleView("properties", PROPERTY_FIELDS);
  const [activeTab, setActiveTab] = usePersistedState<string>("properties:tab", "Available", { allowed: PROPERTY_TABS });
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const [searchQuery, setSearchQuery] = usePersistedState("properties:search", "");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [filters, setFilters] = usePersistedState("properties:filters", EMPTY_PROPERTY_FILTERS);
  const [pagination, setPagination] = usePersistedState("properties:page:v2", { pageIndex: 0, pageSize: 20 });
  const [role, setRole] = useState("");

  const { properties, totalCount, isLoading, staff, cities, sublocations, roadNames, propertyTypes, fetchProperties, toggleVisibility, deleteBulk } = usePropertiesList();
  const [creating, setCreating] = useState(false);
  useClampedPage(pagination, setPagination, totalCount, isLoading);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
      setRole(user?.role?.name || user?.role || "");
    } catch { /* ignore */ }
  }, []);

  const tabs = PROPERTY_TABS;
  const isReviewQueue = activeTab === "Review Queue";
  const canApprove = ["Admin", "Super Admin", "Manager"].includes(role);

  useEffect(() => {
    fetchProperties({ pagination: views.isBoard ? BOARD_PAGE : pagination, debouncedSearchQuery, activeTab, filters });
  }, [fetchProperties, pagination, debouncedSearchQuery, activeTab, filters, views.isBoard]);
  const reloadProperties = () => fetchProperties({ pagination: views.isBoard ? BOARD_PAGE : pagination, debouncedSearchQuery, activeTab, filters });

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

  const handleToggleVisibility = async (id: number) => {
    setIsToggling(true);
    const success = await toggleVisibility(id);
    if (success) {
      fetchProperties({ pagination, debouncedSearchQuery, activeTab, filters });
    }
    setIsToggling(false);
  };

  const handleApprove = async (id: number) => {
    setIsToggling(true);
    try {
      await propertiesApi.approve(id);
      toast.success("Property approved and moved to Available.");
      // Reset pagination if the last row on a later queue page was approved.
      if (pagination.pageIndex > 0 && properties.length === 1) resetPage();
      else await fetchProperties({ pagination, debouncedSearchQuery, activeTab, filters });
    } catch {
      toast.error("Failed to approve property.");
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
      header: "ID",
      cell: ({ row }) => (
        <IdCell href={`/properties/${row.original.id}`}>{row.original.propertyCode || row.original.id}</IdCell>
      ),
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => {
        const title = row.original.title || "—";
        return <NameCell name={title} avatar className="max-w-[260px]" />;
      },
    },
    {
      accessorKey: "propertyType",
      header: "Type",
      cell: ({ row }) => (
        <span className="capitalize">{row.original.propertyType?.replace(/_/g, " ") || "—"}</span>
      ),
    },
    {
      accessorKey: "listingType",
      header: "Listing",
      cell: ({ row }) => <span>{row.original.listingType === "Rent" ? "Rent" : "Buy"}</span>,
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatPrice(Number(row.original.price))}</span>,
    },
    {
      id: "locality",
      header: "Locality",
      cell: ({ row }) => {
        const locality = row.original.localityName || "—";
        return (
          <span className="block truncate">{locality}</span>
        );
      },
    },
    {
      id: "owner",
      header: "Owner",
      cell: ({ row }) => {
        if (!canViewPropertyContacts()) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Restricted
            </span>
          );
        }
        return row.original.ownerName || row.original.ownerPhone ? (
          <div className="min-w-0">
            {row.original.ownerName && <div className="truncate">{row.original.ownerName}</div>}
            {row.original.ownerPhone && <div className="text-[12px] tabular-nums text-muted-foreground">{row.original.ownerPhone}</div>}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const label = propertyStatusLabel(row.original.status, row.original.approvalStatus);
        return <span className="capitalize"><StatusCell status={label} tone={PROPERTY_TONES[label.toLowerCase()] ?? statusTone(label)} /></span>;
      },
    },
    {
      id: "approval",
      header: "Approval",
      cell: ({ row }) => {
        const a = (row.original.approvalStatus || "Pending").toLowerCase();
        return <span className="capitalize"><StatusCell status={a} /></span>;
      },
    },
    {
      id: "uploadedBy",
      header: "Uploaded by",
      cell: ({ row }) => <span className="whitespace-nowrap">{propertyUploaderLabel(row.original)}</span>,
    },
    {
      accessorKey: "createdAt",
      header: "Uploaded on",
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
    },
  ];

  const tableProps = {
    flush: true as const,
    columns,
    data: properties,
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
              <Button variant="outline" size="sm" onClick={() => router.push(`/properties/${row.id}`)}>
                <Eye className="h-3.5 w-3.5 mr-1.5" /> View
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push(`/properties/new?edit=${row.id}`)}>
                <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
              {canApprove && <Button
                variant={isReviewQueue ? "default" : "outline"}
                size="sm"
                disabled={isToggling}
                onClick={async () => {
                  if (isReviewQueue) await handleApprove(row.id);
                  else await handleToggleVisibility(row.id);
                  clearSelection();
                }}
              >
                {isReviewQueue ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                {isToggling ? "Updating…" : isReviewQueue ? "Approve & Publish" : "Toggle Visibility"}
              </Button>}
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

  const activeFiltersCount = Object.values(filters).filter((v) => v !== "").length;
  const clearFilters = () => {
    setFilters(EMPTY_PROPERTY_FILTERS);
    resetPage();
  };

  const renderFilterPopover = (isMobile: boolean) => (
    <Popover>
      <PopoverTrigger render={
        isMobile ? (
          <Button aria-label="Filters" variant="outline" size="icon" className="h-10 w-10 rounded-[11px] bg-foreground/[0.06] border-transparent relative shrink-0">
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
          <h4 className="font-semibold text-foreground text-sm">Filter Properties</h4>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground hover:text-red-600">
              Clear All
            </Button>
          )}
        </div>
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground" htmlFor={`uploaded-by-${isMobile ? 'mobile' : 'desktop'}`}>Uploaded by</label>
            <FormSelect id={`uploaded-by-${isMobile ? 'mobile' : 'desktop'}`} name="uploadedById" options={staff.map(user => ({label: `${user.name}${user.isActive ? '' : ' (Inactive)'}`, value: String(user.id)}))}
              value={filters.uploadedById} onValueChange={value => { setFilters(f => ({...f, uploadedById: value || ""})); resetPage(); }} placeholder="All staff" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground" htmlFor={`uploaded-from-${isMobile ? 'mobile' : 'desktop'}`}>Uploaded from</label>
              <Input id={`uploaded-from-${isMobile ? 'mobile' : 'desktop'}`} type="date" value={filters.uploadedFrom} max={filters.uploadedTo || undefined} onChange={event => { const value=event.target.value; setFilters(f => ({...f, uploadedFrom:value, uploadedTo: value && f.uploadedTo && f.uploadedTo < value ? value : f.uploadedTo})); resetPage(); }} /></div>
            <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground" htmlFor={`uploaded-to-${isMobile ? 'mobile' : 'desktop'}`}>Uploaded to</label>
              <Input id={`uploaded-to-${isMobile ? 'mobile' : 'desktop'}`} type="date" value={filters.uploadedTo} min={filters.uploadedFrom || undefined} onChange={event => { const value=event.target.value; setFilters(f => ({...f, uploadedTo:value, uploadedFrom: value && f.uploadedFrom && f.uploadedFrom > value ? value : f.uploadedFrom})); resetPage(); }} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Includes both dates, using India time.</p>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Location</label>
            <FormSelect name="sublocationId" options={sublocations.filter(item => !filters.cityId || String(item.cityId) === filters.cityId).map(item => ({label: item.name, value: String(item.id)}))}
              value={filters.sublocationId} onValueChange={value => { setFilters(f => ({...f, sublocationId: value || ""})); resetPage(); }} placeholder="All locations" />
          </div>
          {[
            { label: "Sq.ft", min: "minSqft", max: "maxSqft" },
            { label: "Budget (₹)", min: "minBudget", max: "maxBudget" },
          ].map(range => <div key={range.min} className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">{range.label}</label>
            <div className="grid grid-cols-2 gap-2">
              {[range.min, range.max].map((key, index) => <Input key={key} type="number" min="0" step="any" aria-label={`${range.label} ${index ? "maximum" : "minimum"}`}
                placeholder={index ? "Maximum" : "Minimum"} value={filters[key as keyof typeof filters]}
                onChange={event => { setFilters(f => ({...f, [key]: event.target.value})); resetPage(); }} />)}
            </div>
          </div>)}
          {[
            { key: "floor", label: "Floor", placeholder: "e.g. Ground, 1, 2" },
            { key: "specialPurpose", label: "Special purpose", placeholder: "e.g. Office, showroom" },
          ].map(field => <div key={field.key} className="space-y-1.5">
            <label htmlFor={`filter-${field.key}`} className="text-xs font-bold text-muted-foreground">{field.label}</label>
            <Input id={`filter-${field.key}`} value={filters[field.key as keyof typeof filters]} placeholder={field.placeholder}
              onChange={event => { setFilters(f => ({...f, [field.key]: event.target.value})); resetPage(); }} />
          </div>)}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Furnishing status</label>
            <FormSelect name="furnishingStatus" options={[{label:"Bareshell",value:"BARESHELL"},{label:"Fully furnished",value:"FULLY FURNISHED"},{label:"Semi furnished",value:"SEMI FURNISHED"},{label:"Unfurnished",value:"UNFURNISHED"}]}
              value={filters.furnishingStatus} onValueChange={value => { setFilters(f => ({...f, furnishingStatus:value || ""})); resetPage(); }} placeholder="Any furnishing" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Road Name</label>
            <FormSelect name="roadName" options={roadNames} value={filters.roadName}
              onValueChange={value => { setFilters(f => ({...f, roadName:value || ""})); resetPage(); }} placeholder="All roads" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Property Type</label>
            <FormSelect name="propertyType" options={propertyTypes.length ? propertyTypes.map((t) => ({ ...t, label: propertyTypeName(t.value, t.label) })) : PROPERTY_TYPE_OPTIONS} value={filters.propertyType} onValueChange={(v) => { setFilters((f) => ({ ...f, propertyType: v || "" })); resetPage(); }} placeholder="All Types" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Listing Type</label>
            <FormSelect name="listingType" options={[{ label: "Buy", value: "Sell" }, { label: "Rent", value: "Rent" }]} value={filters.listingType} onValueChange={(v) => { setFilters((f) => ({ ...f, listingType: v || "" })); resetPage(); }} placeholder="All Listings" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">City</label>
            <FormSelect name="cityId" options={cities.map((c) => ({ label: c.cityName, value: String(c.id) }))} value={filters.cityId} onValueChange={(v) => { setFilters((f) => ({ ...f, cityId: v || "", sublocationId: "" })); resetPage(); }} placeholder="All Cities" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const searchBar = (isMobile: boolean) => (
    <div className="relative flex-1">
      <Search className={isMobile ? "absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground" : "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"} />
      <Input
        placeholder={isMobile ? "Search properties..." : "Search title, code, owner, city..."}
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
            aria-pressed={activeTab === tab}
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

  const tableSection = (
    <div className="w-full max-w-full min-w-0 md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col">
      {isLoading ? <TableSkeleton columns={12} rows={10} flush /> : <DataTable key={activeTab} {...tableProps} />}
    </div>
  );

  const desktopFilters = (
    <ListFrame>
      <ListToolbar className="md:flex-nowrap">
        <SegmentTabs tabs={tabs} value={activeTab} onChange={(tab) => { setActiveTab(tab); resetPage(); }} label="Properties views" />
        <FilterDivider />
        <FilterStrip>
          <QuickFilter label="Listing" value={filters.listingType} options={[{ label: "Buy", value: "Sell" }, { label: "Rent", value: "Rent" }]} onChange={(v) => { setFilters((f) => ({ ...f, listingType: v })); resetPage(); }} />
          <QuickFilter label="Property type" value={filters.propertyType} options={propertyTypes.length ? propertyTypes.map((t) => ({ ...t, label: propertyTypeName(t.value, t.label) })) : PROPERTY_TYPE_OPTIONS} onChange={(v) => { setFilters((f) => ({ ...f, propertyType: v })); resetPage(); }} />
          <QuickFilter label="City" value={filters.cityId} options={cities.map((c) => ({ label: c.cityName, value: String(c.id) }))} onChange={(v) => { setFilters((f) => ({ ...f, cityId: v, sublocationId: "" })); resetPage(); }} />
          <QuickFilter label="Location" value={filters.sublocationId} options={sublocations.filter((item) => !filters.cityId || String(item.cityId) === filters.cityId).map((item) => ({ label: item.name, value: String(item.id) }))} onChange={(v) => { setFilters((f) => ({ ...f, sublocationId: v })); resetPage(); }} />
          <QuickFilter label="Road" value={filters.roadName} options={roadNames} onChange={(v) => { setFilters((f) => ({ ...f, roadName: v })); resetPage(); }} />
          <RangeQuickFilter label="Budget" unit="₹" min={filters.minBudget} max={filters.maxBudget} onChange={(minBudget, maxBudget) => { setFilters((f) => ({ ...f, minBudget, maxBudget })); resetPage(); }} />
          <RangeQuickFilter label="Area" unit="sq.ft" min={filters.minSqft} max={filters.maxSqft} onChange={(minSqft, maxSqft) => { setFilters((f) => ({ ...f, minSqft, maxSqft })); resetPage(); }} />
          <QuickFilter label="Furnishing" value={filters.furnishingStatus} options={[{ label: "Bareshell", value: "BARESHELL" }, { label: "Fully furnished", value: "FULLY FURNISHED" }, { label: "Semi furnished", value: "SEMI FURNISHED" }, { label: "Unfurnished", value: "UNFURNISHED" }]} onChange={(v) => { setFilters((f) => ({ ...f, furnishingStatus: v })); resetPage(); }} />
          <TextQuickFilter label="Floor" value={filters.floor} placeholder="e.g. Ground, 1, 2" onChange={(v) => { setFilters((f) => ({ ...f, floor: v })); resetPage(); }} />
          <TextQuickFilter label="Special purpose" value={filters.specialPurpose} placeholder="e.g. Office, showroom" onChange={(v) => { setFilters((f) => ({ ...f, specialPurpose: v })); resetPage(); }} />
          <QuickFilter label="Uploaded by" value={filters.uploadedById} options={staff.map((user) => ({ label: `${user.name}${user.isActive ? "" : " (Inactive)"}`, value: String(user.id) }))} onChange={(v) => { setFilters((f) => ({ ...f, uploadedById: v })); resetPage(); }} />
          <DateQuickFilter label="Uploaded" from={filters.uploadedFrom} to={filters.uploadedTo} onChange={(uploadedFrom, uploadedTo) => { setFilters((f) => ({ ...f, uploadedFrom, uploadedTo })); resetPage(); }} />
          <ClearFilters show={activeFiltersCount > 0 || !!searchQuery} onClick={() => { setSearchQuery(""); clearFilters(); }} />
        </FilterStrip>
        <ToolbarEnd>
          {views.picker}
          <ToolbarSearch value={searchQuery} onChange={(v) => { setSearchQuery(v); resetPage(); }} placeholder="Search title, code, owner, city" className="md:[&_input]:w-56" />
        </ToolbarEnd>
      </ListToolbar>
      <ListBody>
        {isLoading ? <TableSkeleton columns={12} rows={10} flush /> : <ModuleViews
          state={views}
          data={properties}
          columns={columns}
          list={
            <DataTable key={activeTab} {...tableProps} variant="list" />
          }
          getKey={(p) => p.id}
          onOpen={(p) => router.push(`/properties/${p.id}`)}
          card={(p) => ({ title: p.title, id: p.propertyCode || p.id, href: `/properties/${p.id}`, subtitle: [p.localityName, Number(p.price) ? formatPrice(Number(p.price)) : ""].filter(Boolean).join(" · "), footer: propertyUploaderLabel(p), tag: p.propertyType?.replace(/_/g, " ") })}
          totalCount={totalCount}
          noun="properties"
        />}
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
      <MobileHeader title="Properties" />
      {views.switcher}
      <div className="w-full flex flex-col space-y-6 pt-4 md:space-y-0 md:pt-0 md:h-full">
        <PageActions>
          <button type="button" onClick={() => setCreating(true)} className={headerPrimaryClass}>
            <Plus className="size-4" />
            Add Property
          </button>
        </PageActions>

        <Device mobile={mobileFilters} desktop={desktopFilters} />
        <Device desktop={null} mobile={<div className="w-full">{tableSection}</div>} />

      </div>
      {creating && (
        <PropertyForm mode="create" onClose={() => setCreating(false)} onSuccess={() => { setCreating(false); reloadProperties(); }} />
      )}

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
