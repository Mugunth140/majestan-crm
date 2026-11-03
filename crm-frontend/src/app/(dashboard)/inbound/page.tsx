"use client";

import { matchesInboundActionFilter } from "@/lib/inbound-action-required";
import { inboundStatusLabel } from "@/lib/inbound-status";
import { InboundAssignmentDialog } from "@/components/inbound/inbound-assignment-dialog";
import { formatInboundCreated, matchesInboundSearch } from "@/lib/inbound-queue";
import { apiFetch, apiJson } from "@/lib/api-fetch";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { moveRow } from "@/lib/move-row";
import { DateCell, IdCell, StatusCell, statusDot, type StatusTone } from "@/components/tables/cells";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Plus, Eye, Search, Filter, X, Lock } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FormSelect } from "@/components/shared/form-select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ListFrame, ListToolbar, SegmentTabs, ToolbarEnd, ToolbarSearch, headerPrimaryClass, toolbarFilterButton } from "@/components/layout/list-page";
import { PageActions } from "@/components/layout/page-actions";
import { Device } from "@/components/shared/device";
import { cn } from "@/lib/utils";
import { canViewInboundContacts } from "@/lib/permissions";
import { ACTION_FILTERS, getActionFilterLabel } from "@/lib/action-filters";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const STATUS_TONES: Record<string, StatusTone> = {
  "New Inbound": "gray",
  "Contacting Owner": "blue",
  "Terms not Accepted": "red",
  "On Hold": "gray",
  "Pending Verification": "amber",
  "Approved": "green",
  "Rejected": "red",
  "Closed": "green",
};

const INBOUND_FIELDS: ViewField[] = [
  { id: "status", label: "Status", get: (i) => i.status || "New Inbound", order: Object.keys(STATUS_TONES), dot: (v) => statusDot(v, STATUS_TONES[v]) },
  { id: "inbound_status", label: "Inbound status", get: (i) => (i.inbound_status ? inboundStatusLabel(i.inbound_status) : ""), dot: (v) => statusDot(v, v === "Available" ? "green" : v === "Not available" ? "red" : "amber") },
  { id: "category", label: "Category", get: (i) => i.property_category || i.propertyCategory, capitalize: true },
  { id: "assigned", label: "Assigned", get: (i) => i.assigned?.name || "Unassigned" },
  { id: "uploaded_by", label: "Uploaded by", get: (i) => i.uploaded_by?.name },
];

