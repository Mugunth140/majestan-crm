"use client";

import { extraColumns } from "@/components/tables/extra-columns";
import { isAdmin as isAdminUser } from "@/lib/permissions";
import { apiFetch } from "@/lib/api-fetch";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/tables/data-table";
import { ModuleMobileRows, ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { moveRow } from "@/lib/move-row";
import { IdCell, NameCell, StatusCell, statusDot, type StatusTone } from "@/components/tables/cells";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { Plus, Search, Eye, Filter, X } from "lucide-react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ListFrame, ListToolbar, ToolbarEnd, ToolbarSearch, headerPrimaryClass, toolbarFilterButton } from "@/components/layout/list-page";
import { ClearFilters, FilterStrip, QuickFilter, toOptions } from "@/components/shared/quick-filters";
import { PageActions } from "@/components/layout/page-actions";
import { Device } from "@/components/shared/device";
import { NewAgentModal } from "@/components/agents/new-agent-modal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const STATUS_TONES: Record<string, StatusTone> = {
  "New": "gray",
  "Contacted": "blue",
  "Meeting Done": "violet",
  "Documents Pending": "amber",
  "Approved": "green",
  "Active": "green",
  "Hold": "amber",
  "Rejected": "red",
};

const AGENT_FIELDS: ViewField[] = [
  { id: "status", label: "Status", get: (a) => a.status, order: Object.keys(STATUS_TONES), dot: (v) => statusDot(v, STATUS_TONES[v]) },
  { id: "partner_type", label: "Partner type", get: (a) => a.partner_type?.replace(/_/g, " "), capitalize: true },
  { id: "company", label: "Company", get: (a) => a.company_name },
];

