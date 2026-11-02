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
  type Row,
} from "@tanstack/react-table";
import { memo, useEffect, useRef, useState, type CSSProperties, type ReactElement, type RefObject } from "react";
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
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
  /**
   * "list" is the Frappe-style list: a soft rounded header row, left-aligned cells,
   * hairline row dividers, a floating selection bar and a page-size footer.
   */
  variant?: "default" | "list";
  /** Page sizes offered in the list variant's footer */
  pageSizeOptions?: number[];
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
  variant = "default",
  pageSizeOptions = [20, 50, 100],
}: DataTableProps<TData, TValue>) {
  const isList = variant === "list";
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
  // Rows are memoised, so they read the latest click handler through a ref.
  const onRowClickRef = useRef(onRowClick);
  useEffect(() => {
    onRowClickRef.current = onRowClick;
  });
  // List rows reveal one by one the first time data arrives, then never again.
  const [entering, setEntering] = useState(isList);
  const hasRows = data.length > 0;
  useEffect(() => {
    if (!entering || !hasRows) return;
    const t = setTimeout(() => setEntering(false), ENTER_STAGGER_MS * ENTER_MAX_ROWS + 400);
    return () => clearTimeout(t);
  }, [entering, hasRows]);

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
    <div className={cn("space-y-4 md:space-y-0 md:flex md:flex-col md:flex-1 md:h-full md:min-h-0 w-full min-w-0 max-w-full", isList ? "md:gap-0" : "md:gap-4")}>
      {/* Floating Toolbar for Selected Actions */}
      {Object.keys(rowSelection).length > 0 && showToolbar && isList && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-popover py-1.5 pl-4 pr-1.5 text-popover-foreground shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.06)] animate-in fade-in slide-in-from-bottom-3 dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.1)]">
            <span className="mr-2 text-[14px] font-medium">{Object.keys(rowSelection).length} selected</span>
            {renderToolbarActions && renderToolbarActions(
              table.getFilteredSelectedRowModel().rows.map(r => r.original),
              table.resetRowSelection
            )}
            {showDeleteAction && onDeleteSelected && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDeleteSelected(table.getFilteredSelectedRowModel().rows.map(r => r.original));
                  table.resetRowSelection();
                }}
              >
                Delete
              </Button>
            )}
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => table.resetRowSelection()}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
      {Object.keys(rowSelection).length > 0 && showToolbar && !isList && (
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
        flush || isList ? "" : "rounded-md border bg-card",
        isList && "px-5 pt-3"
      )}>
        <table className={cn("min-w-max w-full caption-bottom text-sm", isList && "border-separate border-spacing-0")}>
          <TableHeader className={cn("sticky top-0 z-20", isList ? "bg-background [&_tr]:border-0" : "border-b border-border shadow-sm")}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                {headerGroup.headers.map((header, idx) => (
                  <TableHead
                    key={header.id}
                    style={(header.column.columnDef.meta as any)?.fixedWidth ? { width: (header.column.columnDef.meta as any).fixedWidth, maxWidth: (header.column.columnDef.meta as any).fixedWidth } : undefined}
                    className={cn(
                      isList
                        ? "h-8 whitespace-nowrap bg-muted/70 px-3 text-left text-[13px] font-normal text-muted-foreground first:rounded-l-md last:rounded-r-md"
                        : "text-[13px] h-11 font-semibold tracking-wide text-muted-foreground whitespace-nowrap border-r border-border last:border-r-0 px-4 text-center bg-muted",
                      idx === 0 ? cn("sticky left-0 z-30", isList && STICKY_HEAD) : "",
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
                {table.getRowModel().rows.map((row, i) => (
                  <DataRow
                    key={row.id}
                    row={row}
                    selected={row.getIsSelected()}
                    isList={isList}
                    onRowClick={onRowClickRef}
                    enterIndex={entering ? i : undefined}
                  />
                ))}
                {Array.from({ length: hidePagination || isList ? 0 : Math.max(0, table.getState().pagination.pageSize - table.getRowModel().rows.length) }).map((_, i) => (
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
                <TableCell colSpan={columns.length} className={cn("h-24 text-center text-muted-foreground", isList && "h-40 border-0")}>
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>

      {!hidePagination && isList && (() => {
        const { pageIndex: pi, pageSize: ps } = table.getState().pagination;
        const pageRows = table.getFilteredRowModel().rows.length;
        const total = totalCount ?? pageRows;
        const from = pageRows > 0 ? pi * ps + 1 : 0;
        const to = pageRows > 0 ? Math.min((pi + 1) * ps, total) : 0;
        return (
          <div className="flex items-center justify-between border-t px-5 py-2.5 md:mt-auto">
            {/* A fixed page size needs no picker */}
            <div className={cn("flex items-center rounded-md bg-muted/70 p-0.5", pageSizeOptions.length < 2 && "invisible")}>
              {pageSizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => table.setPagination({ pageIndex: 0, pageSize: size })}
                  className={cn(
                    "h-7 min-w-10 rounded px-2 text-[13px] transition-colors",
                    ps === size
                      ? "bg-background font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:bg-white/10"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] tabular-nums text-muted-foreground">
                {total > 0 ? <>{from}–{to} of {total}</> : "0 of 0"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {!hidePagination && !isList && (
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

const ENTER_STAGGER_MS = 28;
const ENTER_MAX_ROWS = 16;

// The list scroller has a 20px gutter (px-5): sticky cells paint it too, with
// opaque colours, so rows scrolling sideways never show through or beside them.
const GUTTER = "before:pointer-events-none before:absolute before:inset-y-0 before:-left-5 before:w-5 before:bg-background";
const STICKY_HEAD = cn("bg-[color-mix(in_oklab,var(--muted)_70%,var(--background))]", GUTTER);
const STICKY_CELL = cn(
  GUTTER,
  "bg-background group-hover/row:bg-[color-mix(in_oklab,var(--muted)_40%,var(--background))] group-data-[state=selected]/row:bg-[color-mix(in_oklab,var(--muted)_60%,var(--background))]",
);

// One body row. Memoised so typing in a search box or opening a menu on the
// page doesn't re-render every cell; TanStack keeps row objects stable until
// the data or columns change.
const DataRow = memo(function DataRow<TData>({
  row,
  selected,
  isList,
  onRowClick,
  enterIndex,
}: {
  row: Row<TData>;
  selected: boolean;
  isList: boolean;
  onRowClick: RefObject<((row: TData) => void) | undefined>;
  enterIndex?: number;
}) {
  const entering = enterIndex !== undefined && enterIndex < ENTER_MAX_ROWS;
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button")) return;
        row.toggleSelected();
        onRowClick.current?.(row.original);
      }}
      style={entering ? ({ "--enter-delay": `${enterIndex * ENTER_STAGGER_MS}ms` } as CSSProperties) : undefined}
      className={cn(
        "cursor-pointer transition-colors duration-150",
        isList
          ? "group/row border-0 hover:bg-transparent data-[state=selected]:bg-transparent"
          : "hover:bg-muted/50 border-b border-border/40 active:scale-[0.998]",
        entering && "row-enter",
      )}
    >
      {row.getVisibleCells().map((cell, idx) => (
        <TableCell
          key={cell.id}
          style={cell.column.columnDef.meta?.fixedWidth ? { width: cell.column.columnDef.meta.fixedWidth, maxWidth: cell.column.columnDef.meta.fixedWidth } : undefined}
          className={cn(
            isList
              ? "h-11 border-b border-border/60 px-3 text-left text-[14px] text-foreground transition-colors group-hover/row:bg-muted/40 group-data-[state=selected]/row:bg-muted/60 first:rounded-l-md last:rounded-r-md"
              : "py-2.5 px-4 text-[14px] border-r border-border/40 last:border-r-0 text-center",
            idx === 0 ? cn("sticky left-0 z-10", isList ? STICKY_CELL : "bg-card") : "",
            cell.column.columnDef.meta?.hideOnMobile ? "hidden md:table-cell" : ""
          )}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}) as <TData>(props: {
  row: Row<TData>;
  selected: boolean;
  isList: boolean;
  onRowClick: RefObject<((row: TData) => void) | undefined>;
  enterIndex?: number;
}) => ReactElement;
