"use client";
import { useState, useEffect, useMemo } from "react";
import { DataTable } from "@/components/tables/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Edit, Search, Filter, X, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { motion } from "motion/react";
import { useDebounce } from "@/hooks/use-debounce";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const STATUS_STYLES: Record<string, string> = {
  "New Application": "bg-gray-100 text-gray-800",
  "Resume Shortlisted": "bg-blue-100 text-blue-800",
  "Interview Scheduled": "bg-purple-100 text-purple-800",
  "Interview Completed": "bg-indigo-100 text-indigo-800",
  "Selected": "bg-emerald-100 text-emerald-800",
  "Offer Sent": "bg-teal-100 text-teal-800",
  "Joined": "bg-green-100 text-green-800",
  "Rejected": "bg-red-200 text-red-900",
  "Hold": "bg-yellow-100 text-yellow-800",
};

export default function HrPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("All Candidates");
  const [actionFilter, setActionFilter] = useState("Today");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [todayViewMode, setTodayViewMode] = useState<"pending" | "completed">("pending");

  const [role, setRole] = useState<string>("");
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
        setRole(user?.role?.name || user?.role || "");
      } catch {}
    }
  }, []);

  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    department: "",
    status: "",
  });

  const tabs = ["All Candidates", "Action Required", "Rejected"];
  const actionFilters = ["Overdue", "Yesterday", "Today", "Tomorrow", "All Scheduled"];

  const fetchCandidates = () => {
    setIsLoading(true);
    apiFetch(`${API_URL}/hr`)
      .then(res => res.json())
      .then(data => {
        const mapped = data.map((c: any, i: number) => ({
          ...c,
          sno: i + 1,
          formattedId: "HRC" + String(c.id).padStart(4, "0")
        }));
        setCandidates(mapped);
      })
      .finally(() => setIsLoading(false));
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const promises = bulkDeleteIds.map(id => apiFetch(API_URL + "/hr/" + id, { method: "DELETE" }));
      await Promise.all(promises);
      toast.success(`${bulkDeleteIds.length} candidate(s) deleted successfully`);
      fetchCandidates();
    } catch {
      toast.error("Failed to delete some or all candidates");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
    }
  };

  useEffect(() => {
    fetchCandidates();
    // Scroll to top on mount (mobile body scroll + desktop main scroll)
    window.scrollTo(0, 0);
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, []);

  const displayedCandidates = useMemo(() => {
    let filtered = candidates;

    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.formattedId && c.formattedId.toLowerCase().includes(q)) ||
        (c.mobile && c.mobile.includes(q)) ||
        (c.department && c.department.toLowerCase().includes(q)) ||
        (c.position && c.position.toLowerCase().includes(q))
      );
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(c => new Date(c.createdAt || c.created_at) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(c => new Date(c.createdAt || c.created_at) <= to);
    }
    if (filters.department) filtered = filtered.filter(c => c.department === filters.department);
    if (filters.status) filtered = filtered.filter(c => c.status === filters.status);

    if (activeTab === "Action Required") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const actionStatuses = ["New Application", "Hold"];

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
            matchesTimeFilter = !!(fDate && fDate.getTime() === today.getTime());
          }
        } else if (actionFilter === "Tomorrow") {
          matchesTimeFilter = !!(fDate && fDate.getTime() === tomorrow.getTime());
        } else if (actionFilter === "All Scheduled") {
          matchesTimeFilter = !!(fDate && fDate > tomorrow);
        }
        return matchesTimeFilter || (actionStatuses.includes(l.status) && !fDate);
      });
    }

    if (activeTab === "Rejected") return filtered.filter(c => c.status === "Rejected");
    if (activeTab === "All Candidates") return filtered.filter(c => c.status !== "Rejected");
    return filtered;
  }, [candidates, debouncedSearchQuery, filters, activeTab, actionFilter, todayViewMode]);

  const uniqueDepartments = Array.from(new Set(candidates.map(l => l.department).filter(Boolean)));
  const uniqueStatuses = Array.from(new Set(candidates.map(l => l.status).filter(Boolean)));
  const activeFiltersCount = Object.values(filters).filter(v => v !== "").length;
  const clearFilters = () => setFilters({ dateFrom: "", dateTo: "", department: "", status: "" });

  const columns = [
    {
      id: "select",
      header: ({ table }: any) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
      cell: ({ row }: any) => (
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
      accessorKey: "formattedId",
      header: "Candidate ID",
      cell: ({ row }: any) => (
        <Link href={`/hr/${row.original.id}`} className="text-[#0052FF] hover:underline font-medium">
          {row.getValue("formattedId")}
        </Link>
      ),
    },
    { accessorKey: "name", header: "Candidate Name" },
    { accessorKey: "mobile", header: "Mobile Number" },
    { accessorKey: "department", header: "Department" },
    { accessorKey: "position", header: "Position" },
    { accessorKey: "experience", header: "Experience" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => {
        const s = row.getValue("status") as string;
        const cls = STATUS_STYLES[s] ?? "bg-gray-100 text-gray-800 border-gray-200";
        return <Badge className={`font-medium shadow-sm border whitespace-nowrap ${cls}`}>{s}</Badge>;
      },
    }
  ];

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
      <PopoverContent align={isMobile ? "end" : "start"} className="w-[calc(100vw-32px)] sm:w-80 p-0 rounded-2xl shadow-xl overflow-hidden border-border/60 mx-4 sm:mx-0">
        <div className="flex items-center justify-between p-4 border-b bg-muted/10">
          <h4 className="font-semibold text-foreground text-sm">Filter Candidates</h4>
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
            <FormSelect name="status" options={uniqueStatuses.map(s => ({label: s, value: s as string}))} value={filters.status} onValueChange={v => setFilters(f => ({...f, status: v || ""}))} placeholder="All Statuses" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Department</label>
            <FormSelect name="department" options={uniqueDepartments.map(s => ({label: s as string, value: s as string}))} value={filters.department} onValueChange={v => setFilters(f => ({...f, department: v || ""}))} placeholder="All Departments" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const mobileFilters = (
    <div className="px-4 pb-2 space-y-4">
      {/* Search & Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search HR..."
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
              className={`px-5 h-10 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all border active:scale-95 ${isActive ? "bg-foreground text-background border-foreground shadow-sm" : "bg-card text-muted-foreground border-border hover:bg-muted"}`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Action Required sub-filters */}
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
                  {filter}
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
                      layoutId="hrTodayToggleBgMobile"
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
    <div className="bg-card border rounded-xl overflow-hidden shadow-sm md:flex md:flex-col md:flex-1 md:min-h-0">
      {/* Tabs Row */}
      <div className="flex items-center justify-between px-6 border-b bg-muted/10 pt-4 gap-4">
        <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide relative">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={"relative pb-4 text-[15px] whitespace-nowrap font-semibold transition-colors duration-200 ease-out " + (activeTab === tab ? "text-[#0052FF]" : "text-muted-foreground hover:text-foreground")}
            >
              {tab}
              {activeTab === tab && (
                <motion.div layoutId="hrDesktopActiveTabUnderline" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0052FF] rounded-t-full" initial={false} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              )}
            </button>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2 pb-4">
          <div className="relative w-64 xl:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ID, Name, Phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-background rounded-xl border-border/60 shadow-sm text-[13.5px] focus-visible:ring-1 focus-visible:ring-primary"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-muted-foreground/10 rounded-full text-foreground hover:bg-muted-foreground/20">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {renderFilterPopover(false)}
          </div>
        </div>
      </div>

      {/* Action Required Row */}
      {activeTab === "Action Required" && (
        <div className="flex items-center gap-4 px-6 py-3 bg-muted/5 border-b border-border/40 animate-in slide-in-from-top-2 fade-in duration-200">
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
                  className={"h-9 shrink-0 flex items-center justify-center cursor-pointer px-4 rounded-full text-[13px] font-medium transition-all duration-200 ease-out active:scale-[0.96] border " + (isActive ? activeClass : "bg-transparent text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground")}
                  onClick={() => setActionFilter(filter)}
                >
                  {filter}
                </button>
              );
            })}
          </div>

          <div className={`ml-auto flex items-center h-9 bg-muted/60 p-1 rounded-full border border-border/50 relative shadow-inner transition-opacity duration-200 ${actionFilter === "Today" ? "opacity-100" : "hidden opacity-0 pointer-events-none"}`}>
            {[
              { id: "pending", label: "Follow Up" },
              { id: "completed", label: "Followed Up" }
            ].map((mode) => {
              const isSelected = todayViewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setTodayViewMode(mode.id as "pending" | "completed")}
                  className={`relative h-full flex items-center px-4 rounded-full text-[12px] font-bold transition-colors duration-300 z-10 active:scale-[0.96] ${isSelected ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="hrTodayToggleBgDesktop"
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

      {/* Table */}
      <div className="w-full md:flex-1 md:min-h-0 md:overflow-hidden">
        {isLoading ? <TableSkeleton /> : (
          <DataTable
            flush
            columns={columns}
            data={displayedCandidates}
            showToolbar={true}
            showDeleteAction={role === "Admin"}
            onDeleteSelected={(rows) => setBulkDeleteIds(rows.map(r => r.id))}
            renderToolbarActions={(selectedRows) => {
              if (selectedRows.length !== 1) return null;
              const row = selectedRows[0];
              return (
                <>
                  <Button variant="outline" size="sm" onClick={() => router.push("/hr/" + row.id)}>
                    <Eye size={15} className="mr-1.5" /> View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push("/hr/new?edit=" + row.id)}>
                    <Edit size={15} className="mr-1.5" /> Edit
                  </Button>
                </>
              );
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      <MobileHeader title="HR Panel" />

      <div className="flex flex-col space-y-4 md:space-y-6 md:flex-1 md:min-h-0">
        {/* Desktop page header */}
        <Device
          mobile={null}
          desktop={
            <div className="flex h-[48px] items-center justify-between pr-[150px]">
              <h1 className="text-[28px] font-bold tracking-tight">HR Panel</h1>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border/60" onClick={fetchCandidates} title="Refresh">
                  <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                </Button>
                <Link href="/hr/new" className="inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95">
                  <Plus size={18} />
                  Add New Candidate
                </Link>
              </div>
            </div>
          }
        />

        {/* Filters + Table */}
        <Device mobile={mobileFilters} desktop={desktopFilters} />

        {/* Mobile table */}
        <Device
          desktop={null}
          mobile={
            <div className="w-full px-4 pb-4">
              {isLoading ? <TableSkeleton /> : (
                <DataTable
                  flush
                  columns={columns}
                  data={displayedCandidates}
                  showToolbar={true}
                  showDeleteAction={role === "Admin"}
                  onDeleteSelected={(rows) => setBulkDeleteIds(rows.map(r => r.id))}
                  renderToolbarActions={(selectedRows) => {
                    if (selectedRows.length !== 1) return null;
                    const row = selectedRows[0];
                    return (
                      <>
                        <Button variant="outline" size="sm" onClick={() => router.push("/hr/" + row.id)}>
                          <Eye size={15} className="mr-1.5" /> View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => router.push("/hr/new?edit=" + row.id)}>
                          <Edit size={15} className="mr-1.5" /> Edit
                        </Button>
                      </>
                    );
                  }}
                />
              )}
            </div>
          }
        />
      </div>

      <Dialog open={bulkDeleteIds !== null} onOpenChange={(open) => !open && setBulkDeleteIds(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Candidate(s)</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds?.length} candidate(s)? This action cannot be undone.
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
