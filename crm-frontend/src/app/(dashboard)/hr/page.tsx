"use client";
import { isAdmin } from "@/lib/permissions";
import { useState, useEffect, useMemo } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ModuleMobileRows, ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { moveRow } from "@/lib/move-row";
import { IdCell, NameCell, StatusCell, statusDot } from "@/components/tables/cells";
import { HR_STATUS_TONES } from "@/lib/hr-status";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Edit, Search, Filter, X, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { motion } from "motion/react";
import { useDebounce } from "@/hooks/use-debounce";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { HrAssignmentDialog } from "@/components/hr/hr-assignment-dialog";
import { HrBulkImportDialog, HrImportReview } from "@/components/hr/hr-bulk-import";
import type { HrImportRow } from "@/lib/hr-import";
import { apiFetch, apiJson } from "@/lib/api-fetch";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ListFrame, ListToolbar, SegmentTabs, ToolbarEnd, ToolbarSearch, headerButtonClass, headerPrimaryClass, toolbarFilterButton } from "@/components/layout/list-page";
import { PageActions } from "@/components/layout/page-actions";
import { Device } from "@/components/shared/device";
import { matchesHrActionFilter, formatHrFollowUp } from "@/lib/hr-action-required";
import { ACTION_FILTERS, getActionFilterLabel } from "@/lib/action-filters";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const STATUS_TONES = HR_STATUS_TONES;

const HR_FIELDS: ViewField[] = [
  { id: "status", label: "Status", get: (c) => c.status, order: Object.keys(STATUS_TONES), dot: (v) => statusDot(v, STATUS_TONES[v]) },
  { id: "assignee", label: "Assigned staff", get: (c) => c.assignedStaff?.name || "Unassigned" },
  { id: "department", label: "Department", get: (c) => c.department },
  { id: "position", label: "Position", get: (c) => c.position },
];

