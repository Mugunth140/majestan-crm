"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, RefreshCw, Eye, Search, Filter, X } from "lucide-react";
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUS_STYLES: Record<string, string> = {
  "New Inbound": "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "Contacting Owner": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  "Terms not Accepted": "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400",
  "On Hold": "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
  "Pending Verification": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  "Approved": "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Rejected": "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  "Closed": "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
};

export default function InboundPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All Inbound");
  const [actionFilter, setActionFilter] = useState("Today");
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    category: "",
    type: "",
    status: "",
  });

  const [todayViewMode, setTodayViewMode] = useState<"pending" | "completed">("pending");

  const tabs = ["All Inbound", "Action Required", "Closed"];
  const actionFilters = ["Overdue", "Yesterday", "Today", "Tomorrow", "All Scheduled"];

  const fetchInbounds = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(API_URL + "/inbounds");
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
  }, [fetchInbounds]);

  const displayedInbounds = useMemo(() => {
    let filtered = inbounds;

    // 1. Search Query
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(l => {
        const propId = l.property_id || l.propertyId || "";
        const idStr = l.id ? l.id.toString() : "";
        const pType = l.property_type || l.propertyType || "";
        const title = l.property_title || l.propertyTitle || "";
        return propId.toLowerCase().includes(q) || idStr.includes(q) || pType.toLowerCase().includes(q) || title.toLowerCase().includes(q);
      });
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

    const closedStatuses = ["Closed"];

    if (activeTab === "Action Required") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const actionStatuses = ["New Inbound", "Contacting Owner", "Pending Verification"];

      return filtered.filter(l => {
        const parseLocal = (dStr: string) => {
          if (!dStr) return null;
          const parts = dStr.split("T")[0].split("-");
          if (parts.length !== 3) return null;
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          d.setHours(0, 0, 0, 0);
          return d;
        };

        const fDate = parseLocal(l.nextFollowUpDate);
        const lDate = parseLocal(l.lastFollowedUpDate);

        let matchesTimeFilter = false;

        if (actionFilter === "Overdue") {
          matchesTimeFilter = !!(fDate && fDate < today);
        } else if (actionFilter === "Yesterday") {
          matchesTimeFilter = !!(lDate && lDate.getTime() === yesterday.getTime());
        } else if (actionFilter === "Today") {
          const isFollowedUpToday = !!(lDate && lDate.getTime() === today.getTime());
          
          if (todayViewMode === "completed") {
            matchesTimeFilter = isFollowedUpToday;
          } else {
            // pending
            matchesTimeFilter = !!(fDate && fDate.getTime() === today.getTime());
          }
        } else if (actionFilter === "Tomorrow") {
          matchesTimeFilter = !!(fDate && fDate.getTime() === tomorrow.getTime());
        } else if (actionFilter === "All Scheduled") {
          matchesTimeFilter = !!(fDate && fDate > tomorrow);
        }

        // Action required if it matches the time filter, OR if it's in a critical status and has NO future follow-ups scheduled
        return matchesTimeFilter || (actionStatuses.includes(l.status) && !fDate);
      });
    }

    if (activeTab === "Closed") {
      return filtered.filter(l => closedStatuses.includes(l.status));
    }

    // Default: All Inbound (Active Pipeline)
    return filtered.filter(l => !closedStatuses.includes(l.status));
  }, [inbounds, debouncedSearchQuery, filters, activeTab]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(API_URL + "/inbounds/" + deleteId, { method: "DELETE" });
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
      id: "sno", 
      header: "#",
      cell: ({ row }) => <span>{row.index + 1}</span>
    },
    {
      accessorKey: "propertyId",
      header: "Id",
      cell: ({ row }) => (
        <Link href={`/inbound/${row.original.rawId || row.original.id}`} className="text-[#0052FF] hover:underline font-medium">
          {row.getValue("propertyId") || row.original.property_id || "N/A"}
        </Link>
      ),
    },
    { 
      accessorKey: "date", 
      header: "Date",
      cell: ({ row }) => {
        const d = row.original.createdAt || row.original.created_at || row.original.date;
        return <span>{d ? new Date(d).toLocaleDateString() : "-"}</span>;
      }
    },
    { 
      id: "categoryType", 
      header: "Category - Type",
      cell: ({ row }) => {
        const cat = (row.original.property_category || row.original.propertyCategory || "");
        const type = (row.original.property_type || row.original.propertyType || "").replace(/_/g, ' ');
        if (!cat && !type) return <span>-</span>;
        return <span className="capitalize">{cat} - {type}</span>;
      },
    },
    {
      id: "mobile",
      header: "Mobile Number",
      cell: ({ row }) => <span>{row.original.mobile_number || row.original.owner_mobile || "-"}</span>,
    },
    {
      id: "address",
      header: "Address",
      cell: ({ row }) => {
        const addr = row.original.address || row.original.location || "";
        if (!addr) return <span>-</span>;
        
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
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = (row.original.status as string) || "New";
        const cls = STATUS_STYLES[s] ?? "bg-gray-100 text-gray-800 border-gray-200";
        return <Badge className={"font-medium shadow-sm border whitespace-nowrap " + cls}>{s}</Badge>;
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const id = row.original.rawId || row.original.id;
        return (
          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="View Details"
              onClick={() => router.push("/inbound/" + id)}
            >
              <Eye size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Edit"
              onClick={() => router.push("/inbound/new?edit=" + id)}
            >
              <Edit size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              title="Delete"
              onClick={() => setDeleteId(id)}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        );
      }
    },
  ];

  const uniqueCategories = Array.from(new Set(inbounds.map(l => l.property_category || l.propertyCategory).filter(c => c && c !== "—")));
  const uniqueTypes = Array.from(new Set(inbounds.map(l => l.property_type || l.propertyType).filter(t => t && t !== "—")));
  const uniqueStatuses = Array.from(new Set(inbounds.map(l => l.status).filter(Boolean)));

  const activeFiltersCount = Object.values(filters).filter(v => v !== "").length;

  const clearFilters = () => setFilters({ dateFrom: "", dateTo: "", category: "", type: "", status: "" });

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex h-[48px] items-center justify-between pr-[150px]">
        <h1 className="text-[28px] font-bold tracking-tight">Inbound Dashboard</h1>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border/60" onClick={fetchInbounds} title="Refresh">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </Button>

          <Link href="/inbound/new" className="inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95">
            <Plus size={18} />
            Add New Inbound
          </Link>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between px-6 border-b bg-muted/10 pt-4 gap-4">
          <div className="flex items-center gap-3 pb-3 xl:pb-4 w-full xl:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 xl:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search Property ID, Type..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-background rounded-full border-border/60 shadow-sm text-[13.5px]"
              />
            </div>
            
            {/* Filters Popover */}
            <Popover>
              <PopoverTrigger render={
                <Button variant="outline" className="h-10 rounded-full bg-background border-border/60 shadow-sm px-4 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-[13.5px]">Filters</span>
                  {activeFiltersCount > 0 && (
                    <Badge className="ml-1 bg-[#0052FF] text-white px-1.5 py-0.5 rounded-md text-[10px]">{activeFiltersCount}</Badge>
                  )}
                </Button>
              } />
              <PopoverContent align="start" className="w-80 p-0 rounded-2xl shadow-xl overflow-hidden border-border/60">
                <div className="flex items-center justify-between p-4 border-b bg-muted/10">
                  <h4 className="font-semibold text-foreground text-sm">Filter Inbound</h4>
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground hover:text-red-600">
                      Clear All
                    </Button>
                  )}
                </div>
                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
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
            
            {(searchQuery || activeFiltersCount > 0) && (
              <Button variant="ghost" size="icon" onClick={() => { setSearchQuery(""); clearFilters(); }} className="h-10 w-10 rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors" title="Clear Search & Filters">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide relative xl:pr-6">
            {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={"relative pb-4 text-[15px] whitespace-nowrap font-semibold transition-colors duration-200 ease-out " + (activeTab === tab ? "text-[#0052FF]" : "text-muted-foreground hover:text-foreground")}
            >
              {tab}
              {activeTab === tab && (
                <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0052FF] rounded-t-full" initial={false} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              )}
            </button>
          ))}
          </div>
        </div>

        {activeTab === "Action Required" && (
          <div className="flex items-center gap-2 px-6 pt-5 min-h-[60px] animate-in slide-in-from-top-2 fade-in duration-200 flex-wrap">
            <div className="flex items-center gap-2">
              {actionFilters.map((filter) => {
                const isActive = actionFilter === filter;
                let activeClass = "bg-primary/10 text-primary border-primary/30";
                if (filter === "Overdue" && isActive) activeClass = "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400";
                else if (filter === "Yesterday" && isActive) activeClass = "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300";
                else if (filter === "Today" && isActive) activeClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400";
                return (
                  <button
                    key={filter}
                    className={"h-10 flex items-center justify-center cursor-pointer px-5 rounded-full text-[13.5px] font-medium transition-all duration-200 ease-out active:scale-[0.96] border " + (isActive ? activeClass : "bg-transparent text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground")}
                    onClick={() => setActionFilter(filter)}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>
            
            <div className={`ml-auto flex items-center h-10 bg-muted/60 p-1 rounded-full border border-border/50 relative shadow-inner transition-opacity duration-200 ${actionFilter === "Today" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              {[
                { id: "pending", label: "Follow Up" },
                { id: "completed", label: "Followed Up" }
              ].map((mode) => {
                const isSelected = todayViewMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setTodayViewMode(mode.id as "pending" | "completed")}
                    className={`relative h-full flex items-center px-4 rounded-full text-[13px] font-bold transition-colors duration-300 z-10 active:scale-[0.96] ${isSelected ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="todayToggleBg"
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

        <div className="p-6">
          {isLoading ? <TableSkeleton /> : <DataTable columns={columns} data={displayedInbounds} showToolbar={true} />}
        </div>
      </div>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Inbound Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this inbound property? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
