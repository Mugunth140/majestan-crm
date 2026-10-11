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
import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { Edit, ExternalLink, HardHat, Mail, Phone, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { BuilderRecord } from "./_components/BuilderDialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function BuildersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"All" | "Active" | "Inactive">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const [builders, setBuilders] = useState<BuilderRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Single and Bulk delete
  const [deleteTarget, setDeleteTarget] = useState<BuilderRecord | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [role, setRole] = useState("");

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
      setRole(user?.role?.name || user?.role || "");
    } catch { /* ignore */ }
  }, []);

  const tabs: ("All" | "Active" | "Inactive")[] = ["All", "Active", "Inactive"];

  const fetchBuilders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", String(pagination.pageIndex + 1));
      params.append("limit", String(pagination.pageSize));

      if (debouncedSearchQuery.trim()) {
        params.append("search", debouncedSearchQuery.trim());
      }

      if (activeTab === "Active") {
        params.append("status", "active");
      } else if (activeTab === "Inactive") {
        params.append("status", "inactive");
      } else {
        params.append("status", "all");
      }

      const res = await apiFetch(`${API_URL}/builders?${params.toString()}`);
      const data = await res.json();

      if (data?.success || Array.isArray(data?.items) || Array.isArray(data?.data)) {
        const list = data.items || data.data || [];
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
  }, [pagination.pageIndex, pagination.pageSize, debouncedSearchQuery, activeTab]);

  useEffect(() => {
    fetchBuilders();
  }, [fetchBuilders]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, []);

  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`${API_URL}/builders/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to delete builder");
      }
      toast.success("Builder deleted successfully");
      setDeleteTarget(null);
      fetchBuilders();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete builder");
    } finally {
      setIsDeleting(false);
    }
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
      header: "Builder",
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-muted/60 border border-border/60 overflow-hidden flex items-center justify-center shrink-0">
              {b.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.logoUrl}
                  alt={b.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    // Fallback to initial on image broken
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="h-full w-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                  {b.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="font-semibold text-foreground text-sm truncate max-w-[200px]" title={b.name}>
                {b.name}
              </span>
              {b.website ? (
                <a
                  href={b.website.startsWith("http") ? b.website : `https://${b.website}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-[#0052FF] hover:underline flex items-center gap-1 truncate max-w-[180px]"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{b.website.replace(/^https?:\/\//, "")}</span>
                </a>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: "contact",
      header: "Contact",
      cell: ({ row }) => {
        const b = row.original;
        if (!b.phone && !b.email) {
          return <span className="text-muted-foreground text-sm">-</span>;
        }
        return (
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground min-w-0">
            {b.phone && (
              <span className="flex items-center gap-1 text-foreground font-medium truncate">
                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                {b.phone}
              </span>
            )}
            {b.email && (
              <span className="flex items-center gap-1 truncate" title={b.email}>
                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{b.email}</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "experienceYears",
      header: "Experience",
      cell: ({ row }) => {
        const exp = row.original.experienceYears;
        return (
          <span className="text-sm font-medium">
            {exp != null && exp > 0 ? `${exp} Yrs` : "-"}
          </span>
        );
      },
    },
    {
      id: "projects",
      header: "Projects",
      cell: ({ row }) => {
        const c = row.original.completedProjects ?? 0;
        const o = row.original.ongoingProjects ?? 0;
        if (c === 0 && o === 0) {
          return <span className="text-muted-foreground text-sm">-</span>;
        }
        return (
          <div className="text-xs">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{c} Completed</span>
            <span className="text-muted-foreground mx-1">/</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{o} Ongoing</span>
          </div>
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
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => router.push(`/builders/new?edit=${b.id}`)}
              title="Edit Builder"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteTarget(b)}
              title="Delete Builder"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
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
            ? "pl-11 h-12 bg-black/5 dark:bg-white/10 border-transparent rounded-2xl text-[16px] focus-visible:ring-1 focus-visible:ring-primary shadow-none"
            : "pl-9 h-10 bg-muted/30 rounded-xl border-border/60 text-[13.5px]"
        }
      />
      {isMobile && searchQuery && (
        <button
          onClick={() => {
            setSearchQuery("");
            resetPage();
          }}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 bg-muted-foreground/20 rounded-full text-foreground hover:bg-muted-foreground/30"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  const pillTabs = (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
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
      {isLoading ? <TableSkeleton columns={8} rows={10} flush /> : <DataTable {...tableProps} />}
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
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSearchQuery("");
              resetPage();
            }}
            className="h-10 w-10 rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Clear Search"
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
      <div className="flex items-center gap-2">{searchBar(true)}</div>
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

      {/* Single Delete Confirm Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Builder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSingle} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirm Dialog */}
      <Dialog open={bulkDeleteIds !== null} onOpenChange={(open) => { if (!open) setBulkDeleteIds(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Builder{bulkDeleteIds && bulkDeleteIds.length > 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {bulkDeleteIds ? `${bulkDeleteIds.length} builder${bulkDeleteIds.length > 1 ? "s" : ""}` : "these builders"}? This action cannot be undone.
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
