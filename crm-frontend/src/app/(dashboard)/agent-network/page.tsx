"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { Trash2, Plus, RefreshCw, Search, Eye, Filter } from "lucide-react";
import { motion } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUS_STYLES: Record<string, string> = {
  "New": "bg-gray-100 text-gray-800 border-gray-200",
  "Contacted": "bg-blue-100 text-blue-800 border-blue-200",
  "Meeting Done": "bg-purple-100 text-purple-800 border-purple-200",
  "Documents Pending": "bg-amber-100 text-amber-800 border-amber-200",
  "Approved": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Active": "bg-green-100 text-green-800 border-green-200",
  "Hold": "bg-orange-100 text-orange-800 border-orange-200",
  "Rejected": "bg-red-100 text-red-800 border-red-200",
};

export default function AgentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All Agents");
  const [actionFilter, setActionFilter] = useState("Today");
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [todayViewMode, setTodayViewMode] = useState<"pending" | "completed">("pending");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    partnerType: "",
    status: "",
  });

  const tabs = ["All Agents", "Action Required"];
  const actionFilters = ["Overdue", "Yesterday", "Today", "Tomorrow", "All Scheduled"];

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("crm_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setIsAdmin(user.role === "Admin" || user.role === "Super Admin");
      }
    } catch {}
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(API_URL + "/agents");
      const data = await res.json();
      if (data.success) {
        setAgents(data.data.map((a: any, i: number) => ({ ...a, sno: i + 1 })));
      }
    } catch {
      toast.error("Failed to load agents.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`${API_URL}/agents/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Agent deleted successfully.");
        fetchAgents();
      } else {
        toast.error("Failed to delete agent.");
      }
    } catch {
      toast.error("An error occurred while deleting.");
    } finally {
      setDeleteId(null);
    }
  };

  const displayedAgents = () => {
    let filtered = agents;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(q) ||
        String(a.mobile).includes(q) ||
        (a.company_name && a.company_name.toLowerCase().includes(q)) ||
        String(a.id).includes(q)
      );
    }

    if (filters.partnerType) {
      filtered = filtered.filter(a => a.partner_type === filters.partnerType);
    }
    if (filters.status) {
      filtered = filtered.filter(a => a.status === filters.status);
    }

    if (activeTab === "Action Required") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      return filtered.filter(agent => {
        const parseLocal = (dStr: string) => {
          if (!dStr) return null;
          const parts = dStr.split("T")[0].split("-");
          if (parts.length !== 3) return null;
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          d.setHours(0, 0, 0, 0);
          return d;
        };

        const fDate = parseLocal(agent.nextFollowUpDate);
        const lDate = parseLocal(agent.lastFollowedUpDate);

        if (actionFilter === "Overdue") {
          return fDate && fDate < today;
        }
        if (actionFilter === "Yesterday") {
          return lDate && lDate.getTime() === yesterday.getTime();
        }
        if (actionFilter === "Today") {
          const isFollowedUpToday = lDate && lDate.getTime() === today.getTime();
          
          if (todayViewMode === "completed") {
            return isFollowedUpToday;
          } else {
            return fDate && fDate.getTime() === today.getTime();
          }
        }
        if (actionFilter === "Tomorrow") {
          return fDate && fDate.getTime() === tomorrow.getTime();
        }
        if (actionFilter === "All Scheduled") {
          return fDate && fDate > tomorrow;
        }
        return false;
      });
    }

    return filtered;
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
    { accessorKey: "sno", header: "#" },
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <Link href={`/agent-network/${row.original.id}`} className="text-[#0052FF] hover:underline font-medium">
          A{String(row.original.id).padStart(5, "0")}
        </Link>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-xs text-blue-900 dark:text-blue-300 shrink-0">
            {row.original.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <span className="font-semibold text-foreground whitespace-nowrap">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "company_name",
      header: "Company",
      cell: ({ row }) => <span className="text-foreground/80 whitespace-nowrap">{row.original.company_name || "\u2014"}</span>,
    },
    {
      accessorKey: "mobile",
      header: "Mobile",
      cell: ({ row }) => <span className="font-mono text-muted-foreground whitespace-nowrap">{row.original.mobile}</span>,
    },
    {
      accessorKey: "partner_type",
      header: "Partner Type",
      cell: ({ row }) => <span className="capitalize whitespace-nowrap">{row.original.partner_type ? row.original.partner_type.replace(/_/g, " ") : "\u2014"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status as string;
        const cls = STATUS_STYLES[s] ?? "bg-gray-100 text-gray-800 border-gray-200";
        return <Badge className={`font-medium shadow-sm border whitespace-nowrap ${cls}`}>{s}</Badge>;
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-[#0052FF] hover:bg-blue-50 dark:hover:bg-blue-950"
            title="View Agent"
            onClick={() => router.push(`/agent-network/${row.original.id}`)}
          >
            <Eye size={15} />
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              title="Delete Agent"
              onClick={() => setDeleteId(row.original.id)}
            >
              <Trash2 size={15} />
            </Button>
          )}
        </div>
      )
    }
  ];

  const uniquePartnerTypes = Array.from(new Set(agents.map(a => a.partner_type).filter(c => c && c !== "—")));
  const uniqueStatuses = Array.from(new Set(agents.map(a => a.status).filter(Boolean)));
  const activeFiltersCount = Object.values(filters).filter(v => v !== "").length;
  const clearFilters = () => setFilters({ partnerType: "", status: "" });

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex h-[48px] items-center justify-between pr-[150px]">
        <h1 className="text-[28px] font-bold tracking-tight">Agent Network</h1>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border/60" onClick={fetchAgents} title="Refresh">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </Button>

          <Link href="/agent-network/new" className="inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95">
            <Plus size={18} />
            Add New Agent
          </Link>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between px-6 border-b bg-muted/10 pt-4 gap-4">
          <div className="flex items-center gap-3 pb-3 xl:pb-4 w-full xl:w-auto">
            <div className="relative flex-1 xl:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search ID, Name, Phone, Company..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-background rounded-full border-border/60 shadow-sm text-[13.5px]"
              />
            </div>
            
            <Popover>
              <PopoverTrigger render={
                <Button variant="outline" className="h-10 rounded-full bg-background border-border/60 shadow-sm gap-2 px-4 flex items-center">
                  <Filter size={14} className="text-muted-foreground" />
                  <span className="font-medium text-[13.5px]">Filters</span>
                  {activeFiltersCount > 0 && (
                    <Badge className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-[#0052FF]">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              } />
              <PopoverContent className="w-80 p-4 rounded-2xl" align="start">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-sm">Filter Agents</h4>
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
                      Clear all
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Partner Type</label>
                    <FormSelect
                      name="filterType"
                      placeholder="Any Partner Type"
                      options={uniquePartnerTypes.map((c: any) => ({ label: String(c).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), value: c }))}
                      value={filters.partnerType}
                      onValueChange={(v) => setFilters(f => ({ ...f, partnerType: v || "" }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Status</label>
                    <FormSelect
                      name="filterStatus"
                      placeholder="Any Status"
                      options={uniqueStatuses.map((s: any) => ({ label: s, value: s }))}
                      value={filters.status}
                      onValueChange={(v) => setFilters(f => ({ ...f, status: v || "" }))}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-6 overflow-x-auto hide-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative pb-3 text-sm font-semibold transition-colors whitespace-nowrap"
              >
                <span className={activeTab === tab ? "text-[#0052FF]" : "text-muted-foreground hover:text-foreground"}>
                  {tab}
                </span>
                {activeTab === tab && (
                  <motion.div layoutId="agent-tab-indicator" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0052FF] rounded-t-full" />
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
                        layoutId="agentTodayToggleBg"
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
          {isLoading ? <TableSkeleton columns={6} rows={5} /> : <DataTable columns={columns} data={displayedAgents()} showToolbar={true} />}
        </div>
      </div>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this agent? This action cannot be undone and will remove all associated logs and follow-ups.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Agent</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
