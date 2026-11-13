"use client";
import { isAdmin } from "@/lib/permissions";
import { useState, useEffect, useCallback, useRef } from "react";
import { DataTable } from "@/components/tables/data-table";
import { BOARD_PAGE, ModuleMobileRows, ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { moveRow } from "@/lib/move-row";
import { IdCell, NameCell, StatusCell, statusDot } from "@/components/tables/cells";
import { HR_STATUS_TONES } from "@/lib/hr-status";
import { useClampedPage, usePersistedState } from "@/hooks/use-persisted-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Search, Filter, X, FileSpreadsheet } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { CandidateForm } from "./_components/CandidateForm";
import { HrAssignmentDialog } from "@/components/hr/hr-assignment-dialog";
import { HrBulkImportDialog, HrImportReview } from "@/components/hr/hr-bulk-import";
import type { HrImportRow } from "@/lib/hr-import";
import { apiFetch, apiJson } from "@/lib/api-fetch";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ListFrame, ListToolbar, SegmentTabs, ToolbarEnd, ToolbarSearch, headerButtonClass, headerPrimaryClass, toolbarFilterButton } from "@/components/layout/list-page";
import { ClearFilters, DateQuickFilter, FilterDivider, FilterStrip, QuickFilter, TextQuickFilter, toOptions } from "@/components/shared/quick-filters";
import { PageActions } from "@/components/layout/page-actions";
import { Device } from "@/components/shared/device";
import { StaffName } from "@/components/shared/name-avatar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const STATUS_TONES = HR_STATUS_TONES;

