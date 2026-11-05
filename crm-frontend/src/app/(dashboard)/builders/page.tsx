"use client";

import { isAdmin } from "@/lib/permissions";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/tables/data-table";
import { BOARD_PAGE, ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { moveRow } from "@/lib/move-row";
import { ActiveCell, DateCell, IdCell, NameCell, statusDot } from "@/components/tables/cells";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ListBody, ListFrame, ListToolbar, SegmentTabs, ToolbarClear, ToolbarEnd, ToolbarSearch, headerPrimaryClass, toolbarFilterButton } from "@/components/layout/list-page";
import { PageActions } from "@/components/layout/page-actions";
import { Device } from "@/components/shared/device";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useClampedPage, usePersistedState } from "@/hooks/use-persisted-state";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { ExternalLink, Filter, Plus, Search } from "lucide-react";
import type { BuilderRecord } from "@/lib/builders-api";
import { BuilderForm } from "./_components/BuilderForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const BUILDER_FIELDS: ViewField<BuilderRecord>[] = [
  { id: "status", label: "Status", get: (b) => (b.isActive ? "Active" : "Inactive"), order: ["Active", "Inactive"], dot: (v) => statusDot(v) },
];

export default function BuildersPage() {
  const router = useRouter();
  const views = useModuleView("builders", BUILDER_FIELDS);
  const [activeTab, setActiveTab] = usePersistedState<"Active" | "Inactive">("builders:tab", "Active", { allowed: ["Active", "Inactive"] });
  const [searchQuery, setSearchQuery] = usePersistedState("builders:search", "");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [pagination, setPagination] = usePersistedState("builders:page", { pageIndex: 0, pageSize: 10 });

  // Filters state
  const [hasContactFilter, setHasContactFilter] = usePersistedState<string>("builders:contactFilter", "");

  const [builders, setBuilders] = useState<BuilderRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Bulk delete dialog state
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const tabs: ("Active" | "Inactive")[] = ["Active", "Inactive"];

  const fetchBuilders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      const page = views.isBoard ? BOARD_PAGE : pagination;
      params.append("page", String(page.pageIndex + 1));
      params.append("limit", String(page.pageSize));

      if (debouncedSearchQuery.trim()) {
        params.append("search", debouncedSearchQuery.trim());
      }

      params.append("status", activeTab.toLowerCase());

      const res = await apiFetch(`${API_URL}/builders?${params.toString()}`);
      const data = await res.json();

      if (data?.success || Array.isArray(data?.items) || Array.isArray(data?.data)) {
        let list: BuilderRecord[] = data.items || data.data || [];

        // Apply client-side secondary filter if selected
        if (hasContactFilter === "phone") {
          list = list.filter((b) => Boolean(b.phone));
        } else if (hasContactFilter === "email") {
          list = list.filter((b) => Boolean(b.email));
        } else if (hasContactFilter === "website") {
          list = list.filter((b) => Boolean(b.website));
        }

        const total = data.total ?? list.length;
        setBuilders(list);
        setTotalCount(total);
      } else {
        setBuilders([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load builders");
      setBuilders([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, debouncedSearchQuery, activeTab, hasContactFilter, views.isBoard]);

  useEffect(() => {
    fetchBuilders();
  }, [fetchBuilders]);
  useClampedPage(pagination, setPagination, totalCount, isLoading);

  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, []);

  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));

  const activeFiltersCount = hasContactFilter ? 1 : 0;
  const clearFilters = () => {
    setHasContactFilter("");
    resetPage();
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeleting(true);
    try {
      const results = await Promise.allSettled(
        bulkDeleteIds.map((id) => apiFetch(`${API_URL}/builders/${id}`, { method: "DELETE" }))
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length === 0) {
        toast.success(`Successfully deleted ${bulkDeleteIds.length} builder${bulkDeleteIds.length > 1 ? "s" : ""}`);
      } else {
        toast.warning(`Deleted with ${failed.length} failure(s)`);
      }
      setBulkDeleteIds(null);
      fetchBuilders();
    } catch (err: any) {
      toast.error(err.message || "Bulk delete encountered errors");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<BuilderRecord>[] = [
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
      cell: ({ row }) => <IdCell href={`/builders/${row.original.id}`}>{row.original.id}</IdCell>,
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <NameCell name={row.original.name} avatar className="max-w-[260px]" />,
    },
    {
      id: "phone",
      header: "Phone",
      cell: ({ row }) => {
        const phone = row.original.phone;
        return phone ? (
          <span className="tabular-nums">{phone}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "email",
      header: "Email",
      cell: ({ row }) => {
        const email = row.original.email;
        if (!email) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <span className="block max-w-[220px] truncate text-muted-foreground" title={email}>
            {email}
          </span>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        return <ActiveCell active={row.original.isActive} />;
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
    },
  ];

  const tableProps = {
    flush: true as const,
    columns,
    data: builders,
    showToolbar: true,
    showDeleteAction: isAdmin(),
    onDeleteSelected: (rows: BuilderRecord[]) => setBulkDeleteIds(rows.map((r) => r.id)),
    renderToolbarActions: (selectedRows: BuilderRecord[], clearSelection: () => void) => {
      const isSingle = selectedRows.length === 1;
      const row = selectedRows[0];
      return (
        <>
          {isSingle && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                router.push(`/builders/${row.id}`);
                clearSelection();
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open
            </Button>
          )}
        </>
      );
    },
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pagination.pageSize) || 1,
    totalCount,
    pagination,
    onPaginationChange: setPagination,
  };

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
      <PopoverContent align="start" className="w-80 p-0 rounded-2xl shadow-xl overflow-hidden border-border/60">
        <div className="flex items-center justify-between p-4 border-b bg-muted/10">
          <h4 className="font-semibold text-foreground text-sm">Filter Builders</h4>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground hover:text-red-600">
              Clear All
            </Button>
          )}
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Contact Availability</label>
            <FormSelect
              name="contactFilter"
              placeholder="All Builders"
              options={[
                { label: "Has Phone Number", value: "phone" },
                { label: "Has Email ID", value: "email" },
                { label: "Has Website", value: "website" },
              ]}
              value={hasContactFilter}
              onValueChange={(v) => {
                setHasContactFilter(v || "");
                resetPage();
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const searchBar = (isMobile: boolean) => (
    <div className="relative flex-1">
      <Search
        className={
          isMobile
            ? "absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground"
            : "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        }
      />
      <Input
        placeholder={isMobile ? "Search builders..." : "Search name, email, phone..."}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          resetPage();
        }}
        className={
          isMobile
            ? "h-12 pl-11 rounded-2xl bg-black/5 dark:bg-white/10 border-transparent text-sm font-medium placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-foreground/20"
            : "pl-9 h-10 rounded-xl bg-muted/30 border-border/60 text-[13.5px] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        }
      />
    </div>
  );

  const pillTabs = (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              resetPage();
            }}
            className={cn(
              "px-3.5 h-8 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors active:opacity-60",
              isActive
                ? "bg-foreground text-background border-foreground shadow-sm"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
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
      {isLoading ? <TableSkeleton columns={6} rows={10} flush /> : <DataTable {...tableProps} onRowClick={(b) => router.push(`/builders/${b.id}`)} />}
    </div>
  );

  const desktopFilters = (
    <ListFrame>
      <ListToolbar>
        <SegmentTabs tabs={tabs} value={activeTab} onChange={(tab) => { setActiveTab(tab); resetPage(); }} label="Builders views" />
        <ToolbarEnd>
          {views.picker}
          <ToolbarSearch value={searchQuery} onChange={(v) => { setSearchQuery(v); resetPage(); }} placeholder="Search name, email, phone" />
          {renderFilterPopover(false)}
          {(searchQuery || activeFiltersCount > 0) && <ToolbarClear onClick={() => { setSearchQuery(""); clearFilters(); }} />}
        </ToolbarEnd>
      </ListToolbar>
      <ListBody>
        {isLoading ? <TableSkeleton columns={6} rows={10} flush /> : <ModuleViews
          state={views}
          data={builders}
          columns={columns}
          list={
            <DataTable {...tableProps} variant="list" />
          }
          getKey={(b) => b.id}
          onOpen={(b) => router.push(`/builders/${b.id}`)}
          onMove={(b, column) =>
            moveRow({ setRows: setBuilders, row: b, same: (x, y) => x.id === y.id, patch: { isActive: column === "Active" }, request: { path: `/builders/${b.id}`, method: "PUT", body: { isActive: column === "Active" } }, success: `Marked ${column.toLowerCase()}` })
          }
          card={(b) => ({ title: b.name, id: b.id, href: `/builders/${b.id}`, subtitle: b.phone || b.email || undefined })}
          totalCount={totalCount}
          noun="builders"
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
      <MobileHeader title="Builders" />
      {views.switcher}
      <div className="w-full flex flex-col space-y-6 pt-4 md:space-y-0 md:pt-0 md:h-full">
        <PageActions>
          <button type="button" onClick={() => setCreating(true)} className={headerPrimaryClass}>
            <Plus className="size-4" />
            Add Builder
          </button>
        </PageActions>

        <Device mobile={mobileFilters} desktop={desktopFilters} />
        <Device desktop={null} mobile={<div className="w-full">{tableSection}</div>} />
      </div>

      {creating && (
        <BuilderForm
          onClose={() => setCreating(false)}
          onSuccess={(id) => {
            setCreating(false);
            if (id) router.push(`/builders/${id}`);
            else void fetchBuilders();
          }}
        />
      )}

      {/* Bulk Delete Confirm Dialog */}
      <Dialog open={bulkDeleteIds !== null} onOpenChange={(open) => { if (!open) setBulkDeleteIds(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Selected Builders</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds?.length} selected builder{bulkDeleteIds && bulkDeleteIds.length > 1 ? "s" : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBulkDeleteIds(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
