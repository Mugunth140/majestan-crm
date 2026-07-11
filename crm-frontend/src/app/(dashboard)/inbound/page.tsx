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

  const tabs = ["All Inbound", "Action Required", "Closed"];

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

    if (activeTab === "Action Required") {
      return filtered.filter(l => ["New Inbound", "Contacting Owner", "Pending Verification"].includes(l.status));
    }

    if (activeTab === "Closed") {
      return filtered.filter(l => ["Terms not Accepted", "On Hold", "Approved", "Rejected", "Closed"].includes(l.status));
    }

    // Default: All Inbound
    return filtered;
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

  const renderQualityScore = (score: number) => {
    let label = "Needs Improvement";
    let cls = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400";
    
    if (score > 90) {
      label = "Premium";
      cls = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400";
    } else if (score > 75) {
      label = "Featured";
      cls = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
    } else if (score > 60) {
      label = "Standard";
      cls = "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400";
    }

    return (
      <div className="flex items-center gap-2">
        <Badge className={`font-medium shadow-sm border whitespace-nowrap ${cls}`}>
          {label}
        </Badge>
        <span className="text-xs font-semibold text-muted-foreground">{score}%</span>
      </div>
    );
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
      header: "Property ID",
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
      accessorKey: "propertyCategory", 
      header: "Category",
      cell: ({ row }) => (
        <span className="capitalize">{(row.original.property_category || row.original.propertyCategory)?.replace(/_/g, ' ') || "-"}</span>
      ),
    },
    {
      accessorKey: "propertyType",
      header: "Property Type",
      cell: ({ row }) => (
        <span className="capitalize">{(row.original.property_type || row.original.propertyType)?.replace(/_/g, ' ') || "-"}</span>
      ),
    },
    {
      accessorKey: "qualityScore",
      header: "Quality Score",
      cell: ({ row }) => {
        const score = row.original.qualityScore || row.original.quality_score || 0;
        return renderQualityScore(Number(score));
      }
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