export default function HrPage() {
  const router = useRouter();
  const views = useModuleView("hr", HR_FIELDS);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [pendingImports, setPendingImports] = useState<HrImportRow[]>([]);

  const [activeTab, setActiveTab] = usePersistedState<string>("hr:tab", "All Candidates", { allowed: ["All Candidates", "Action Required", "Rejected"] });
  const [actionFilter, setActionFilter] = usePersistedState<string>("hr:actionFilter", "Today", { allowed: ACTION_FILTERS });
  const [searchQuery, setSearchQuery] = usePersistedState("hr:search", "");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [todayViewMode, setTodayViewMode] = usePersistedState<"pending" | "completed">("hr:todayViewMode", "pending", { allowed: ["pending", "completed"] });

  const [assignmentIds, setAssignmentIds] = useState<number[] | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [role, setRole] = useState<string>("");
  const canAssign = ["Super Admin", "Admin", "Manager", "Team Lead"].includes(role);
  const assignCandidates = async (staffId: number | null) => {
    if (!assignmentIds?.length) return;
    setIsAssigning(true);
    try {
      await apiJson(`${API_URL}/hr/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateIds: assignmentIds, assignedStaffId: staffId }) });
      toast.success(`${assignmentIds.length} candidate(s) ${staffId === null ? "unassigned" : "assigned"}.`);
      setAssignmentIds(null); fetchCandidates();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Assignment failed"); }
    finally { setIsAssigning(false); }
  };
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

  const [filters, setFilters] = usePersistedState("hr:filters", {
    dateFrom: "",
    dateTo: "",
    department: "",
    status: "",
  });

  const tabs = ["All Candidates", "Action Required", "Rejected"];
  const actionFilters = [...ACTION_FILTERS];

  const fetchCandidates = () => {
    setIsLoading(true);
    apiFetch(`${API_URL}/hr`)
      .then(res => { if (!res.ok) throw new Error("Failed to load candidates"); return res.json(); })
      .then(data => {
        const mapped = data.map((c: any) => ({
          ...c,
          formattedId: "HRC" + String(c.id).padStart(4, "0")
        }));
        setCandidates(mapped);
      })
      .catch(() => toast.error("Failed to load candidates. Please refresh to try again."))
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
      return filtered.filter(candidate =>
        (filters.status || !["Joined", "Rejected"].includes(candidate.status)) &&
        matchesHrActionFilter(candidate, actionFilter, todayViewMode)
      );
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
    {
      accessorKey: "formattedId",
      header: "ID",
      cell: ({ row }: any) => (
        <IdCell href={`/hr/${row.original.id}`}>{row.getValue("formattedId")}</IdCell>
      ),
    },
    ...(activeTab === "Action Required" ? [{
      id: "followUpDate",
      header: actionFilter === "Yesterday" || (actionFilter === "Today" && todayViewMode === "completed")
        ? "Followed Up" : "Next Follow Up",
      cell: ({ row }: any) => {
        const completed = actionFilter === "Yesterday" || (actionFilter === "Today" && todayViewMode === "completed");
        return formatHrFollowUp(
          completed ? row.original.lastFollowedUpDate : row.original.nextFollowUpDate,
          completed ? row.original.lastFollowedUpTime : row.original.nextFollowUpTime,
        );
      },
    }] : []),
    { accessorKey: "name", header: "Name", cell: ({ row }: any) => <NameCell name={row.original.name} avatar /> },
    { accessorKey: "mobile", header: "Mobile", cell: ({ row }: any) => <span className="tabular-nums">{row.original.mobile}</span> },
    { id: "assignee", header: "Assigned staff", cell: ({ row }: any) => (
      <button type="button" disabled={!canAssign} onClick={() => setAssignmentIds([row.original.id])}
        className="text-left text-sm disabled:cursor-default enabled:text-[#0052FF] enabled:hover:underline">
        {row.original.assignedStaff ? `#${row.original.assignedStaff.id} ${row.original.assignedStaff.name}` : "Unassigned"}
      </button>
    ) },
    { accessorKey: "department", header: "Department" },
    { accessorKey: "position", header: "Position" },
    { accessorKey: "experience", header: "Experience" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => {
        const s = row.getValue("status") as string;
        return <StatusCell status={s} tone={STATUS_TONES[s] ?? "gray"} />;
      },
    }
  ];

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

  type Row = (typeof displayedCandidates)[number];
  const rowCard = (c: Row) => ({ title: c.name, id: c.formattedId, href: `/hr/${c.id}`, subtitle: c.mobile, footer: c.assignedStaff?.name ?? <span className="text-muted-foreground">Unassigned</span>, tag: c.position });
  const openRow = (c: Row) => router.push(`/hr/${c.id}`);

  const mobileFilters = (
    <div className="px-4 pb-2 space-y-3">
      {/* Search & Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground" />
          <Input
            placeholder="Search HR..."
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

      {/* Pill Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {tabs.map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 h-10 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all border active:scale-95 ${isActive ? "bg-[#017D58] text-white dark:bg-[#2FB585] dark:text-black" : "bg-foreground/[0.06] text-foreground"}`}
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
    <ListFrame>
      <ListToolbar>
        <SegmentTabs tabs={tabs} value={activeTab} onChange={setActiveTab} label="Views" />
        <ToolbarEnd>
          {views.picker}
          <ToolbarSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search ID, Name, Phone" />
          {renderFilterPopover(false)}
        </ToolbarEnd>
      </ListToolbar>

      {/* Action Required Row */}
      {activeTab === "Action Required" && (
        <div className="flex flex-wrap items-center gap-2 px-5 pb-1 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="flex h-10 items-center gap-2 overflow-x-auto scrollbar-hide">
            {actionFilters.map((filter) => {
              const isActive = actionFilter === filter;
              let activeClass = "bg-primary/10 text-primary border-primary/30";
              if (filter === "Overdue" && isActive) activeClass = "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400";
              else if (filter === "Yesterday" && isActive) activeClass = "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300";
              else if (filter === "Today" && isActive) activeClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400";
              return (
                <button
                  key={filter}
                  className={"h-10 shrink-0 flex items-center justify-center cursor-pointer px-5 rounded-full text-[13.5px] font-medium leading-none transition-all duration-200 ease-out active:scale-[0.96] border " + (isActive ? activeClass : "bg-transparent text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground")}
                  onClick={() => setActionFilter(filter)}
                >
                  {getActionFilterLabel(filter)}
                </button>
              );
            })}
          </div>

          <div className={`ml-auto flex h-10 shrink-0 self-center items-center bg-muted/60 p-0.5 rounded-full border border-border/50 relative shadow-inner transition-opacity duration-200 ${actionFilter === "Today" ? "opacity-100" : "hidden opacity-0 pointer-events-none"}`}>
            {[
              { id: "pending", label: "Follow Up" },
              { id: "completed", label: "Followed Up" }
            ].map((mode) => {
              const isSelected = todayViewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setTodayViewMode(mode.id as "pending" | "completed")}
                  className={`relative h-full flex items-center px-4 rounded-full text-[13px] font-bold leading-none transition-colors duration-300 z-10 active:scale-[0.96] ${isSelected ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="hrTodayToggleBgDesktop"
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
        {isLoading ? <TableSkeleton flush /> : (
          <ModuleViews
            state={views}
            data={displayedCandidates}
            columns={columns}
            list={
              <DataTable
              variant="list"
              columns={columns}
              data={displayedCandidates}
              showToolbar={true}
              showDeleteAction={isAdmin({ role })}
              onDeleteSelected={(rows) => setBulkDeleteIds(rows.map(r => r.id))}
              renderToolbarActions={(selectedRows) => {
                if (!selectedRows.length) return null;
                const row = selectedRows[0];
                return <>
                  {canAssign && <Button variant="outline" size="sm" onClick={() => setAssignmentIds(selectedRows.map(item => item.id))}>Assign Selected</Button>}
                  {selectedRows.length === 1 && <>
                    <Button variant="outline" size="sm" onClick={() => router.push("/hr/" + row.id)}><Eye size={15} className="mr-1.5" /> View</Button>
                    <Button variant="outline" size="sm" onClick={() => router.push("/hr/new?edit=" + row.id)}><Edit size={15} className="mr-1.5" /> Edit</Button>
                  </>}
                </>;
              }}
            />
            }
            getKey={(c) => c.id}
            onOpen={openRow}
            onMove={(c, status) =>
              moveRow({ setRows: setCandidates, row: c, same: (a, b) => a.id === b.id, patch: { status }, request: { path: `/hr/${c.id}`, method: "PATCH", body: { status } }, success: `Moved to ${status}` })
            }
            card={rowCard}
            noun="candidates"
          />
        )}
      </div>
    </ListFrame>
  );

  return (
    <>
      <MobileHeader title="HR Panel" />
      {views.switcher}

      <div className="flex flex-col space-y-4 md:space-y-0 md:h-full">
        {/* Desktop page header */}
        <PageActions>
          <button type="button" onClick={() => setIsImportOpen(true)} disabled={pendingImports.length > 0} className={headerButtonClass}>
            <FileSpreadsheet className="size-[15px] text-muted-foreground" />
            Bulk Import
          </button>
          <Link href="/hr/new" className={headerPrimaryClass}>
            <Plus className="size-4" />
            Add Candidate
          </Link>
        </PageActions>

        <Device desktop={null} mobile={
          <div className="px-4"><Button variant="outline" onClick={() => setIsImportOpen(true)} disabled={pendingImports.length > 0}
            className="h-12 rounded-full px-5 gap-2"><FileSpreadsheet size={16} />Bulk Import</Button></div>
        } />
        {pendingImports.length > 0 ? (
          <HrImportReview rows={pendingImports} existing={candidates} onCancel={() => setPendingImports([])}
            onImported={() => { setPendingImports([]); setActiveTab("All Candidates"); setSearchQuery(""); clearFilters(); fetchCandidates(); }} />
        ) : (<>
        {/* Filters + Table */}
        <Device mobile={mobileFilters} desktop={desktopFilters} />

        {/* Mobile table */}
        <Device
          desktop={null}
          mobile={
            <ModuleMobileRows state={views} card={rowCard} onOpen={openRow}>
            <div className="w-full pb-4">
              {isLoading ? <TableSkeleton /> : (
                <DataTable
                  flush
                  columns={columns}
                  data={displayedCandidates}
                  showToolbar={true}
                  showDeleteAction={isAdmin({ role })}
                  onDeleteSelected={(rows) => setBulkDeleteIds(rows.map(r => r.id))}
                  renderToolbarActions={(selectedRows) => {
              if (!selectedRows.length) return null;
              const row = selectedRows[0];
              return <>
                {canAssign && <Button variant="outline" size="sm" onClick={() => setAssignmentIds(selectedRows.map(item => item.id))}>Assign Selected</Button>}
                {selectedRows.length === 1 && <>
                  <Button variant="outline" size="sm" onClick={() => router.push("/hr/" + row.id)}><Eye size={15} className="mr-1.5" /> View</Button>
                  <Button variant="outline" size="sm" onClick={() => router.push("/hr/new?edit=" + row.id)}><Edit size={15} className="mr-1.5" /> Edit</Button>
                </>}
              </>;
            }}
                />
              )}
            </div>
            </ModuleMobileRows>
          }
        />
        </>)}
      </div>
      <HrAssignmentDialog open={assignmentIds !== null} count={assignmentIds?.length || 0} busy={isAssigning} onClose={() => setAssignmentIds(null)} onConfirm={assignCandidates} />
      <HrBulkImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} onParsed={setPendingImports} />

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
