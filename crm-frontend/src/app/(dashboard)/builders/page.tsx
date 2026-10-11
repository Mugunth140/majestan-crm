"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { Edit, Filter, Plus, RefreshCw, Search, X } from "lucide-react";
import { BuilderRecord } from "./_components/BuilderDialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function BuildersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"Active" | "Inactive">("Active");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  // Filters state
  const [hasContactFilter, setHasContactFilter] = useState<string>("");

  const [builders, setBuilders] = useState<BuilderRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Bulk delete dialog state
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const tabs: ("Active" | "Inactive")[] = ["Active", "Inactive"];

  const fetchBuilders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", String(pagination.pageIndex + 1));
      params.append("limit", String(pagination.pageSize));

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
  }, [pagination.pageIndex, pagination.pageSize, debouncedSearchQuery, activeTab, hasContactFilter]);

  useEffect(() => {
    fetchBuilders();
  }, [fetchBuilders]);

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
      accessorKey: "name",
      header: "Builder Name",
      cell: ({ row }) => {
        return (
          <span className="font-semibold text-foreground text-sm truncate max-w-[240px] block" title={row.original.name}>
            {row.original.name}
          </span>
        );
      },
    },
    {
      id: "phone",
      header: "Phone Number",
      cell: ({ row }) => {
        const phone = row.original.phone;
        return phone ? (
          <span className="text-foreground text-sm font-medium">{phone}</span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );
      },
    },
    {
      id: "email",
      header: "Email ID",
      cell: ({ row }) => {
        const email = row.original.email;
        if (!email) {
          return <span className="text-muted-foreground text-sm">-</span>;
        }
        return (
          <span className="text-muted-foreground text-sm truncate max-w-[200px] block" title={email}>
            {email}
          </span>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const active = row.original.isActive;
        return active ? (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium shadow-sm border">
            Active
          </Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 font-medium shadow-sm border">
            Inactive
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("en-GB") : "-"}
        </span>
      ),
    },
  ];

  const tableProps = {
    flush: true as const,
    columns,
    data: builders,
    showToolbar: true,
    showDeleteAction: true,
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
                router.push(`/builders/new?edit=${row.id}`);
                clearSelection();
              }}
            >
              <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          )}
        </>
      );
    },
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pagination.pageSize) || 1,
    pagination,
    onPaginationChange: setPagination,
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
          <Button variant="outline" className="h-10 rounded-xl bg-muted/30 border-border/60 px-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-[13.5px]">Filters</span>
            {activeFiltersCount > 0 && (
              <Badge className="ml-1 bg-[#0052FF] text-white px-1.5 py-0.5 rounded-md text-[10px]">{activeFiltersCount}</Badge>
            )}
          </Button>
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
            ? "absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"
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
              "px-5 h-10 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all border active:scale-95",
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
      {isLoading ? <TableSkeleton columns={6} rows={10} flush /> : <DataTable {...tableProps} />}
    </div>
  );

  const desktopFilters = (
    <div className="bg-card border rounded-xl overflow-hidden shadow-sm md:flex md:flex-col md:flex-1 md:min-h-0">
      <div className="flex items-center justify-between px-6 border-b bg-muted/10 pt-4 gap-4">
        <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide relative">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                resetPage();
              }}
              className={
                "relative pb-4 text-[15px] whitespace-nowrap font-semibold transition-colors duration-200 ease-out " +
                (activeTab === tab ? "text-[#0052FF]" : "text-muted-foreground hover:text-foreground")
              }
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="desktopActiveTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0052FF] rounded-t-full"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b bg-background">
        <div className="flex-1 min-w-[240px] max-w-md">{searchBar(false)}</div>
        {renderFilterPopover(false)}
        {(searchQuery || activeFiltersCount > 0) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSearchQuery("");
              clearFilters();
            }}
            className="h-10 w-10 rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Clear Search & Filters"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="w-full max-w-full min-w-0 md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col">
        {tableSection}
      </div>
    </div>
  );

  const mobileFilters = (
    <div className="px-4 pb-2 space-y-4">
      <div className="flex items-center gap-2">
        {searchBar(true)}
        {renderFilterPopover(true)}
      </div>
      <Button
        onClick={() => router.push("/builders/new")}
        className="flex h-11 w-full rounded-xl bg-[#0052FF] px-4 text-[14px] font-semibold text-white shadow-md hover:bg-[#0052FF]/90 items-center justify-center gap-2 transition-transform active:scale-95"
      >
        <Plus size={18} />
        Add Builder
      </Button>
      {pillTabs}
    </div>
  );

  return (
    <>
      <MobileHeader title="Builders" />
      <div className="w-full flex flex-col space-y-6 pt-4 lg:p-0 md:h-full">
        <Device
          mobile={null}
          desktop={
            <div className="flex h-[48px] items-center justify-between pr-[150px]">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight">Builders</h1>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full border-border/60"
                  onClick={fetchBuilders}
                  title="Refresh"
                >
                  <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                </Button>
                <Button
                  onClick={() => router.push("/builders/new")}
                  className="inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95"
                >
                  <Plus size={18} />
                  Add Builder
                </Button>
              </div>
            </div>
          }
        />

        <Device mobile={mobileFilters} desktop={desktopFilters} />
        <Device desktop={null} mobile={<div className="w-full px-4 md:px-0">{tableSection}</div>} />
      </div>

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
