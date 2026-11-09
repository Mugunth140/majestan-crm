"use client";

import { isAdmin } from "@/lib/permissions";
import { apiFetch, apiJson } from "@/lib/api-fetch";
import { normalizeDepartment } from "@/lib/department";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, FileSpreadsheet, RefreshCw, Search, Filter, X, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { DateQuickFilter, FilterStrip, QuickFilter, RangeQuickFilter } from "@/components/shared/quick-filters";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { AssignLeadModal } from "@/components/shared/assign-lead-modal";
import { ContactModal } from "@/components/shared/contact-modal";
import { PageActions } from "@/components/layout/page-actions";
import { MobileHeader } from "@/components/layout/mobile-header";
import { LastFollowupCell } from "./last-followup-column";
import { Device } from "@/components/shared/device";
import { LEAD_STATUS_DOTS, LEAD_STATUS_ORDER, leadStatusPill } from "@/lib/lead-constants";
import { StatusCell, statusDot } from "@/components/tables/cells";
import { ViewSwitcher, type ViewType } from "@/components/views/view-switcher";
import { LeadsKanban, leadCard, type KanbanLead } from "@/components/leads/leads-kanban";
import { MobileRowsProvider, type MobileRowData } from "@/components/mobile/mobile-rows";
import { NameAvatar } from "@/components/shared/name-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { GroupedList } from "@/components/tables/grouped-list";
import { ImportDialog } from "@/components/shared/import-dialog";
import { NewLeadModal } from "@/components/leads/new-lead-modal";
import { GroupByPicker, LEAD_GROUP_FIELDS, type LeadGroupField } from "@/components/leads/group-by-picker";
import { getBulkImportDestination, mapImportSheetRow, resolveLeadImportSource, normalizeIndianMobile, partitionPendingImports, resolveStaffAssignments } from "@/lib/lead-import";
import type { DuplicateLeadInfo, PendingImportRow, StaffOption, LeadImportSource } from "@/lib/lead-import";
import { resetPageIndex } from "@/lib/pagination";
import { usePersistedState } from "@/hooks/use-persisted-state";