export default function AgentsPage() {
  const router = useRouter();
  const views = useModuleView("agents", AGENT_FIELDS);
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [role, setRole] = useState<string>("");

  const [searchQuery, setSearchQuery] = usePersistedState("agents:search", "");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [filters, setFilters] = usePersistedState("agents:filters", { partnerType: "", status: "" });


  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
        setRole(user?.role?.name || user?.role || "");
        setIsAdmin(isAdminUser(user));
      } catch {}
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(API_URL + "/agents");
      const data = await res.json();
      if (data.success) {
        setAgents(data.data);
      }
    } catch {
      toast.error("Failed to load agents.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); window.scrollTo(0, 0); const main = document.querySelector("main"); if (main) main.scrollTop = 0; }, [fetchAgents]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await apiFetch(`${API_URL}/agents/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Agent deleted successfully.");
        fetchAgents();
      } else {
        toast.error(data.message || "Failed to delete agent.");
      }
    } catch {
      toast.error("An error occurred while deleting.");
    } finally {
      setDeleteId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const promises = bulkDeleteIds.map(id => apiFetch(`${API_URL}/agents/${id}`, { method: "DELETE" }));
      await Promise.all(promises);
      toast.success(`${bulkDeleteIds.length} agent(s) deleted successfully`);
      fetchAgents();
    } catch {
      toast.error("Failed to delete some or all agents");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
    }
  };

  const displayedAgents = useMemo(() => {
    let filtered = agents;

    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(q) ||
        String(a.mobile).includes(q) ||
        (a.company_name && a.company_name.toLowerCase().includes(q)) ||
        String(a.id).includes(q)
      );
    }

    if (filters.partnerType) filtered = filtered.filter(a => a.partner_type === filters.partnerType);
    if (filters.status) filtered = filtered.filter(a => a.status === filters.status);

    return filtered;
  }, [agents, debouncedSearchQuery, filters]);

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
        <IdCell href={`/agent-network/${row.original.id}`}>A{String(row.original.id).padStart(5, "0")}</IdCell>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <NameCell name={row.original.name} avatar />
      ),
    },
    {
      accessorKey: "company_name",
      header: "Company",
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.company_name || "\u2014"}</span>,
    },
    {
      accessorKey: "mobile",
      header: "Mobile",
      cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{row.original.mobile}</span>,
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
        return <StatusCell status={s} tone={STATUS_TONES[s] ?? "gray"} />;
      }
    },
    ...extraColumns([
      { id: "email", label: "Email", value: (r) => r.email },
      { id: "whatsapp", label: "WhatsApp", value: (r) => r.whatsapp },
      { id: "city", label: "City", value: (r) => r.city },
      { id: "state", label: "State", value: (r) => r.state },
      { id: "property_category", label: "Category", value: (r) => r.property_category, kind: "label" },
      { id: "commission", label: "Commission", value: (r) => r.commission, kind: "label" },
      { id: "staff", label: "Assigned staff", value: (r) => (r.staff === "Unassigned" ? null : r.staff) },
      { id: "nextFollowUp", label: "Next follow-up", value: (r) => r.nextFollowUpDate, kind: "date" },
      { id: "lastFollowUp", label: "Last follow-up", value: (r) => r.lastFollowedUpDate, kind: "date" },
      { id: "created_at", label: "Added on", value: (r) => r.created_at, kind: "date" },
    ]),
  ];

  const uniquePartnerTypes = Array.from(new Set(agents.map(a => a.partner_type).filter(c => c && c !== "—")));
  const uniqueStatuses = Array.from(new Set(agents.map(a => a.status).filter(Boolean)));
  const activeFiltersCount = Object.values(filters).filter(v => v !== "").length;
  const clearFilters = () => setFilters({ partnerType: "", status: "" });

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
          <h4 className="font-semibold text-foreground text-sm">Filter Agents</h4>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground hover:text-red-600">
              Clear All
            </Button>
          )}
        </div>
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Partner Type</label>
            <FormSelect
              name="filterType"
              placeholder="Any Partner Type"
              options={uniquePartnerTypes.map((c: any) => ({ label: String(c).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), value: c }))}
              value={filters.partnerType}
              onValueChange={(v) => setFilters(f => ({ ...f, partnerType: v || "" }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</label>
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
  );

  type Row = (typeof displayedAgents)[number];
  const rowCard = (a: Row) => ({ title: a.name, id: `A${String(a.id).padStart(5, "0")}`, href: `/agent-network/${a.id}`, subtitle: a.mobile, footer: a.company_name, tag: a.partner_type?.replace(/_/g, " ") });
  const openRow = (a: Row) => router.push(`/agent-network/${a.id}`);

  const mobileFilters = (
    <div className="px-4 pb-2 space-y-3">
      {/* Search & Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground" />
          <Input
            placeholder="Search Agents..."
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

    </div>
  );

  const desktopFilters = (
    <ListFrame>
      <ListToolbar className="md:flex-nowrap">
        <FilterStrip>
          <QuickFilter label="Partner type" value={filters.partnerType} onChange={(v) => setFilters((f) => ({ ...f, partnerType: v }))}
            options={uniquePartnerTypes.map((c: any) => ({ label: String(c).replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()), value: c }))} />
          <QuickFilter label="Status" value={filters.status} options={toOptions(uniqueStatuses as string[])} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
          <ClearFilters show={activeFiltersCount > 0 || !!searchQuery} onClick={() => { clearFilters(); setSearchQuery(""); }} />
        </FilterStrip>
        <ToolbarEnd>
          {views.picker}
          <ToolbarSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search ID, Name, Phone, Company" className="md:[&_input]:w-56" />
        </ToolbarEnd>
      </ListToolbar>


      {/* Table */}
      <div className="flex w-full min-w-0 flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
        {isLoading ? <TableSkeleton columns={6} rows={5} flush /> : (
          <ModuleViews
            state={views}
            data={displayedAgents}
            columns={columns}
            list={
              <DataTable
              variant="list"
              columns={columns}
              data={displayedAgents}
              showToolbar={true}
              showDeleteAction={isAdmin}
              onDeleteSelected={(rows) => setBulkDeleteIds(rows.map(r => r.id))}
              renderToolbarActions={(selectedRows) => {
                if (selectedRows.length !== 1) return null;
                const row = selectedRows[0];
                return (
                  <Button variant="outline" size="sm" onClick={() => router.push(`/agent-network/${row.id}`)}>
                    <Eye size={15} className="mr-1.5" /> View
                  </Button>
                );
              }}
            />
            }
            getKey={(a) => a.id}
            onOpen={openRow}
            onMove={(a, status) =>
              moveRow({ setRows: setAgents, row: a, same: (x, y) => x.id === y.id, patch: { status }, request: { path: `/agents/${a.id}/status`, method: "PUT", body: { status_name: status } }, success: `Moved to ${status}` })
            }
            card={rowCard}
            noun="agents"
          />
        )}
      </div>
    </ListFrame>
  );

  return (
    <>
      <MobileHeader title="Agent Network" />
      {views.switcher}

      <div className="flex flex-col space-y-4 md:space-y-0 md:h-full">
        {/* Desktop page header */}
        <PageActions>
          <button type="button" onClick={() => setCreating(true)} className={headerPrimaryClass}>
            <Plus className="size-4" />
            Add Agent
          </button>
        </PageActions>

        {/* Filters + Table */}
        <Device mobile={mobileFilters} desktop={desktopFilters} />

        {/* Mobile table */}
        <Device
          desktop={null}
          mobile={
            <ModuleMobileRows state={views} card={rowCard} onOpen={openRow}>
            <div className="w-full pb-4">
              {isLoading ? <TableSkeleton columns={6} rows={5} /> : (
                <DataTable
                  flush
                  columns={columns}
                  data={displayedAgents}
                  showToolbar={true}
                  showDeleteAction={isAdmin}
                  onDeleteSelected={(rows) => setBulkDeleteIds(rows.map(r => r.id))}
                  renderToolbarActions={(selectedRows) => {
                    if (selectedRows.length !== 1) return null;
                    const row = selectedRows[0];
                    return (
                      <Button variant="outline" size="sm" onClick={() => router.push(`/agent-network/${row.id}`)}>
                        <Eye size={15} className="mr-1.5" /> View
                      </Button>
                    );
                  }}
                />
              )}
            </div>
            </ModuleMobileRows>
          }
        />
      </div>

      <Dialog open={deleteId !== null || bulkDeleteIds !== null} onOpenChange={(open) => {
        if (!open) { setDeleteId(null); setBulkDeleteIds(null); }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Agent(s)</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} agent(s)` : 'this agent'}? This action cannot be undone and will remove all associated logs and follow-ups.
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
      <NewAgentModal open={creating} onOpenChange={setCreating} onCreated={(id) => { if (id) router.push(`/agent-network/${id}`); }} />
    </>
  );
}