/** Choices for the filters, from every candidate; the server sends them with each page. */
type HrFilterOptions = { departments: string[]; statuses: string[]; staff: { value: string; label: string }[] };
const EMPTY_FILTER_OPTIONS: HrFilterOptions = { departments: [], statuses: [], staff: [] };

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
  const [creating, setCreating] = useState(false);
  // Every candidate's mobile, loaded only while an import is under review (duplicate check).
  const [knownMobiles, setKnownMobiles] = useState<{ mobile: string }[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [filterOptions, setFilterOptions] = useState<HrFilterOptions>(EMPTY_FILTER_OPTIONS);
  const [pagination, setPagination] = usePersistedState("hr:page", { pageIndex: 0, pageSize: 20 });

  const [activeTab, setActiveTab] = usePersistedState<string>("hr:tab", "All Candidates", { allowed: ["All Candidates", "Rejected"] });
  const [searchQuery, setSearchQuery] = usePersistedState("hr:search", "");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

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
    staff: "",
    position: "",
  });

  const tabs = ["All Candidates", "Rejected"];

  // The server filters and pages; only the newest request may fill the table.
  const latestRequest = useRef(0);
  const fetchCandidates = useCallback(() => {
    const request = ++latestRequest.current;
    const page = views.isBoard ? BOARD_PAGE : pagination;
    const params = new URLSearchParams({ page: String(page.pageIndex + 1), limit: String(page.pageSize), tab: activeTab });
    if (debouncedSearchQuery.trim()) params.set("search", debouncedSearchQuery.trim());
    for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
    setIsLoading(true);
    apiFetch(`${API_URL}/hr?${params}`)
      .then(res => { if (!res.ok) throw new Error("Failed to load candidates"); return res.json(); })
      .then(data => {
        if (request !== latestRequest.current) return;
        setCandidates((data.data ?? []).map((c: any) => ({ ...c, formattedId: "HRC" + String(c.id).padStart(4, "0") })));
        setTotalCount(data.meta?.total ?? 0);
        setFilterOptions(data.meta?.filterOptions ?? EMPTY_FILTER_OPTIONS);
      })
      .catch(() => { if (request === latestRequest.current) toast.error("Failed to load candidates. Please refresh to try again."); })
      .finally(() => { if (request === latestRequest.current) setIsLoading(false); });
  }, [views.isBoard, pagination, activeTab, debouncedSearchQuery, filters]);

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

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);
  useClampedPage(pagination, setPagination, totalCount, isLoading);

  // A new search, filter or tab starts again from the first page (a restored page is kept).
  const filterKey = JSON.stringify([debouncedSearchQuery.trim(), filters, activeTab]);
  const lastFilterKey = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKey.current === filterKey) return;
    lastFilterKey.current = filterKey;
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
  }, [filterKey, setPagination]);

  useEffect(() => {
    // Scroll to top on mount (mobile body scroll + desktop main scroll)
    window.scrollTo(0, 0);
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, []);

  useEffect(() => {
    if (!pendingImports.length) return;
    let live = true;
    apiJson<{ data: string[] }>(`${API_URL}/hr/mobiles`)
      .then((res) => { if (live) setKnownMobiles(res.data.map((mobile) => ({ mobile }))); })
      .catch(() => { if (live) { toast.error("Couldn't check the import for existing candidates."); setKnownMobiles([]); } });
    return () => { live = false; };
  }, [pendingImports.length]);

  const displayedCandidates = candidates;

  const uniqueDepartments = filterOptions.departments;
  const uniqueStatuses = filterOptions.statuses;
  const activeFiltersCount = Object.values(filters).filter(v => v !== "").length;
  const staffOptions = filterOptions.staff;
  const clearFilters = () => setFilters({ dateFrom: "", dateTo: "", department: "", status: "", staff: "", position: "" });

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
    { accessorKey: "name", header: "Name", cell: ({ row }: any) => <NameCell name={row.original.name} avatar /> },
    { accessorKey: "mobile", header: "Mobile", cell: ({ row }: any) => <span className="tabular-nums">{row.original.mobile}</span> },
    { id: "assignee", header: "Assigned staff", cell: ({ row }: any) => (
      <button type="button" disabled={!canAssign} onClick={() => setAssignmentIds([row.original.id])}
        className="text-left text-sm disabled:cursor-default enabled:hover:underline">
        <StaffName name={row.original.assignedStaff?.name} userId={row.original.assignedStaff?.id} />
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
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Assigned Staff</label>
            <FormSelect name="staff" options={staffOptions} value={filters.staff} onValueChange={v => setFilters(f => ({...f, staff: v || ""}))} placeholder="All Staff" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Position</label>
            <Input value={filters.position} onChange={e => setFilters(f => ({...f, position: e.target.value}))} placeholder="e.g. Telecaller" className="h-9 rounded-lg text-sm" />
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

    </div>
  );

  const desktopFilters = (
    <ListFrame>
      <ListToolbar className="md:flex-nowrap">
        <SegmentTabs tabs={tabs} value={activeTab} onChange={setActiveTab} label="Views" />
        <FilterDivider />
        <FilterStrip>
          <DateQuickFilter label="Created" from={filters.dateFrom} to={filters.dateTo} onChange={(dateFrom, dateTo) => setFilters((f) => ({ ...f, dateFrom, dateTo }))} />
          <QuickFilter label="Status" value={filters.status} options={toOptions(uniqueStatuses as string[])} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
          <QuickFilter label="Department" value={filters.department} options={toOptions(uniqueDepartments as string[])} onChange={(v) => setFilters((f) => ({ ...f, department: v }))} />
          <QuickFilter label="Assigned staff" value={filters.staff} options={staffOptions} onChange={(v) => setFilters((f) => ({ ...f, staff: v }))} />
          <TextQuickFilter label="Position" value={filters.position} placeholder="e.g. Telecaller" onChange={(v) => setFilters((f) => ({ ...f, position: v }))} />
          <ClearFilters show={activeFiltersCount > 0 || !!searchQuery} onClick={() => { clearFilters(); setSearchQuery(""); }} />
        </FilterStrip>
        <ToolbarEnd>
          {views.picker}
          <ToolbarSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search ID, Name, Phone" className="md:[&_input]:w-56" />
        </ToolbarEnd>
      </ListToolbar>


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
              manualPagination
              pageCount={Math.ceil(totalCount / pagination.pageSize) || 1}
              totalCount={totalCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              showDeleteAction={isAdmin({ role })}
              onDeleteSelected={(rows) => setBulkDeleteIds(rows.map(r => r.id))}
              renderToolbarActions={(selectedRows) => {
                if (!selectedRows.length) return null;
                const row = selectedRows[0];
                return <>
                  {canAssign && <Button variant="outline" size="sm" onClick={() => setAssignmentIds(selectedRows.map(item => item.id))}>Assign Selected</Button>}
                  {selectedRows.length === 1 && <>
                    <Button variant="outline" size="sm" onClick={() => router.push("/hr/" + row.id)}><Eye size={15} className="mr-1.5" /> View</Button>
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
            totalCount={totalCount}
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
          <button type="button" onClick={() => setCreating(true)} className={headerPrimaryClass}>
            <Plus className="size-4" />
            Add Candidate
          </button>
        </PageActions>

        <Device desktop={null} mobile={
          <div className="px-4"><Button variant="outline" onClick={() => setIsImportOpen(true)} disabled={pendingImports.length > 0}
            className="h-12 rounded-full px-5 gap-2"><FileSpreadsheet size={16} />Bulk Import</Button></div>
        } />
        {pendingImports.length > 0 ? (
          knownMobiles === null ? <TableSkeleton /> :
          <HrImportReview rows={pendingImports} existing={knownMobiles} onCancel={() => { setPendingImports([]); setKnownMobiles(null); }}
            onImported={() => { setPendingImports([]); setKnownMobiles(null); setActiveTab("All Candidates"); setSearchQuery(""); clearFilters(); fetchCandidates(); }} />
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
                  manualPagination
                  pageCount={Math.ceil(totalCount / pagination.pageSize) || 1}
                  totalCount={totalCount}
                  pagination={pagination}
                  onPaginationChange={setPagination}
                  showDeleteAction={isAdmin({ role })}
                  onDeleteSelected={(rows) => setBulkDeleteIds(rows.map(r => r.id))}
                  renderToolbarActions={(selectedRows) => {
              if (!selectedRows.length) return null;
              const row = selectedRows[0];
              return <>
                {canAssign && <Button variant="outline" size="sm" onClick={() => setAssignmentIds(selectedRows.map(item => item.id))}>Assign Selected</Button>}
                {selectedRows.length === 1 && <>
                  <Button variant="outline" size="sm" onClick={() => router.push("/hr/" + row.id)}><Eye size={15} className="mr-1.5" /> View</Button>
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
      {creating && <CandidateForm onClose={() => setCreating(false)} onCreated={(id) => router.push(id ? `/hr/${id}` : "/hr")} />}
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