// The row shape produced by mapImportSheetRow, plus the legacy optional fields
// this page still reads (or older rows still carry) from imported leads. Aliasing
// the exported row type keeps producer and consumer linked by the compiler.
type PendingImport = PendingImportRow & {
  // Legacy fields (optional)
  whatsapp?: string;
  city?: string;
  address?: string;
  commission?: number;
  isReferral?: boolean;
  referredByName?: string;
  referredByContact?: string;
  propertyCategory?: string;
  propertyType?: string;
  purchaseType?: string;
  funder?: string;
  project?: string;
  purchaseTimeline?: string;
  qualificationPurpose?: string;
  decisionMaker?: string;
  notes?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
// Kanban and Group By show one board, not pages: load up to this many leads for them.
const BOARD_LIMIT = 500;

const LEADS_TABS = ["All Leads", "Unqualified", "Open Pipeline"];
// Open Pipeline only shows an in-memory import review that doesn't survive
// navigation, so it's never restored — that would land on an empty placeholder.
const RESTORABLE_LEADS_TABS = LEADS_TABS.filter((t) => t !== "Open Pipeline");
const PRIORITY_OPTIONS = [{ label: "Low", value: "low" }, { label: "Medium", value: "medium" }, { label: "High", value: "high" }, { label: "Urgent", value: "urgent" }];

const EMPTY_LEADS_FILTERS = {
  dateFrom: "",
  dateTo: "",
  category: "",
  type: "",
  staff: "",
  status: "",
  source: "",
  priority: "",
  minBudgetLakh: "",
  maxBudgetLakh: "",
};

// Filter-dropdown values for the whole scoped list, delivered by the server
// with each fetch (see getLeads meta.filterOptions).
type LeadsFilterOptions = {
  statuses: string[];
  sources: string[];
  categories: string[];
  types: string[];
  staff: string[];
};
const EMPTY_FILTER_OPTIONS: LeadsFilterOptions = { statuses: [], sources: [], categories: [], types: [], staff: [] };

/** A lead as a phone list row: its board card, with the pipeline status beside the phone number. */
const leadRow = (lead: KanbanLead): MobileRowData => ({
  ...leadCard(lead),
  status: lead.status ? { label: lead.status, dot: LEAD_STATUS_DOTS[lead.status] ?? "bg-gray-400" } : undefined,
});

export default function LeadsPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = usePersistedState<string>("leads:tab", "All Leads", { allowed: RESTORABLE_LEADS_TABS });
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [pendingImports, setPendingImports] = useState<PendingImport[]>([]);
  const [isInserting, setIsInserting] = useState(false);

  // Pre-insert duplicate map: normalized mobile -> existing lead info
  const [existingByMobile, setExistingByMobile] = useState<Record<string, DuplicateLeadInfo>>({});
  const [isCheckingDupes, setIsCheckingDupes] = useState(false);
  const [isDupeConfirmOpen, setIsDupeConfirmOpen] = useState(false);
  const [dupeBypass, setDupeBypass] = useState(false);

  // Pre-assign during review: pending rawId -> chosen staff (applied at insert)
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, { id: number; name: string }>>({});
  const [isPendingAssignOpen, setIsPendingAssignOpen] = useState(false);
  const [pendingAssignTargets, setPendingAssignTargets] = useState<string[]>([]);
  const [pendingSelection, setPendingSelection] = useState<any[]>([]);
  // Distinct sheet-supplied staff ids that are not in the staff directory;
  // surfaced in the insert toast. Their rows import unassigned.
  const [unresolvedStaffIds, setUnresolvedStaffIds] = useState<number[]>([]);
  // Bumped per parse so the table remounts with fresh selection state;
  // holds rows awaiting overwrite confirmation.
  const [reviewEpoch, setReviewEpoch] = useState(0);
  const [overwriteCandidate, setOverwriteCandidate] = useState<PendingImport[] | null>(null);

  // Bumped per parse so a seed fetch that resolves late cannot write the
  // previous file's import-0..N keys over the new file's rows.
  const seedGenerationRef = useRef(0);

  // Commits freshly parsed rows as the active review, clearing any state
  // tied to a previous review (assignments/selection/dupe bypass).
  const applyParsedImports = (formattedData: PendingImport[]) => {
    seedGenerationRef.current += 1;
    setPendingImports(formattedData);
    setDupeBypass(false);
    setPendingAssignments({});
    setPendingAssignTargets([]);
    setPendingSelection([]);
    setIsPendingAssignOpen(false);
    setOverwriteCandidate(null);
    setUnresolvedStaffIds([]);
    setReviewEpoch((epoch) => epoch + 1);
    toast.success(`${formattedData.length} leads parsed. Please review and insert.`);
    checkBulkDupes(formattedData);
    seedStaffAssignmentsFromSheet(formattedData);
  };

  // Sheet-supplied "Staff ID" values pre-fill the Assigned column so the
  // reviewer sees who each lead will land with before inserting. A manual
  // re-pick writes to the same map and therefore wins. Unresolved ids are
  // kept for the insert toast; their rows import unassigned.
  const seedStaffAssignmentsFromSheet = async (rows: PendingImport[]) => {
    // Staff cannot pre-assign at all: the backend strips assignedStaffId for
    // that role, yet getStaffList still hands them the full assignable list, so
    // seeding here would show an assignee the server then discards. Say so in
    // the UI instead — same gate as the toolbar and per-row assign button.
    if (role === "Staff") {
      if (rows.some((r) => typeof r.staffId === "number")) {
        toast.info("Staff ID column ignored — your role cannot pre-assign; leads go to the routing queue.");
      }
      return;
    }
    if (!rows.some((r) => typeof r.staffId === "number")) return;
    const generation = seedGenerationRef.current;
    try {
      // apiJson, not a bare res.json(): a non-JSON error body (proxy 500, HTML
      // gateway page) would throw a parse SyntaxError, and a 401 JSON body is
      // an object rather than an array — both read as "no staff at all".
      const data = await apiJson<{ data?: StaffOption[] }>(API_URL + "/lead-routing/staff-list?department=all");
      const raw = data?.data ?? [];
      const list: StaffOption[] = Array.isArray(raw)
        ? raw.map((u: any) => ({ id: Number(u.id), name: String(u.name ?? `Staff #${u.id}`) }))
        : [];
      // A newer parse started while this fetch was in flight — its rawIds reuse
      // import-0..N, so writing now would cross-assign the next file's leads.
      if (seedGenerationRef.current !== generation) return;
      const { assignments, unresolved } = resolveStaffAssignments(rows, list);
      if (Object.keys(assignments).length > 0) {
        setPendingAssignments((prev) => ({ ...assignments, ...prev }));
      }
      setUnresolvedStaffIds(unresolved);
    } catch {
      // A staff-directory failure must not block the import: treat every id as
      // unresolved so the reviewer sees no assignee rather than a wrong one.
      if (seedGenerationRef.current !== generation) return;
      setUnresolvedStaffIds([...new Set(rows.map((r) => r.staffId).filter((v): v is number => typeof v === "number"))]);
    }
  };

  const openPendingAssignFromSelection = () => {
    // Duplicates are merge-only: they cannot be pre-assigned
    const targets = pendingSelection
      .filter((r: any) => r.isPendingImport && r.rawId && !existingByMobile[r.mobile])
      .map((r: any) => r.rawId);
    if (targets.length === 0) {
      toast.info("Selected rows already exist — nothing to assign.");
      return;
    }
    setPendingAssignTargets(targets);
    setIsPendingAssignOpen(true);
  };

  // The review is showing when parsed rows await confirmation on Open Pipeline
  const isReviewingImports = activeTab === "Open Pipeline" && pendingImports.length > 0;
  const { dupes: dupeRows } = useMemo(
    () => partitionPendingImports(pendingImports, existingByMobile),
    [pendingImports, existingByMobile]
  );

  // Fresh review state resets the dupe map + bypass + pre-assignments
  useEffect(() => {
    if (pendingImports.length === 0) {
      setExistingByMobile({});
      setDupeBypass(false);
      setIsDupeConfirmOpen(false);
      setPendingAssignments({});
      setUnresolvedStaffIds([]);
      setIsPendingAssignOpen(false);
      setPendingAssignTargets([]);
      setPendingSelection([]);
    }
  }, [pendingImports.length]);

  const checkBulkDupes = async (rows: PendingImport[]) => {
    const mobiles = [...new Set(rows.map((r) => r.mobile).filter(Boolean))];
    if (mobiles.length === 0) {
      setExistingByMobile({});
      return;
    }
    setIsCheckingDupes(true);
    try {
      const res = await apiFetch(API_URL + "/leads/bulk/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobiles }),
      });
      const data = await res.json();
      if (data.success) setExistingByMobile(data.existing ?? {});
    } catch {
      // Non-fatal: insert-time merge still protects against real duplicates
      setExistingByMobile({});
    } finally {
      setIsCheckingDupes(false);
    }
  };

  const removePendingRow = (rawId?: string) => {
    if (!rawId) return;
    setPendingImports((prev) => prev.filter((p) => p.rawId !== rawId));
  };

  const [searchQuery, setSearchQuery] = usePersistedState("leads:search", "");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [filters, setFilters] = usePersistedState("leads:filters", EMPTY_LEADS_FILTERS);
  const [filterOptions, setFilterOptions] = useState<LeadsFilterOptions>(EMPTY_FILTER_OPTIONS);

  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = usePersistedState("leads:page:v2", { pageIndex: 0, pageSize: 20 });
  const [view, setView] = usePersistedState<ViewType>("leads:view", "list", { allowed: ["list", "kanban", "group"] });
  const [groupField, setGroupField] = usePersistedState<LeadGroupField>("leads:groupBy", "status", {
    allowed: LEAD_GROUP_FIELDS.map((f) => f.id),
  });
  // The import review is a list-only flow
  const boardView = view !== "list" && !(activeTab === "Open Pipeline" && pendingImports.length > 0);

  // Role-based state
  const [role, setRole] = useState<string>("");
  const [userDept, setUserDept] = useState<string>("");
  const [userId, setUserId] = useState<number | null>(null);
  const [deptFilter, setDeptFilter] = usePersistedState<"telecalling" | "sales">("leads:dept", "telecalling", { allowed: ["telecalling", "sales"] });

  // Assign lead modal state
  const [assignLeadId, setAssignLeadId] = useState<number | null>(null);
  const [assignLeadIds, setAssignLeadIds] = useState<number[] | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  // Contact modal state (mobile quick actions)
  const [contactModal, setContactModal] = useState<{ open: boolean; type: string; to: string; rawId: number }>({ open: false, type: "", to: "", rawId: 0 });

  // Return to queue state
  const [returnLeadId, setReturnLeadId] = useState<number | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [isReturning, setIsReturning] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
        const roleName = user?.role?.name || user?.role || "";
        const deptName = normalizeDepartment(user?.department?.name || user?.department);
        setRole(roleName);
        setUserDept(deptName);
        setUserId(user?.id || null);
        // Staff see only their dept
        if (roleName === "Staff") {
          setDeptFilter(deptName);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Import review is a tab only while there are rows to review.
  const tabs = LEADS_TABS.filter((t) => t !== "Open Pipeline" || pendingImports.length > 0);
  const shownTab = activeTab === "Open Pipeline" && pendingImports.length === 0 ? "All Leads" : activeTab;
  const tabLabel = (t: string) => (t === "Open Pipeline" ? `Import review · ${pendingImports.length}` : t);

  const resetPage = () => setPagination((prev) => (prev.pageIndex === 0 ? prev : resetPageIndex(prev)));
  const updateFilters = (updater: (prev: typeof filters) => typeof filters) => {
    setFilters(updater);
    resetPage();
  };

  const fetchLeads = useCallback(async () => {
    try {
      if (activeTab === "Open Pipeline" && pendingImports.length > 0) {
        return; // No need to fetch if showing imports
      }
      setIsLoading(true);
      const params = new URLSearchParams({
        page: boardView ? "1" : (pagination.pageIndex + 1).toString(),
        limit: (boardView ? BOARD_LIMIT : pagination.pageSize).toString(),
      });
      if (debouncedSearchQuery.trim()) params.append('search', debouncedSearchQuery.trim());
      if (activeTab && activeTab !== "Open Pipeline") params.append('tab', activeTab);
      if (deptFilter) params.append('dept', deptFilter);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.category) params.append('category', filters.category);
      if (filters.type) params.append('type', filters.type);
      if (filters.staff) params.append('staff', filters.staff);
      if (filters.status) params.append('status', filters.status);
      if (filters.source) params.append('source', filters.source);
      if (filters.priority) params.append('priority', filters.priority);
      const toRupees = (lakh: string) => {
        if (lakh.trim() === "") return "";
        const n = Number(lakh);
        return Number.isFinite(n) && n >= 0 ? String(Math.round(n * 100000)) : "";
      };
      const minBudget = toRupees(filters.minBudgetLakh);
      const maxBudget = toRupees(filters.maxBudgetLakh);
      if (minBudget) params.append('minBudget', minBudget);
      if (maxBudget) params.append('maxBudget', maxBudget);

      const res = await apiFetch(API_URL + "/leads?" + params.toString());
      const data = await res.json();
      if (data.success) {
        const total = data.meta?.total || 0;
        // A restored page can now be past the end (leads reassigned/closed)
        const lastPage = Math.max(0, Math.ceil(total / pagination.pageSize) - 1);
        if (!boardView && pagination.pageIndex > lastPage) {
          setPagination((prev) => ({ ...prev, pageIndex: lastPage }));
          return;
        }
        setLeads(data.data);
        setTotalCount(total);
        setFilterOptions(data.meta?.filterOptions ?? EMPTY_FILTER_OPTIONS);
      }
    } catch {
      toast.error("Failed to load leads.");
    } finally {
      setIsLoading(false);
    }
  }, [pagination, debouncedSearchQuery, activeTab, deptFilter, filters, pendingImports.length, boardView]);

  useEffect(() => {
    fetchLeads();
    window.scrollTo(0, 0);
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, [fetchLeads]);

  const displayedLeads = useMemo(() => {
    if (activeTab === "Open Pipeline" && pendingImports.length > 0) {
      return pendingImports;
    }
    return leads;
  }, [activeTab, pendingImports, leads]);

  // Kanban drag: show the new status straight away, put it back if the server says no.
  const handleMoveLead = async (lead: { rawId: number; name: string; status: string }, status: string) => {
    const previous = lead.status;
    const setStatus = (s: string) => setLeads(prev => prev.map(l => (l.rawId === lead.rawId ? { ...l, status: s } : l)));
    setStatus(status);
    try {
      const res = await apiFetch(`${API_URL}/leads/${lead.rawId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_name: status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error();
      toast.success(data.transferredToSales ? `${lead.name} moved to the Sales pipeline.` : `${lead.name} → ${status}`);
    } catch {
      setStatus(previous);
      toast.error(`Couldn't move ${lead.name}. Status unchanged.`);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await apiFetch(API_URL + "/leads/" + deleteId, { method: "DELETE" });
      if (res.ok) {
        toast.success("Lead deleted successfully");
        setLeads(prev => prev.filter(l => l.rawId !== deleteId));
      } else {
        toast.error("Failed to delete lead");
      }
    } catch {
      toast.error("Failed to delete lead");
    } finally {
      setDeleteId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const promises = bulkDeleteIds.map(id => apiFetch(API_URL + "/leads/" + id, { method: "DELETE" }));
      const results = await Promise.all(promises);
      const failedCount = results.filter(r => !r.ok).length;
      if (failedCount > 0) {
        toast.error(`Failed to delete ${failedCount} leads`);
      }
      const successCount = results.filter(r => r.ok).length;
      if (successCount > 0) {
        toast.success(`${successCount} lead(s) deleted successfully`);
        setLeads(prev => prev.filter(l => !bulkDeleteIds.includes(l.rawId)));
      }
    } catch {
      toast.error("Failed to delete some or all leads");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
    }
  };

  const handleAssignLead = async (toUserId: number) => {
    const idsToAssign = assignLeadIds || (assignLeadId ? [assignLeadId] : null);
    if (!idsToAssign || idsToAssign.length === 0) return;
    
    setIsAssigning(true);
    try {
      let currentUserId = 0;
      try {
        const stored = localStorage.getItem("crm_user");
        if (stored) currentUserId = JSON.parse(stored).id;
      } catch {}

      const promises = idsToAssign.map(id => 
        apiFetch(`${API_URL}/lead-routing/assign/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to_user_id: toUserId, actioned_by_id: currentUserId || null }),
        })
      );
      
      await Promise.all(promises);
      toast.success(`${idsToAssign.length} lead(s) assigned successfully`);
      fetchLeads();
    } catch {
      toast.error("Failed to assign lead(s)");
    } finally {
      setIsAssigning(false);
      setAssignLeadId(null);
      setAssignLeadIds(null);
    }
  };

  const handleReturnToQueue = async () => {
    if (!returnLeadId) return;
    if (!returnReason.trim()) return toast.error("Please enter a reason");
    setIsReturning(true);
    try {
      const res = await apiFetch(`${API_URL}/lead-routing/return-to-queue/${returnLeadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: returnReason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Lead returned to routing queue");
        setLeads(prev => prev.filter(l => l.rawId !== returnLeadId));
      } else {
        toast.error(data.message || "Failed to return lead");
      }
    } catch {
      toast.error("Failed to return lead");
    } finally {
      setIsReturning(false);
      setReturnLeadId(null);
      setReturnReason("");
    }
  };

  const openMobileContact = (type: string, lead: any) => {
    setContactModal({ open: true, type, to: lead.mobile, rawId: lead.rawId });
  };

  // Memoised: a new array each render would make the table rebuild every row.
  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="data-[state=checked]:bg-[#017D58] data-[state=checked]:border-[#017D58] data-checked:bg-[#017D58] data-checked:border-[#017D58]"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="data-[state=checked]:bg-[#017D58] data-[state=checked]:border-[#017D58] data-checked:bg-[#017D58] data-checked:border-[#017D58]"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => row.original.isPendingImport ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <Link href={`/leads/${row.original.rawId}`} className="tabular-nums text-muted-foreground hover:text-foreground hover:underline">
          {row.getValue("id")}
        </Link>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          <NameAvatar name={row.original.name} />
          <span className="font-medium text-foreground">{row.original.name}</span>
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status as string;
        return <StatusCell status={s} pillClass={leadStatusPill(s)} />;
      },
    },
    {
      accessorKey: "mobile",
      header: "Mobile",
      cell: ({ row }) => <span className="tabular-nums">{row.original.mobile}</span>,
    },
    {
      accessorKey: "propertyType",
      header: "Property Type",
      cell: ({ row }) => (
        <span className="capitalize">{row.original.propertyType?.replace(/_/g, ' ')}</span>
      ),
    },
    {
      id: "assigned",
      header: "Assigned",
      cell: ({ row }) => {
        const p = row.original;
        // Pending review rows show their pre-assigned staff here (applied at insert)
        const preAssignee = p.isPendingImport && p.rawId ? pendingAssignments[p.rawId]?.name : undefined;
        // A sheet id that survived seeding unresolved, so the reviewer sees the
        // row carries an id nobody can honour before inserting. Keyed off
        // unresolvedStaffIds rather than "no assignee in the map" so a Staff
        // reviewer — whose seeding is skipped entirely — is never told a
        // perfectly valid id is unknown.
        const unresolvedSheetId =
          p.isPendingImport && typeof p.staffId === "number" && unresolvedStaffIds.includes(p.staffId)
            ? p.staffId
            : undefined;
        const assignedStaff = preAssignee ?? p.staff;
        if (assignedStaff && assignedStaff !== "Unassigned") {
          return (
            <span className="inline-flex items-center gap-1.5" title={preAssignee ? "Assigned on insert" : undefined}>
              <NameAvatar name={assignedStaff} staff className="size-5 text-[10px]" />
              <span>{assignedStaff}</span>
            </span>
          );
        }
        // Unassigned — flag an unresolvable sheet id in place of the plain label
        return unresolvedSheetId !== undefined ? (
          <Badge
            variant="outline"
            className="bg-muted/40 text-muted-foreground border-dashed border-border/60"
            title="Staff ID not matched in your assignable list — this lead will import unassigned"
          >
            Unknown (#{unresolvedSheetId})
          </Badge>
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        );
      },
    },
    {
      id: "lastFollowup",
      header: "Last Followup",
      // Sorting here is client-side over the current page only, so offering it
      // would reorder just the loaded rows and mislead the user.
      enableSorting: false,
      cell: ({ row }) => <LastFollowupCell row={row.original} />,
    },
    { accessorKey: "source", header: "Source" },
    { 
      accessorKey: "date", 
      header: "Date",
      cell: ({ row }) => {
        return <span className="text-muted-foreground">{row.original.date}</span>;
      }
    },
  ], [activeTab, pendingAssignments, unresolvedStaffIds]);

  // Pending-review extras: duplicate badge + per-row remove (Open Pipeline only)
  const reviewColumn: ColumnDef<any> = {
    id: "review",
    header: "Review",
    cell: ({ row }) => {
      const p = row.original;
      if (!p.isPendingImport) return null;
      const ex = existingByMobile[p.mobile];
      return (
        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          {ex ? (
            <Badge className="font-medium shadow-sm border whitespace-nowrap bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
              Exists • {ex.displayId}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap">
              New
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            title="Remove this row"
            className="h-7 w-7 rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-500"
            onClick={() => removePendingRow(p.rawId)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- reviewColumn only reads existingByMobile
  const visibleColumns = useMemo(() => (isReviewingImports ? [...columns, reviewColumn] : columns), [columns, isReviewingImports, existingByMobile]);

  const readImportFile = (file: File) => {

    // Snapshot: a completed parse must not silently discard this review
    const hadPendingReview = pendingImports.length > 0;

    setIsImporting(true);
    setImportProgress(0);
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const XLSX = await import("xlsx");
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        if (data.length > 0) {
          // 1. Header Validation
          const headers = Object.keys(data[0] || {});
          const requiredHeaders = ["Customer Name", "Customer Number", "Email Id", "Lead Source ID"];
          const hasAllHeaders = requiredHeaders.every(h => headers.includes(h));
          
          if (!hasAllHeaders) {
            toast.error(`Missing required columns. Please use the exact template.`);
            setIsImporting(false);
            return;
          }

          const sourceResponse = await apiJson<{ data: { id: number; label: string }[] }>(`${API_URL}/master/lead-sources`);
          const sources: LeadImportSource[] = sourceResponse.data.map(source => ({ id: source.id, name: source.label }));
          // 2. Row Data Validation (Fail-Fast) + Duplicate Check
          const seenMobiles = new Map<string, number>(); // normalized mobile -> first row number
          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const name = String(row["Customer Name"] || "").trim();
            const rawMobile = String(row["Customer Number"] || "").trim();
            const mobile = normalizeIndianMobile(rawMobile);
            resolveLeadImportSource(row["Lead Source ID"], sources, i + 2);

            if (!name) { toast.error(`Row ${i + 2} is missing Customer Name. Import aborted.`); setIsImporting(false); return; }
            if (!mobile) { toast.error(`Row ${i + 2} is missing Customer Number. Import aborted.`); setIsImporting(false); return; }

            // Duplicate detection within the file (after normalization)
            if (seenMobiles.has(mobile)) {
              toast.error(`Duplicate entry: Customer Number ${rawMobile} appears on Row ${seenMobiles.get(mobile)! + 1} and Row ${i + 2}. Import aborted.`);
              setIsImporting(false);
              return;
            }
            seenMobiles.set(mobile, i + 1);
          }

          const total = data.length;
          let processed = 0;
          const chunkSize = Math.max(10, Math.floor(total / 20));
          const formattedData: PendingImportRow[] = [];

          const processChunk = () => {
            const nextChunk = Math.min(processed + chunkSize, total);

            for (let i = processed; i < nextChunk; i++) {
              formattedData.push(mapImportSheetRow(data[i], i, sources));
            }

            processed = nextChunk;
            setImportProgress(Math.floor((processed / total) * 100));

            if (processed < total) {
              setTimeout(processChunk, 20); // allow UI to update
            } else {
              setIsImporting(false);
              setIsImportOpen(false);
              setActiveTab("Open Pipeline");
              if (hadPendingReview) {
                // A review is already in progress — hold the new rows for
                // confirmation instead of silently discarding the old review
                setOverwriteCandidate(formattedData);
              } else {
                applyParsedImports(formattedData);
              }
            }
          };
          processChunk();
        } else {
          toast.error("The uploaded Excel file appears to be empty.");
          setIsImporting(false);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to parse Excel file.");
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Gate: if any pending row already exists in the CRM, ask staff to
  // confirm (showing the existing lead IDs) instead of inserting blindly.
  const handleBulkInsert = async () => {
    const { dupes } = partitionPendingImports(pendingImports, existingByMobile);
    if (dupes.length > 0 && !dupeBypass) {
      setIsDupeConfirmOpen(true);
      return;
    }
    await doBulkInsert(pendingImports);
  };

  // "Insert all anyway" from the duplicate confirmation dialog
  const insertAllAnyway = async () => {
    setDupeBypass(true);
    setIsDupeConfirmOpen(false);
    await doBulkInsert(pendingImports);
  };

  // "Remove duplicates" from the dialog: drop dupe rows, insert the rest
  const removeDupeRowsAndContinue = async () => {
    const { dupes } = partitionPendingImports(pendingImports, existingByMobile);
    const dupeIds = new Set(dupes.map((d) => d.row.rawId));
    const remaining = pendingImports.filter((p) => !dupeIds.has(p.rawId));
    setPendingImports(remaining);
    setIsDupeConfirmOpen(false);
    if (remaining.length === 0) {
      toast.success(`${dupes.length} duplicate row${dupes.length === 1 ? "" : "s"} removed. Nothing left to insert.`);
      return;
    }
    await doBulkInsert(remaining);
  };

  const doBulkInsert = async (rows: PendingImport[]) => {
    try {
      setIsInserting(true);
      const payload = rows
        .map(p => ({
          name: p.name,
          mobile: p.mobile,
          email: p.email || undefined,
          leadSourceId: p.leadSourceId,
          commissionRemarks: p.commissionRemarks || undefined,
          assignedStaffId: (p.rawId ? pendingAssignments[p.rawId]?.id : undefined) ?? undefined,
        }));

      if (payload.length === 0) {
        toast.error("No valid rows to import.");
        setIsInserting(false);
        return;
      }
      
      const res = await apiFetch(API_URL + "/leads/bulk", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ leads: payload })
      });
      const data = await res.json();
      if (res.ok && data.success) {
         const created = data.created ?? data.count ?? 0;
         const existing = data.existing ?? 0;
         const assigned = data.assigned ?? 0;
         // Derived from the rows actually being sent, not from the parse-time
         // list: a reviewer who manually re-assigns an unresolved row has fixed
         // it, and saying "imported unassigned" for that row would contradict
         // the "assigned directly" count above. Counted in distinct staff ids.
         const unknownIds = [
           ...new Set(
             rows
               .filter((p) => typeof p.staffId === "number" && !(p.rawId && pendingAssignments[p.rawId]))
               .map((p) => p.staffId as number),
           ),
         ];
         const unresolvedNote =
           unknownIds.length > 0
             ? `, ${unknownIds.length} staff id${unknownIds.length === 1 ? "" : "s"} not in your assignable list (imported unassigned)`
             : "";
         toast.success(
           `Imported ${created} new lead${created === 1 ? "" : "s"}` +
           (existing > 0 ? `, ${existing} already existed — new requirements attached` : "") +
           (assigned > 0 ? `, ${assigned} assigned directly` : "") +
           unresolvedNote +
           "."
         );
          setPendingImports([]);
          setUnresolvedStaffIds([]);
          setPagination(prev => ({ ...prev, pageIndex: 0 }));
          router.push(getBulkImportDestination());
      } else {
         const msg = Array.isArray(data.error) ? data.error.join(", ") : data.error || data.message || "Bulk insert failed";
         console.error("Bulk import failed:", data);
         toast.error(msg);
      }
    } catch (e) {
      console.error("Bulk import error:", e);
      toast.error("An error occurred during bulk insert.");
    } finally {
      setIsInserting(false);
    }
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== "").length;

  const clearFilters = () => {
    setFilters(EMPTY_LEADS_FILTERS);
    resetPage();
  };

  const deptPipelines: { label: string; value: "telecalling" | "sales" }[] = [
    { label: "Telecalling", value: "telecalling" },
    { label: "Sales", value: "sales" },
  ];

  // Staff only see their own dept tab
  const visiblePipelines = role === "Staff"
    ? deptPipelines.filter((d) => d.value === (userDept || "telecalling"))
    : deptPipelines;


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
          <button type="button" className="flex h-8 items-center gap-1.5 rounded-md bg-muted/70 px-2.5 text-[13px] text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-[#017D58]/40 data-[popup-open]:bg-muted">
            <Filter className="size-4 text-muted-foreground" strokeWidth={1.75} />
            Filter
            {activeFiltersCount > 0 && (
              <span className="rounded bg-[#017D58] px-1.5 text-[11px] font-medium leading-[18px] text-white">{activeFiltersCount}</span>
            )}
          </button>
        )
      } />
      <PopoverContent align="start" className="w-80 p-0 rounded-2xl shadow-xl overflow-hidden border-border/60">
                <div className="flex items-center justify-between p-4 border-b bg-muted/10">
                  <h4 className="font-semibold text-foreground text-sm">Filter Leads</h4>
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground hover:text-red-600">
                      Clear All
                    </Button>
                  )}
                </div>
                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created From</label>
                    <Input type="date" value={filters.dateFrom} onChange={e => updateFilters(f => ({...f, dateFrom: e.target.value}))} className="h-9 rounded-lg text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created To</label>
                    <Input type="date" value={filters.dateTo} onChange={e => updateFilters(f => ({...f, dateTo: e.target.value}))} className="h-9 rounded-lg text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</label>
                    <FormSelect name="status" options={filterOptions.statuses.map(s => ({label: s, value: s}))} value={filters.status} onValueChange={v => updateFilters(f => ({...f, status: v || ""}))} placeholder="All Statuses" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Staff</label>
                    <FormSelect name="staff" options={filterOptions.staff.map(s => ({label: s, value: s}))} value={filters.staff} onValueChange={v => updateFilters(f => ({...f, staff: v || ""}))} placeholder="All Staff" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Lead Source</label>
                    <FormSelect name="source" options={filterOptions.sources.map(s => ({label: s, value: s}))} value={filters.source} onValueChange={v => updateFilters(f => ({...f, source: v || ""}))} placeholder="All Sources" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Property Category</label>
                    <FormSelect name="category" options={filterOptions.categories.map(s => ({label: s, value: s}))} value={filters.category} onValueChange={v => updateFilters(f => ({...f, category: v || ""}))} placeholder="All Categories" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Property Type</label>
                    <FormSelect name="type" options={filterOptions.types.map(s => ({label: s, value: s}))} value={filters.type} onValueChange={v => updateFilters(f => ({...f, type: v || ""}))} placeholder="All Types" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Priority</label>
                    <FormSelect name="priority" options={[{label: "Low", value: "low"}, {label: "Medium", value: "medium"}, {label: "High", value: "high"}, {label: "Urgent", value: "urgent"}]} value={filters.priority} onValueChange={v => updateFilters(f => ({...f, priority: v || ""}))} placeholder="All Priorities" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Budget (₹ Lakh)</label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min="0" placeholder="Min" value={filters.minBudgetLakh} onChange={e => updateFilters(f => ({...f, minBudgetLakh: e.target.value}))} className="h-9 rounded-lg text-sm" />
                      <span className="text-muted-foreground text-xs shrink-0">—</span>
                      <Input type="number" min="0" placeholder="Max" value={filters.maxBudgetLakh} onChange={e => updateFilters(f => ({...f, maxBudgetLakh: e.target.value}))} className="h-9 rounded-lg text-sm" />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
  );

  
  const tableProps = {
    flush: true as const,
    emptyState: (
      <EmptyState
        className="sticky left-0"
        kind="people"
        title={searchQuery || activeFiltersCount > 0 ? "No leads match" : "No leads here yet"}
        description={searchQuery || activeFiltersCount > 0 ? "Try a different search or clear the filters." : "New leads will show up here as they come in."}
      />
    ),
    columns: visibleColumns,
    data: displayedLeads,
    showToolbar: !isReviewingImports,
    onSelectionChange: setPendingSelection,
    showDeleteAction: isAdmin({ role }) && !isReviewingImports,
    onDeleteSelected: (rows: any[]) => setBulkDeleteIds(rows.map(r => r.rawId)),
    renderToolbarActions: (selectedRows: any[], clearSelection: any) => {
      const isSingle = selectedRows.length === 1;
      const row = selectedRows[0];
      
      return (
        <>
          {activeTab === "Unqualified" && isSingle && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const res = await apiFetch(`${API_URL}/leads/${row.rawId}/status`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ is_unqualified: false }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    toast.success("Lead reverted to qualified.");
                    setLeads(prev => prev.map(l => l.rawId === row.rawId ? { ...l, isUnqualified: false } : l));
                    clearSelection();
                  } else toast.error("Failed to revert lead.");
                } catch {
                  toast.error("Failed to revert lead.");
                }
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Revert
            </Button>
          )}
          
          {role === "Staff" ? (
            isSingle && !row.isPendingImport && (
              <Button
                variant="outline"
                size="sm"
                className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10"
                onClick={() => setReturnLeadId(row.rawId)}
              >
                Re Assign
              </Button>
            )
          ) : (
            !selectedRows.some((r: any) => r.isPendingImport) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAssignLeadIds(selectedRows.map(r => r.rawId));
                  setAssignLeadId(null);
                }}
              >
                Assign Selected
              </Button>
            )
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

  const segmentClass = (active: boolean) =>
    cn(
      "relative h-7 whitespace-nowrap rounded px-2.5 text-[13px] transition-colors",
      active
        ? "bg-background font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:bg-white/10"
        : "text-muted-foreground hover:text-foreground",
    );

  const groupKey = (lead: { staff?: string; propertyType?: string; source?: string; status?: string }): string => {
    if (groupField === "staff") return lead.staff && lead.staff !== "Unassigned" ? lead.staff : "Unassigned";
    if (groupField === "propertyType") return lead.propertyType ? String(lead.propertyType).replace(/_/g, " ") : "No property type";
    if (groupField === "source") return lead.source || "No source";
    return lead.status || "No status";
  };

  const desktopFilters = (
    <div className="md:flex md:min-h-0 md:flex-1 md:flex-col lg:-mx-6 lg:-mb-8 lg:-mt-6">
      {/* Toolbar: which leads, then every filter in one sideways-scrolling strip, search at the end */}
      <div className="flex items-center gap-2 px-5 pb-2 pt-3">
        <div className="flex shrink-0 items-center rounded-md bg-muted/70 p-0.5" role="group" aria-label="Leads">
          {tabs.map((tab) => (
            <button key={tab} type="button" aria-pressed={shownTab === tab} onClick={() => { setActiveTab(tab); resetPage(); }}
              className={cn(segmentClass(shownTab === tab), tab === "Open Pipeline" && shownTab !== tab && "text-[#017D58] dark:text-[#2FB585]")}>
              {tabLabel(tab)}
            </button>
          ))}
        </div>

        {isReviewingImports ? <div className="flex-1" /> : (
          <>
            <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
            <FilterStrip>
              {visiblePipelines.length > 1 && (
                <QuickFilter label="Pipeline" required value={deptFilter} options={visiblePipelines}
                  onChange={(v) => { setDeptFilter(v as "telecalling" | "sales"); resetPage(); }} />
              )}
              <DateQuickFilter label="Created" from={filters.dateFrom} to={filters.dateTo} onChange={(dateFrom, dateTo) => updateFilters((f) => ({ ...f, dateFrom, dateTo }))} />
              <QuickFilter label="Status" value={filters.status} options={filterOptions.statuses.map((v) => ({ label: v, value: v, dot: statusDot(v) }))} onChange={(v) => updateFilters((f) => ({ ...f, status: v }))} />
              {role !== "Staff" && <QuickFilter label="Assigned to" value={filters.staff} options={filterOptions.staff.map((v) => ({ label: v, value: v }))} onChange={(v) => updateFilters((f) => ({ ...f, staff: v }))} />}
              <QuickFilter label="Source" value={filters.source} options={filterOptions.sources.map((v) => ({ label: v, value: v }))} onChange={(v) => updateFilters((f) => ({ ...f, source: v }))} />
              <QuickFilter label="Priority" value={filters.priority} options={PRIORITY_OPTIONS} onChange={(v) => updateFilters((f) => ({ ...f, priority: v }))} />
              <QuickFilter label="Category" value={filters.category} options={filterOptions.categories.map((v) => ({ label: v, value: v }))} onChange={(v) => updateFilters((f) => ({ ...f, category: v }))} />
              <QuickFilter label="Property type" value={filters.type} options={filterOptions.types.map((v) => ({ label: v.replace(/_/g, " "), value: v }))} onChange={(v) => updateFilters((f) => ({ ...f, type: v }))} />
              <RangeQuickFilter label="Budget" unit="lakh" min={filters.minBudgetLakh} max={filters.maxBudgetLakh} onChange={(minBudgetLakh, maxBudgetLakh) => updateFilters((f) => ({ ...f, minBudgetLakh, maxBudgetLakh }))} />
              {(searchQuery || activeFiltersCount > 0) && (
                <button type="button" onClick={() => { setSearchQuery(""); clearFilters(); }}
                  className="h-8 shrink-0 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  Clear all
                </button>
              )}
            </FilterStrip>
            <div className="flex shrink-0 items-center gap-2">
              {boardView && view === "group" && <GroupByPicker value={groupField} onChange={setGroupField} />}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                <input
                  type="search"
                  aria-label="Search leads"
                  placeholder="Search ID, name, phone, email"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }}
                  className="h-8 w-56 rounded-md border border-transparent bg-muted/70 pl-8 pr-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:bg-muted focus:border-border focus:bg-background focus:shadow-sm"
                />
              </div>
            </div>
          </>
        )}
      </div>


      {/* Content */}
      <div className="flex w-full flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
        {pendingImports.length > 0 && activeTab === "Open Pipeline" && (
             <div className="px-4 sm:px-6 py-2.5 bg-card border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                   <div className="hidden sm:flex h-7 w-7 rounded-full bg-[#0052FF]/10 dark:bg-[#0052FF]/20 items-center justify-center shrink-0">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-[#0052FF]" />
                   </div>
                   <p className="text-[13.5px] truncate">
                      <span className="text-foreground font-semibold">Review {pendingImports.length} pending import{pendingImports.length === 1 ? "" : "s"}</span>
                      <span className="text-muted-foreground"> — not saved yet.</span>
                      {isCheckingDupes && (
                        <span className="text-muted-foreground"> Checking…</span>
                      )}
                      {!isCheckingDupes && dupeRows.length > 0 && (
                        <span className="text-amber-700 dark:text-amber-300 font-medium"> {dupeRows.length} exist.</span>
                      )}
                   </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                   {pendingSelection.length > 0 && role !== "Staff" && (
                     <>
                       <span className="text-[13px] font-medium text-[#0052FF] whitespace-nowrap hidden sm:inline">{pendingSelection.length} selected</span>
                       <Button size="sm" variant="outline" className="border-[#0052FF]/30 text-[#0052FF] hover:bg-[#0052FF]/10" onClick={openPendingAssignFromSelection}>
                         Assign to staff
                       </Button>
                     </>
                   )}
                   <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setPendingImports([])}>Cancel Import</Button>
                   <Button size="sm" onClick={handleBulkInsert} disabled={isInserting} className="flex-1 sm:flex-none bg-[#0052FF] text-white hover:bg-[#0052FF]/90 shadow-md">
                     {isInserting ? "Inserting…" : "Confirm & Insert All"}
                   </Button>
                </div>
             </div>
        )}
        {isLoading ? (
          <div className="px-5 pt-3"><TableSkeleton /></div>
        ) : boardView && view === "kanban" ? (
          <LeadsKanban leads={displayedLeads} onMove={handleMoveLead} />
        ) : boardView && view === "group" ? (
          <GroupedList
            columns={visibleColumns.filter((c) => c.id !== "select")}
            data={displayedLeads}
            groupBy={(lead) => groupKey(lead)}
            groupOrder={groupField === "status" ? LEAD_STATUS_ORDER : undefined}
            renderGroupLabel={(key) =>
              groupField === "status" ? (
                <span className="inline-flex items-center gap-2">
                  <span className={"size-2 rounded-full " + (LEAD_STATUS_DOTS[key] ?? "bg-gray-400")} />
                  {key}
                </span>
              ) : (
                <span className="capitalize">{key}</span>
              )
            }
            onRowClick={(lead) => router.push(`/leads/${lead.rawId}`)}
            emptyState={<EmptyState className="sticky left-0" kind="people" title="No leads to show" description="Try a different search or filter." />}
          />
        ) : (
          <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
            <DataTable key={isReviewingImports ? `review-${reviewEpoch}` : "leads"} {...tableProps} variant="list" />
          </div>
        )}
        {boardView && !isLoading && totalCount > displayedLeads.length && (
          <p className="border-t px-5 py-2 text-[13px] text-muted-foreground">
            Showing the first {displayedLeads.length} of {totalCount} leads. Narrow it down with search or filters.
          </p>
        )}
      </div>
      <ViewSwitcher value={view} onChange={(v) => { setView(v); resetPage(); }} />
    </div>
  );

  const mobileFilters = (
    <div className="px-4 pb-2 space-y-3">
      {/* iOS Search Bar & Filter (hidden during import review — it only filters saved leads) */}
      {!isReviewingImports && (
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground" />
          <Input 
            placeholder="Search leads..." 
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); resetPage(); }}
            className="pl-10 h-10 bg-foreground/[0.06] border-transparent rounded-[11px] text-[16px] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[#017D58]/30 shadow-none"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); resetPage(); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 bg-muted-foreground/20 rounded-full text-foreground hover:bg-muted-foreground/30">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {renderFilterPopover(true)}
      </div>
      )}

      {/* Pill Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {tabs.map(tab => {
          const isActive = shownTab === tab;
          return (
            <button 
              key={tab}
              onClick={() => { setActiveTab(tab); resetPage(); }}
              className={cn(
                "px-3.5 h-8 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors active:opacity-60",
                isActive ? "bg-[#017D58] text-white dark:bg-[#2FB585] dark:text-black" : "bg-foreground/[0.06] text-foreground"
              )}
            >
              {tabLabel(tab)}
            </button>
          )
        })}
      </div>

      {/* Pipeline Toggles */}
      {visiblePipelines.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          {visiblePipelines.map((d) => (
            <button
              key={d.value}
              onClick={() => { setDeptFilter(d.value); resetPage(); }}
              className={cn(
                "px-3 h-7 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors border active:opacity-60",
                deptFilter === d.value ? "border-foreground/70 text-foreground" : "border-border text-muted-foreground"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

    </div>
  );

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    try {
      const response = await apiJson<{ data: { id: number; label: string }[] }>(`${API_URL}/master/lead-sources`);
      const sources: LeadImportSource[] = response.data.map(source => ({ id: source.id, name: source.label }));
      // 4 required columns + optional Remarks + optional Staff ID
      const headers = [
        {
          "Customer Name": "John Doe",
          "Customer Number": "9876543210",
          "Email Id": "john@example.com",
          "Lead Source ID": sources[0]?.id ?? "",
          "Remarks": "Looking for 3BHK",
          // Optional: numeric users.id. Leave blank to import unassigned.
          "Staff ID": 12
        }
      ];

      const ws = XLSX.utils.json_to_sheet(headers);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        sources.map(source => ({ "Lead Source ID": source.id, "Lead Source": source.name })),
        { header: ["Lead Source ID", "Lead Source"] },
      ), "Lead Sources");

      XLSX.writeFile(wb, "Lead_Import_Template.xlsx");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download template.");
    }
  };

  return (
    <>
      <MobileHeader title="Leads" />
      <div className="w-full flex flex-col space-y-6 pt-4 lg:p-0 md:h-full">
        <PageActions>
          <button type="button" onClick={() => setIsImportOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-[14px] font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-muted">
            <FileSpreadsheet size={15} className="text-muted-foreground" />
            Import
          </button>
          <button type="button" onClick={() => setCreating(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[14px] font-medium text-background transition-colors hover:bg-foreground/85">
            <Plus size={16} />
            Create
          </button>
        </PageActions>
        <ImportDialog
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          title="Import leads"
          description="Upload a spreadsheet of leads. You'll review every row, with duplicates flagged, before anything is added."
          onFile={readImportFile}
          onTemplate={() => void downloadTemplate()}
          busy={isImporting}
          progress={importProgress}
        />
        <NewLeadModal
          open={creating}
          onOpenChange={setCreating}
          onCreated={(id, toQueue) => router.push(toQueue ? "/lead-routing" : id ? `/leads/${id}` : "/leads")}
        />

      <Device mobile={mobileFilters} desktop={desktopFilters} />
        <Device
          desktop={null}
          mobile={
            <div className="w-full px-4 md:px-0">
              {pendingImports.length > 0 && activeTab === "Open Pipeline" && (
                 <div className="mb-6 p-4 bg-card border border-border rounded-xl flex flex-col gap-3 shadow-sm">
                    <div className="flex items-start gap-3">
                       <div className="h-8 w-8 rounded-full bg-[#0052FF]/10 dark:bg-[#0052FF]/20 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="h-4 w-4 text-[#0052FF]" />
                       </div>
                        <div className="flex-1 min-w-0">
                           <h3 className="text-foreground font-semibold text-[14px]">Review Pending Imports</h3>
                           <p className="text-muted-foreground text-xs mt-0.5">Please review <span className="font-semibold text-foreground">{pendingImports.length}</span> leads below. Not saved yet.</p>
                           {!isCheckingDupes && dupeRows.length > 0 && (
                             <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5 font-medium">
                               {dupeRows.length} of {pendingImports.length} already exist.
                             </p>
                           )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="outline" size="sm" className="flex-1" onClick={() => setPendingImports([])}>Cancel</Button>
                       <Button size="sm" onClick={handleBulkInsert} disabled={isInserting} className="flex-1 bg-[#0052FF] text-white hover:bg-[#0052FF]/90 shadow-md">
                         {isInserting ? "Inserting…" : "Confirm & Insert All"}
                       </Button>
                    </div>
                 </div>
              )}
              {activeTab === "Open Pipeline" && pendingImports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-border rounded-xl bg-muted/10">
                  <h3 className="text-lg font-bold text-foreground mb-2">No Imported Leads</h3>
                </div>
              ) : (
                <div className={isReviewingImports ? "w-full overflow-x-auto" : "-mx-4"}>
                  {isLoading ? <TableSkeleton /> : isReviewingImports ? (
                    <DataTable key={`review-${reviewEpoch}`} {...tableProps} />
                  ) : (
                    <MobileRowsProvider row={leadRow} onOpen={(lead: KanbanLead) => router.push(`/leads/${lead.rawId}`)}>
                      <DataTable key="leads" {...tableProps} />
                    </MobileRowsProvider>
                  )}
                </div>
              )}
            </div>
          }
        />
      {/* Overwrite Confirmation Dialog (new parse while a review is active) */}
      <Dialog open={overwriteCandidate !== null} onOpenChange={(open) => { if (!open) setOverwriteCandidate(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Replace current review?</DialogTitle>
            <DialogDescription>
              You have {pendingImports.length} unsaved row{pendingImports.length === 1 ? "" : "s"} under review
              {Object.keys(pendingAssignments).length > 0 ? " (including staff assignments)" : ""}. Importing this
              file will discard {pendingImports.length === 1 ? "it" : "them"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setOverwriteCandidate(null); toast.info("Kept the current review."); }}>Keep current</Button>
            <Button
              className="bg-[#0052FF] text-white hover:bg-[#0052FF]/90"
              onClick={() => { if (overwriteCandidate) applyParsedImports(overwriteCandidate); }}
            >
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Confirmation Dialog */}
      <Dialog open={isDupeConfirmOpen} onOpenChange={(open) => { if (!open) setIsDupeConfirmOpen(false); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Duplicates found</DialogTitle>
            <DialogDescription>
              {dupeRows.length} of {pendingImports.length} rows already exist in the CRM. Inserting will merge them
              into the existing profiles instead of creating new leads.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[280px] overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/50">
            {dupeRows.map(({ row, existing }, i) => (
              <div key={row.rawId ?? i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{i + 1}. {row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.mobile}</p>
                </div>
                <Link
                  href={`/leads/${existing.id}`}
                  className="shrink-0 text-xs font-bold text-[#0052FF] hover:underline whitespace-nowrap"
                  title={`${existing.name} • ${existing.staff ?? "Unassigned"}`}
                >
                  {existing.displayId} ↗
                </Link>
              </div>
            ))}
          </div>
          <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDupeConfirmOpen(false)} disabled={isInserting}>Back</Button>
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={removeDupeRowsAndContinue}
              disabled={isInserting}
            >
              {isInserting ? "Working…" : `Remove ${dupeRows.length} duplicate${dupeRows.length === 1 ? "" : "s"}`}
            </Button>
            <Button
              onClick={insertAllAnyway}
              disabled={isInserting}
              className="bg-[#0052FF] text-white hover:bg-[#0052FF]/90"
            >
              {isInserting ? "Inserting…" : "Insert all anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null || bulkDeleteIds !== null} onOpenChange={(open) => {
        if (!open) {
          setDeleteId(null);
          setBulkDeleteIds(null);
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Lead(s)</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} leads` : 'this lead'}? This action cannot be undone and will remove all associated requirements and follow-ups.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => {
              setDeleteId(null);
              setBulkDeleteIds(null);
            }} disabled={isDeletingBulk}>Cancel</Button>
            <Button variant="destructive" onClick={bulkDeleteIds ? handleBulkDelete : handleDelete} disabled={isDeletingBulk}>
              {isDeletingBulk ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Lead Modal */}
      <AssignLeadModal
        open={assignLeadId !== null}
        onClose={() => {
          setAssignLeadId(null);
          setAssignLeadIds(null);
        }}
        onConfirm={handleAssignLead}
        leadId={assignLeadId ?? undefined}
        department={deptFilter}
        isLoading={isAssigning}
      />

      {/* Pre-assign Modal (Open Pipeline review: stored, applied at insert) */}
      <AssignLeadModal
        open={isPendingAssignOpen}
        onClose={() => {
          setIsPendingAssignOpen(false);
          setPendingAssignTargets([]);
        }}
        onConfirm={(toUserId, staff) => {
          const name = staff?.name ?? `Staff #${toUserId}`;
          setPendingAssignments((prev) => {
            const next = { ...prev };
            for (const rawId of pendingAssignTargets) next[rawId] = { id: toUserId, name };
            return next;
          });
          setIsPendingAssignOpen(false);
          setPendingAssignTargets([]);
          toast.success(`${pendingAssignTargets.length} row${pendingAssignTargets.length === 1 ? "" : "s"} will be assigned to ${name} on insert.`);
        }}
        department={deptFilter}
        title="Assign to staff"
        description="Selected rows will be created directly assigned to this team member instead of entering the routing queue."
      />

      {/* Return to Queue Modal */}
      <Dialog open={returnLeadId !== null} onOpenChange={(open) => {
        if (!open) {
          setReturnLeadId(null);
          setReturnReason("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Re-Assign Lead</DialogTitle>
            <DialogDescription>
              Please provide a reason for returning this lead to the routing queue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason *</label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Why are you returning this lead?"
                className="w-full h-24 rounded-xl border border-input bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setReturnLeadId(null)} disabled={isReturning}>Cancel</Button>
            <Button onClick={handleReturnToQueue} disabled={isReturning || !returnReason.trim()} className="bg-[#0052FF] hover:bg-[#0040CC] text-white">
              {isReturning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Re-Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Modal (mobile quick actions) */}
      <ContactModal
        open={contactModal.open}
        type={contactModal.type}
        to={contactModal.to}
        entityId={contactModal.rawId}
        entityType="leads"
        onClose={() => setContactModal({ open: false, type: "", to: "", rawId: 0 })}
        onSent={() => fetchLeads()}
      />
      </div>
    </>
  );
}
