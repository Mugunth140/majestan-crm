"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

// Frappe-style "Group By" list: one header, then a collapsible section per group value.
export function GroupedList<TData>({
  columns,
  data,
  groupBy,
  groupOrder,
  renderGroupLabel,
  onRowClick,
  emptyState,
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  groupBy: (row: TData) => string;
  /** Known group keys in display order; others follow alphabetically */
  groupOrder?: string[];
  renderGroupLabel?: (key: string) => ReactNode;
  onRowClick?: (row: TData) => void;
  emptyState?: ReactNode;
}) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, ReturnType<typeof table.getRowModel>["rows"]>();
    for (const row of table.getRowModel().rows) {
      const key = groupBy(row.original) || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    const rank = (k: string) => {
      const i = groupOrder?.indexOf(k) ?? -1;
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...map.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, groupBy, groupOrder]);

  const colCount = table.getVisibleLeafColumns().length;

  return (
    <div className="table-scroll relative w-full min-w-0 overflow-auto px-5 pt-3 md:h-full md:min-h-0 md:flex-1">
      <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-20 bg-background">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="h-8 whitespace-nowrap bg-muted/70 px-3 text-left text-[13px] font-normal text-muted-foreground first:rounded-l-md last:rounded-r-md"
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {groups.length === 0 ? null : (
          groups.map(([key, rows]) => {
            const open = !collapsed[key];
            return (
              <tbody key={key}>
                <tr>
                  <td colSpan={colCount} className="pt-3">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setCollapsed((c) => ({ ...c, [key]: open }))}
                      className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] font-medium text-foreground hover:bg-muted/50"
                    >
                      <ChevronRight
                        className={cn("size-4 text-muted-foreground transition-transform duration-150", open && "rotate-90")}
                      />
                      {renderGroupLabel ? renderGroupLabel(key) : key}
                      <span className="rounded bg-muted px-1.5 text-xs font-normal tabular-nums text-muted-foreground">
                        {rows.length}
                      </span>
                    </button>
                  </td>
                </tr>
                {open &&
                  rows.map((row) => (
                    <Fragment key={row.id}>
                      <tr
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("a,button")) return;
                          onRowClick?.(row.original);
                        }}
                        className={cn("group/row", onRowClick && "cursor-pointer")}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="h-11 border-b border-border/60 px-3 text-left text-[14px] transition-colors group-hover/row:bg-muted/40"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  ))}
              </tbody>
            );
          })
        )}
      </table>
      {groups.length === 0 &&
        (emptyState ?? <EmptyState className="sticky left-0" kind="search" title="No results" description="Nothing to show here yet. Try a different search or filter." />)}
    </div>
  );
}
