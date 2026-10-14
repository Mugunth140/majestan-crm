"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  RowSelectionState,
  PaginationState,
} from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { usePersistedState } from "@/hooks/use-persisted-state";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    hideOnMobile?: boolean;
    /** Fixed pixel width for narrow columns (e.g. Actions). Opt-in only. */
    fixedWidth?: number;
  }
}

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  showToolbar?: boolean;
  showDeleteAction?: boolean;
  onDeleteSelected?: (selectedRows: TData[]) => void;
  renderToolbarActions?: (selectedRows: TData[], clearSelection: () => void) => React.ReactNode;
  flush?: boolean;
  hidePagination?: boolean;
  pageSize?: number;
  manualPagination?: boolean;
  pageCount?: number;
  /** Server-side total for the footer. Without it the footer counts only the current page rows. */
  totalCount?: number;
  pagination?: {
    pageIndex: number;
    pageSize: number;
  };
  onPaginationChange?: (updater: any) => void;
  onSelectionChange?: (selectedRows: TData[]) => void;
  /**
   * Remembers sort + (client-side) page per route so returning from a detail
   * page lands on the same rows. Defaults on, keyed by pathname; pass a name
   * when one route swaps between different tables, or false to opt out.
   */
  persistKey?: string | false;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  showToolbar = false,
  showDeleteAction = false,
  onDeleteSelected,
  renderToolbarActions,
  flush = false,
  hidePagination = false,
  pageSize = 10,
  manualPagination,
  pageCount,
  totalCount,
  pagination,
  onPaginationChange,
  onSelectionChange,
  persistKey,
}: DataTableProps<TData, TValue>) {
  const pathname = usePathname();
  const stateKey = `table:${pathname}:${persistKey || "main"}`;
  const [savedSorting, setSavedSorting] = usePersistedState<SortingState>(`${stateKey}:sort`, []);
  const [localSorting, setLocalSorting] = useState<SortingState>([]);
  const [sorting, setSorting] = persistKey === false ? [localSorting, setLocalSorting] : [savedSorting, setSavedSorting];
  // Client-side page only: server-paginated tables get pagination from the parent.
  const [savedPageIndex, setSavedPageIndex] = usePersistedState<number>(`${stateKey}:page`, 0);
  const [localPageIndex, setLocalPageIndex] = useState(0);
  const [pageIndex, setPageIndex] = persistKey === false ? [localPageIndex, setLocalPageIndex] : [savedPageIndex, setSavedPageIndex];
  const clientPagination: PaginationState = { pageIndex, pageSize };
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      pagination: manualPagination && pagination ? pagination : clientPagination,
    },
    ...(manualPagination
      ? {
          manualPagination: true,
          pageCount: pageCount ?? -1,
          onPaginationChange,
        }
      : {
          // Page resets are handled below so the restored page survives the first load
          autoResetPageIndex: false,
          onPaginationChange: (updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
            const next = typeof updater === "function" ? updater(clientPagination) : updater;
            setPageIndex(next.pageIndex);
          },
        })
  });

  // The first non-empty data is the restore point: keep the saved page, but
  // pull it back if the list shrank. Any later data change (tab/search/filter
  // on the parent) returns to page 1, like TanStack's default auto-reset.
  const seenDataRef = useRef<TData[] | null>(null);
  const restoredRef = useRef(false);
  useEffect(() => {
    if (manualPagination || seenDataRef.current === data) return;
    seenDataRef.current = data;
    if (data.length === 0) return;
    if (!restoredRef.current) {
      restoredRef.current = true;
      const lastPage = Math.max(0, Math.ceil(table.getPrePaginationRowModel().rows.length / pageSize) - 1);
      if (pageIndex > lastPage) setPageIndex(lastPage);
      return;
    }
    setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, manualPagination]);

  // Lift selection up when a parent needs it (e.g. review banner actions)
  const selectionKey = Object.keys(rowSelection).sort().join(",");
  useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange(table.getFilteredSelectedRowModel().rows.map((r) => r.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  return (
    <div className="space-y-4 md:space-y-0 md:flex md:flex-col md:flex-1 md:h-full md:min-h-0 md:gap-4 w-full min-w-0 max-w-full">
      {/* Floating Toolbar for Selected Actions */}
      {Object.keys(rowSelection).length > 0 && showToolbar && (
        <div className={cn(
          "flex items-center justify-between p-2 bg-muted/50 rounded-md border border-border/50 animate-in fade-in slide-in-from-bottom-2",
          flush ? "mx-6 mt-4" : ""
        )}>
          <span className="text-sm font-medium px-2 text-primary">
            {Object.keys(rowSelection).length} Selected
          </span>
          <div className="flex gap-2">
            {renderToolbarActions && renderToolbarActions(
              table.getFilteredSelectedRowModel().rows.map(r => r.original),
              table.resetRowSelection
            )}
            {showDeleteAction && onDeleteSelected && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => {
                  const selectedRows = table.getFilteredSelectedRowModel().rows.map(r => r.original);
                  onDeleteSelected(selectedRows);
                  table.resetRowSelection();
                }}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      )}

      <div className={cn(
        "overflow-auto table-scroll md:flex-1 md:h-full md:min-h-0 w-full max-w-full min-w-0 relative",
        flush ? "" : "rounded-md border bg-card"
      )}>
        <table className="min-w-max w-full caption-bottom text-sm">
          <TableHeader className="border-b border-border sticky top-0 z-20 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                {headerGroup.headers.map((header, idx) => (
                  <TableHead
                    key={header.id}
                    style={(header.column.columnDef.meta as any)?.fixedWidth ? { width: (header.column.columnDef.meta as any).fixedWidth, maxWidth: (header.column.columnDef.meta as any).fixedWidth } : undefined}
                    className={cn(
                      "text-[13px] h-11 font-semibold tracking-wide text-muted-foreground whitespace-nowrap border-r border-border last:border-r-0 px-4 text-center bg-muted",
                      idx === 0 ? "sticky left-0 z-30" : "",
                      (header.column.columnDef.meta as any)?.hideOnMobile ? "hidden md:table-cell" : ""
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              <>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a,button")) return;
                      row.toggleSelected();
                      if (onRowClick) onRowClick(row.original);
                    }}
                    className="hover:bg-muted/50 transition-colors duration-150 cursor-pointer border-b border-border/40 active:scale-[0.998]"
                  >
                    {row.getVisibleCells().map((cell, idx) => (
                      <TableCell
                        key={cell.id}
                        style={(cell.column.columnDef.meta as any)?.fixedWidth ? { width: (cell.column.columnDef.meta as any).fixedWidth, maxWidth: (cell.column.columnDef.meta as any).fixedWidth } : undefined}
                        className={cn(
                          "py-2.5 px-4 text-[14px] border-r border-border/40 last:border-r-0 text-center",
                          idx === 0 ? "sticky left-0 z-10 bg-card" : "",
                          (cell.column.columnDef.meta as any)?.hideOnMobile ? "hidden md:table-cell" : ""
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {Array.from({ length: hidePagination ? 0 : Math.max(0, table.getState().pagination.pageSize - table.getRowModel().rows.length) }).map((_, i) => (
                  <TableRow key={`empty-${i}`} className="hover:bg-transparent border-b border-border/40">
                    {columns.map((col, colIdx) => (
                      <TableCell 
                        key={`empty-cell-${i}-${colIdx}`} 
                        className={cn(
                          "py-2.5 px-4 h-[45px] border-r border-border/40 last:border-r-0",
                          colIdx === 0 ? "sticky left-0 z-10 bg-card" : "",
                          (col.meta as any)?.hideOnMobile ? "hidden md:table-cell" : ""
                        )} 
                      />
                    ))}
                  </TableRow>
                ))}
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>

      {!hidePagination && (
      <div className={cn(
        "flex items-center justify-between md:mt-auto sticky bottom-0 bg-card z-30 pb-24 pt-4 md:pb-4 md:pt-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] md:shadow-none",
        flush ? "px-6 border-t border-border/40" : ""
      )}>
        <div className="text-sm text-muted-foreground">
          {(() => {
            // Server-paginated tables only hold one page of rows: count the
            // server total when provided, otherwise fall back to page rows.
            const pageRows = table.getFilteredRowModel().rows.length;
            const total = totalCount ?? pageRows;
            const from = pageRows > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0;
            const to = pageRows > 0
              ? Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, total)
              : 0;
            return <>Showing {from} to {to} of {total} entries</>;
          })()}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