export default function InboundPage() {
  const router = useRouter();
  const views = useModuleView("inbound", INBOUND_FIELDS);
  const [activeTab, setActiveTab] = usePersistedState<string>("inbound:tab", "All Inbound", { allowed: ["All Inbound", "Queue", "Action Required", "Closed"] });
  const [actionFilter, setActionFilter] = usePersistedState<string>("inbound:actionFilter", "Today", { allowed: ACTION_FILTERS });
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [role, setRole] = useState<string>("");

  const [canAssign, setCanAssign] = useState(false);
  const [staffDirectory, setStaffDirectory] = useState<{id: number; name: string}[]>([]);
  const [assignmentIds, setAssignmentIds] = useState<number[] | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [queueFilters, setQueueFilters] = usePersistedState("inbound:queueFilters", { uploader: "", staff: "" });
  useEffect(() => {
    apiJson(`${API_URL}/inbounds/staff-list`).then(result => { setCanAssign(!!result.canAssign); setStaffDirectory(result.data || []); })
      .catch(() => toast.error("Could not load inbound staff directory."));
  }, []);
  const assignInbounds = async (staffId: number | null) => {
    if (!assignmentIds?.length) return;
    setAssigning(true);
    try {
      await apiJson(`${API_URL}/inbounds/assign`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboundIds: assignmentIds, staffId }) });
      setAssignmentIds(null); await fetchInbounds();
      toast.success(staffId === null ? "Inbounds returned to Queue." : "Inbounds assigned and moved to All Inbound.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Assignment failed"); }
    finally { setAssigning(false); }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
        setRole(user?.role?.name || user?.role || "");
      } catch {}
    }
  }, []);

  const [searchQuery, setSearchQuery] = usePersistedState("inbound:search", "");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [filters, setFilters] = usePersistedState("inbound:filters", {
    dateFrom: "",
    dateTo: "",
    category: "",
    type: "",
    status: "",
  });

  const [todayViewMode, setTodayViewMode] = usePersistedState<"pending" | "completed">("inbound:todayViewMode", "pending", { allowed: ["pending", "completed"] });

  const tabs = ["All Inbound", "Queue", "Action Required", "Closed"];
  const actionFilters = [...ACTION_FILTERS];

  const fetchInbounds = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(API_URL + "/inbounds");
      if (!res.ok) throw new Error("Failed to load inbounds");
      const data = await res.json();
      if (Array.isArray(data)) {
        setInbounds(data);
      } else if (data && data.success) {
        setInbounds(data.data);
      }
    } catch {
      toast.error("Failed to load inbound properties.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbounds();
    window.scrollTo(0, 0);
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, [fetchInbounds]);

  const displayedInbounds = useMemo(() => {
    let filtered = inbounds;

    // 1. Search Query
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(record => matchesInboundSearch(record, q));
    }

    // 2. Filters
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(l => new Date(l.created_at || l.createdAt || l.date) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(l => new Date(l.created_at || l.createdAt || l.date) <= to);
    }
    if (filters.category) filtered = filtered.filter(l => (l.property_category || l.propertyCategory) === filters.category);
    if (filters.type) filtered = filtered.filter(l => (l.property_type || l.propertyType) === filters.type);
    if (filters.status) filtered = filtered.filter(l => l.status === filters.status);

    if (activeTab === "Queue" && queueFilters.uploader) filtered = filtered.filter(record => String(record.uploaded_by_id) === queueFilters.uploader);
    if (queueFilters.staff) filtered = filtered.filter(record => queueFilters.staff === "unassigned" ? !record.assigned_staff_id : String(record.assigned_staff_id) === queueFilters.staff);
    if (activeTab === "Queue") return filtered.filter(record => record.is_queued);
    filtered = filtered.filter(record => !record.is_queued);

    const closedStatuses = ["Closed"];

    if (activeTab === "Action Required") {
      const now = new Date();
      return filtered.filter(record => matchesInboundActionFilter(record, actionFilter, todayViewMode, now, filters.status));
    }

    if (activeTab === "Closed") {
      return filtered.filter(l => closedStatuses.includes(l.status));
    }

    // Default: All Inbound (Active Pipeline)
    return filtered.filter(l => !closedStatuses.includes(l.status));
  }, [inbounds, debouncedSearchQuery, filters, activeTab, queueFilters, actionFilter, todayViewMode]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await apiFetch(API_URL + "/inbounds/" + deleteId, { method: "DELETE" });
      if (res.ok) {
        toast.success("Inbound property deleted successfully");
        fetchInbounds();
      } else {
        toast.error("Failed to delete inbound property");
      }
    } catch {
      toast.error("Failed to delete inbound property");
    } finally {
      setDeleteId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const promises = bulkDeleteIds.map(id => apiFetch(API_URL + "/inbounds/" + id, { method: "DELETE" }));
      await Promise.all(promises);
      toast.success(`${bulkDeleteIds.length} inbound properties deleted successfully`);
      fetchInbounds();
    } catch {
      toast.error("Failed to delete some or all properties");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
    }
  };

  const allColumns: ColumnDef<any>[] = [
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
      accessorKey: "propertyId",
      header: "ID",
      cell: ({ row }) => (
        <IdCell href={`/inbound/${row.original.rawId || row.original.id}`}>
          {row.getValue("propertyId") || row.original.property_id || "—"}
        </IdCell>
      ),
    },
    { 
      id: "categoryType", 
      header: "Category - Type",
      cell: ({ row }) => {
        const cat = (row.original.property_category || row.original.propertyCategory || "");
        const type = (row.original.property_type || row.original.propertyType || "").replace(/_/g, ' ');
        if (!cat && !type) return <span className="text-muted-foreground">—</span>;
        return <span className="capitalize">{cat} - {type}</span>;
      },
    },
    {
      id: "mobile",
      header: "Mobile Number",

      cell: ({ row }) => {
        if (!canViewInboundContacts()) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Restricted
            </span>
          );
        }
        return <span>{row.original.mobile_number || row.original.owner_mobile || "—"}</span>;
      },
    },
    ...(activeTab === "Queue" ? [{
      accessorKey: "submission_status",
      header: "Submission",
      cell: ({ row }) => {
        const repeat = row.original.submission_status === "Repeat";
        return <span title={repeat ? "This mobile number appears on an earlier inbound. Staff verification required." : "First inbound for this mobile number."}>
          <StatusCell status={repeat ? "Repeat" : "New"} tone={repeat ? "amber" : "green"} />
        </span>;
      },
    },
    ] as ColumnDef<any>[] : []),
    { id: "uploaded_by", header: "Uploaded by", cell: ({ row }) => row.original.uploaded_by?.name || "Unknown" },
    { id: "assigned", header: "Assigned", cell: ({ row }) => (
      <button type="button" disabled={!canAssign} onClick={() => setAssignmentIds([row.original.id])}
        className="enabled:text-[#0052FF] enabled:hover:underline disabled:cursor-default">
        {row.original.assigned?.name || "Unassigned"}
      </button>
    ) },
    {
      id: "address",
      header: "Address",
      
      cell: ({ row }) => {
        const addr = row.original.address || row.original.location || "";
        if (!addr) return <span className="text-muted-foreground">—</span>;
        
        return (
          <TooltipProvider delay={150}>
            <Tooltip>
              <TooltipTrigger render={
                <div className="max-w-[200px] w-full truncate text-sm text-left cursor-default py-1">
                  {addr}
                </div>
              } />
              <TooltipContent side="top" className="max-w-[300px] text-sm break-words whitespace-normal p-3 border-border/50 shadow-xl bg-background text-foreground relative z-50">
                {addr}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "inbound_status",
      header: "Inbound status",
      cell: ({ row }) => {
        const value = row.original.inbound_status;
        if (!value) return <span>—</span>;
        const tone = value === "available" ? "green" : value === "not_available" ? "red" : "amber";
        return <StatusCell status={inboundStatusLabel(value)} tone={tone} />;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = (row.original.status as string) || "New";
        return <StatusCell status={s} tone={STATUS_TONES[s] ?? "gray"} />;
      },
    },
    { 
      accessorKey: "date", 
      header: activeTab === "Queue" ? "Created at" : "Date",
      
      cell: ({ row }) => {
        const d = row.original.createdAt || row.original.created_at || row.original.date;
        return activeTab === "Queue" ? <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatInboundCreated(d)}</span> : <DateCell value={d} />;
      }
    },
  ];

  const columnKey = (column: ColumnDef<any>) => column.id || ("accessorKey" in column ? String(column.accessorKey) : "");
  const columns = activeTab === "Queue"
    ? allColumns.filter(column => !["assigned", "address", "status"].includes(columnKey(column)))
    : activeTab === "All Inbound"
      ? allColumns.filter(column => columnKey(column) !== "date")
      : allColumns;

  const uniqueCategories = Array.from(new Set(inbounds.map(l => l.property_category || l.propertyCategory).filter(c => c && c !== "—")));
  const uniqueTypes = Array.from(new Set(inbounds.map(l => l.property_type || l.propertyType).filter(t => t && t !== "—")));
  const uniqueStatuses = Array.from(new Set(inbounds.map(l => l.status).filter(Boolean)));

  const activeFiltersCount = Object.values(filters).filter(v => v !== "").length + (queueFilters.staff ? 1 : 0) + (activeTab === "Queue" && queueFilters.uploader ? 1 : 0);

  const clearFilters = () => { setFilters({ dateFrom: "", dateTo: "", category: "", type: "", status: "" }); setQueueFilters({ uploader: "", staff: "" }); };

  
  const tableProps = {
    flush: true as const,
    columns,
    data: displayedInbounds,
    showToolbar: true,
    showDeleteAction: role === "Admin",
    onDeleteSelected: (rows: any[]) => setBulkDeleteIds(rows.map(r => r.rawId || r.id)),
    renderToolbarActions: (selectedRows: any[]) => {
      if (!selectedRows.length) return null;
      const row = selectedRows[0];
      const id = row.rawId || row.id;
      return (
        <>
          {canAssign && <Button variant="outline" size="sm" onClick={() => setAssignmentIds(selectedRows.map(row => row.id))}>Assign Selected</Button>}
          {selectedRows.length === 1 && <><Button variant="outline" size="sm" onClick={() => router.push("/inbound/" + id)}>
            <Eye size={15} className="mr-1.5" /> View
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push("/inbound/new?edit=" + id)}>
            <Edit size={15} className="mr-1.5" /> Edit
          </Button></>}
        </>
      );
    }
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
          toolbarFilterButton(activeFiltersCount)
        )
      } />
      <PopoverContent align={isMobile ? "end" : "start"} className="w-[calc(100vw-32px)] sm:w-80 p-0 rounded-2xl shadow-xl overflow-hidden border-border/60 mx-4 sm:mx-0">
        <div className="flex items-center justify-between p-4 border-b bg-muted/10">
          <h4 className="font-semibold text-foreground text-sm">Filter Inbound</h4>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground hover:text-red-600">
              Clear All
            </Button>
          )}
        </div>
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {activeTab === "Queue" && <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Uploaded by</label>
            <FormSelect name="uploader" value={queueFilters.uploader} onValueChange={value => setQueueFilters(f => ({ ...f, uploader: value || "" }))}
              placeholder="All uploaders" options={[{ label: "All uploaders", value: "" }, ...Array.from(new Map(inbounds.filter(row => row.uploaded_by).map(row => [row.uploaded_by.id, row.uploaded_by])).values()).map(person => ({ label: person.name, value: String(person.id) }))]} />
          </div>}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Staff (assigned)</label>
            <FormSelect name="assignedStaff" value={queueFilters.staff} onValueChange={value => setQueueFilters(f => ({ ...f, staff: value || "" }))}
              placeholder="All staff" options={[{ label: "All staff", value: "" }, { label: "Unassigned", value: "unassigned" }, ...staffDirectory.map(person => ({ label: person.name, value: String(person.id) }))]} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created From</label>
            <Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({...f, dateFrom: e.target.value}))} className="h-9 rounded-lg text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created To</label>
            <Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({...f, dateTo: e.target.value}))} className="h-9 rounded-lg text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</label>
            <FormSelect name="status" options={uniqueStatuses.map(s => ({label: s, value: s}))} value={filters.status} onValueChange={v => setFilters(f => ({...f, status: v || ""}))} placeholder="All Statuses" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Property Category</label>
            <FormSelect name="category" options={uniqueCategories.map(s => ({label: s, value: s}))} value={filters.category} onValueChange={v => setFilters(f => ({...f, category: v || ""}))} placeholder="All Categories" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Property Type</label>
            <FormSelect name="type" options={uniqueTypes.map(s => ({label: s, value: s}))} value={filters.type} onValueChange={v => setFilters(f => ({...f, type: v || ""}))} placeholder="All Types" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const mobileFilters = (
    <div className="px-4 pb-2 space-y-4">
      {/* iOS Search Bar & Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search ID, Type, Phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-11 h-12 bg-black/5 dark:bg-white/10 border-transparent rounded-2xl text-[16px] focus-visible:ring-1 focus-visible:ring-primary shadow-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 bg-muted-foreground/20 rounded-full text-foreground hover:bg-muted-foreground/30">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {renderFilterPopover(true)}
      </div>

      {/* Pill Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {tabs.map(tab => {
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
          )
        })}
      </div>

      {/* Action Required Row */}
      {activeTab === "Action Required" && (
        <div className="flex flex-col gap-3 -mx-4 px-4">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            {actionFilters.map((filter) => {
              const isActive = actionFilter === filter;
              let activeClass = "bg-primary/10 text-primary border-primary/30";
              if (filter === "Overdue" && isActive) activeClass = "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400";
              else if (filter === "Yesterday" && isActive) activeClass = "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300";
              else if (filter === "Today" && isActive) activeClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400";
              return (
                <button
                  key={filter}
                  className={"h-9 shrink-0 flex items-center justify-center cursor-pointer px-4 rounded-full text-[13px] font-medium transition-all duration-200 ease-out active:scale-[0.96] border " + (isActive ? activeClass : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground")}
                  onClick={() => setActionFilter(filter)}
                >
                  {getActionFilterLabel(filter)}
                </button>
              );
            })}
          </div>
          
          <div className={`flex items-center h-10 bg-muted/60 p-1 rounded-full border border-border/50 relative shadow-inner transition-opacity duration-200 ${actionFilter === "Today" ? "opacity-100" : "hidden opacity-0 pointer-events-none"}`}>
            {[
              { id: "pending", label: "Follow Up" },
              { id: "completed", label: "Followed Up" }
            ].map((mode) => {
              const isSelected = todayViewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setTodayViewMode(mode.id as "pending" | "completed")}
                  className={`flex-1 relative h-full flex items-center justify-center rounded-full text-[13px] font-bold transition-colors duration-300 z-10 active:scale-[0.96] ${isSelected ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="todayToggleBgMobile"
                      className="absolute inset-0 bg-[#0052FF] shadow-md rounded-full"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  <span className="relative z-10">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );


  const desktopFilters = (
    <ListFrame>
      <ListToolbar>
        <SegmentTabs tabs={tabs} value={activeTab} onChange={setActiveTab} label="Views" />
        <ToolbarEnd>
          {views.picker}
          <ToolbarSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search ID, Type, Phone" />
          {renderFilterPopover(false)}
        </ToolbarEnd>
      </ListToolbar>

      {/* Action Required Row */}
      {activeTab === "Action Required" && (
        <div className="flex flex-wrap items-center gap-2 px-5 pb-1 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {actionFilters.map((filter) => {
              const isActive = actionFilter === filter;
              let activeClass = "bg-primary/10 text-primary border-primary/30";
              if (filter === "Overdue" && isActive) activeClass = "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400";
              else if (filter === "Yesterday" && isActive) activeClass = "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300";
              else if (filter === "Today" && isActive) activeClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400";
              return (
                <button
                  key={filter}
                  className={"h-7 shrink-0 flex items-center justify-center cursor-pointer px-2.5 rounded-md text-[13px] font-medium leading-none transition-colors border " + (isActive ? activeClass : "bg-transparent text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground")}
                  onClick={() => setActionFilter(filter)}
                >
                  {getActionFilterLabel(filter)}
                </button>
              );
            })}
          </div>
          
          <div className={`ml-auto shrink-0 flex h-8 items-center bg-muted/70 p-0.5 rounded-md relative transition-opacity duration-200 ${actionFilter === "Today" ? "opacity-100" : "hidden opacity-0 pointer-events-none"}`}>
            {[
              { id: "pending", label: "Follow Up" },
              { id: "completed", label: "Followed Up" }
            ].map((mode) => {
              const isSelected = todayViewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setTodayViewMode(mode.id as "pending" | "completed")}
                  className={`relative h-full flex items-center px-2.5 rounded text-[13px] font-medium leading-none transition-colors duration-300 z-10 active:scale-[0.96] ${isSelected ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="todayToggleBgDesktop"
                      className="absolute inset-0 rounded bg-background shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:bg-white/10"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  <span className="relative z-10">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex w-full min-w-0 flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
        {isLoading ? <TableSkeleton flush /> : <ModuleViews
          state={views}
          data={displayedInbounds}
          columns={columns}
          list={
            <DataTable {...tableProps} variant="list" />
          }
          getKey={(i) => i.rawId || i.id}
          onOpen={(i) => router.push(`/inbound/${i.rawId || i.id}`)}
          onMove={(i, status) =>
            moveRow({ setRows: setInbounds, row: i, same: (a, b) => (a.rawId || a.id) === (b.rawId || b.id), patch: { status }, request: { path: `/inbounds/${i.rawId || i.id}`, method: "PATCH", body: { status } }, success: `Moved to ${status}` })
          }
          card={(i) => ({ title: [i.property_category || i.propertyCategory, (i.property_type || i.propertyType || "").replace(/_/g, " ")].filter(Boolean).join(" - ") || "Inbound", avatar: false, id: i.propertyId || i.property_id, href: `/inbound/${i.rawId || i.id}`, subtitle: i.address || i.location, footer: i.assigned?.name ?? <span className="text-muted-foreground">Unassigned</span> })}
          noun="inbounds"
        />}
      </div>
    </ListFrame>
  );



  return (
    <>
      <MobileHeader title="Inbound Dashboard" />
      {views.switcher}
      <div className="w-full flex flex-col space-y-6 pt-4 md:space-y-0 md:pt-0 md:h-full">
        <PageActions>
          <Link href="/inbound/new" className={headerPrimaryClass}>
            <Plus className="size-4" />
            Add Inbound
          </Link>
        </PageActions>
        
        <Device mobile={mobileFilters} desktop={desktopFilters} />

        {/* Mobile table */}
        <Device
          desktop={null}
          mobile={
            <div className="w-full px-4 pb-4">
              {isLoading ? <TableSkeleton /> : <DataTable {...tableProps} />}
            </div>
          }
        />
      </div>

      <InboundAssignmentDialog open={assignmentIds !== null} count={assignmentIds?.length || 0} busy={assigning}
        onClose={() => setAssignmentIds(null)} onConfirm={assignInbounds} />
      <Dialog open={deleteId !== null || bulkDeleteIds !== null} onOpenChange={(open) => {
        if (!open) {
          setDeleteId(null);
          setBulkDeleteIds(null);
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Inbound Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} propert(ies)` : 'this inbound property'}? This action cannot be undone.
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
