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
} from "@tanstack/react-table";
import { useState } from "react";

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
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  showToolbar = false,
  showDeleteAction = false,
  onDeleteSelected,
  renderToolbarActions,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
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
    },
  });

  return (
    <div className="space-y-4 md:space-y-0 md:flex md:flex-col md:flex-1 md:h-full md:min-h-0 md:gap-4 w-full">
      {/* Floating Toolbar for Selected Actions */}
      {Object.keys(rowSelection).length > 0 && showToolbar && (
        <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md border border-border/50 animate-in fade-in slide-in-from-bottom-2">
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

      <div className="rounded-md border bg-card overflow-x-auto md:flex-1 md:h-full md:overflow-y-auto w-full relative">
        <table className="min-w-max md:min-w-full w-full caption-bottom text-sm">
          <TableHeader className="border-b border-border sticky top-0 z-20 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                {headerGroup.headers.map((header, idx) => (
                  <TableHead
                    key={header.id}
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
                    onClick={() => onRowClick && onRowClick(row.original)}
                    className="hover:bg-muted/50 transition-colors duration-150 cursor-pointer border-b border-border/40 active:scale-[0.998]"
                  >
                    {row.getVisibleCells().map((cell, idx) => (
                      <TableCell
                        key={cell.id}
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
                {Array.from({ length: Math.max(0, table.getState().pagination.pageSize - table.getRowModel().rows.length) }).map((_, i) => (
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

      <div className="flex items-center justify-between md:mt-auto pt-1">
        <div className="text-sm text-muted-foreground">
          Showing{" "}
          {table.getFilteredRowModel().rows.length > 0
            ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1
            : 0}{" "}
          to{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}{" "}
          of {table.getFilteredRowModel().rows.length} entries
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
    </div>
  );
}
