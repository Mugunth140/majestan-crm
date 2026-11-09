"use client";

import Link from "next/link";
import { useMemo, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { NameAvatar } from "@/components/shared/name-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

/** What a board card shows. Every module maps its rows onto this. */
export interface KanbanCardData {
  title: string;
  /** Short record ID shown top-right, e.g. "L00042". */
  id?: ReactNode;
  href?: string;
  /** One muted line under the title (phone, city, email…). */
  subtitle?: ReactNode;
  /** Bottom row, left side (usually an owner/assignee). */
  footer?: ReactNode;
  /** Bottom row, right side (a small tag such as a type). */
  tag?: ReactNode;
  /** Letter avatar beside the title. Defaults on. */
  avatar?: boolean;
}

const DRAG_TYPE = "application/x-crm-card";

/**
 * Rows as a board, one column per value of `columnOf`. Columns in `columnOrder`
 * come first (and always exist when cards can be moved, so empty ones are drop
 * targets); any other values follow alphabetically.
 */
export function KanbanBoard<T>({
  items,
  getKey,
  columnOf,
  columnOrder,
  renderColumnLabel,
  card,
  onOpen,
  onMove,
  canDrop,
  lockedHint,
  emptyState,
  emptyColumnLabel = "Nothing here",
}: {
  items: T[];
  getKey: (item: T) => string | number;
  columnOf: (item: T) => string;
  columnOrder?: readonly string[];
  renderColumnLabel?: (column: string) => ReactNode;
  card: (item: T) => KanbanCardData;
  /** Opens a card that has no `href`. */
  onOpen?: (item: T) => void;
  /** Enables drag and drop between columns. */
  onMove?: (item: T, column: string) => void;
  /** Extra rule for where a dragged card may land (beyond "a different, known column"). */
  canDrop?: (item: T, column: string) => boolean;
  /** Message on a column a card can't move into. */
  lockedHint?: (column: string) => string;
  emptyState?: ReactNode;
  emptyColumnLabel?: string;
}) {
  const [dragging, setDragging] = useState<T | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const columns = useMemo(() => {
    const byColumn = new Map<string, T[]>();
    if (onMove && columnOrder) for (const c of columnOrder) byColumn.set(c, []);
    for (const item of items) {
      const key = columnOf(item) || "—";
      if (!byColumn.has(key)) byColumn.set(key, []);
      byColumn.get(key)!.push(item);
    }
    const rank = (c: string) => {
      const i = columnOrder?.indexOf(c) ?? -1;
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...byColumn.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  }, [items, columnOf, columnOrder, onMove]);

  if (items.length === 0) {
    return emptyState ?? <EmptyState kind="records" title="Nothing to show" description="Records that match this view will appear here as cards." />;
  }

  const allowed = (column: string) =>
    !!dragging &&
    column !== columnOf(dragging) &&
    (!columnOrder || columnOrder.includes(column)) &&
    (canDrop?.(dragging, column) ?? true);

  const endDrag = () => {
    setDragging(null);
    setOver(null);
  };

  const onColumnDragOver = (e: DragEvent, column: string) => {
    if (!allowed(column)) return; // no preventDefault → the browser shows "not allowed"
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (over !== column) setOver(column);
  };

  const onColumnDrop = (e: DragEvent, column: string) => {
    e.preventDefault();
    const item = dragging;
    endDrag();
    if (item && allowed(column)) onMove?.(item, column);
  };

  return (
    <div className="kanban-scroll flex h-full min-h-0 flex-1 gap-3 overflow-x-auto px-5 py-4">
      {columns.map(([column, colItems]) => {
        const locked = !!dragging && column !== columnOf(dragging) && !allowed(column);
        const target = over === column;
        return (
          <section
            key={column}
            aria-label={column}
            onDragOver={onMove ? (e) => onColumnDragOver(e, column) : undefined}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null) && over === column) setOver(null);
            }}
            onDrop={onMove ? (e) => onColumnDrop(e, column) : undefined}
            className={cn(
              "flex max-h-full w-[280px] shrink-0 flex-col rounded-xl bg-muted/50 transition-[background-color,box-shadow,opacity] duration-150 dark:bg-white/[0.03]",
              target && "bg-[#017D58]/[0.07] shadow-[inset_0_0_0_1.5px_rgba(1,125,88,0.45)] dark:bg-[#2FB585]/[0.08]",
              locked && "opacity-50",
            )}
          >
            <header className="flex h-10 shrink-0 items-center gap-2 px-3">
              <h3 className="flex min-w-0 items-center gap-2 truncate text-[14px] font-medium text-foreground">
                {renderColumnLabel ? renderColumnLabel(column) : column}
              </h3>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{colItems.length}</span>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {colItems.map((item) => {
                const c = card(item);
                const key = getKey(item);
                const cardClass = cn(
                  "group block rounded-lg bg-background p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.05)] outline-none transition-[box-shadow,opacity] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_4px_12px_-4px_rgba(0,0,0,0.12)] focus-visible:ring-2 focus-visible:ring-[#017D58]/40 dark:bg-card dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
                  onMove && "cursor-grab active:cursor-grabbing",
                  dragging !== null && getKey(dragging) === key && "opacity-40",
                );
                const dragProps = onMove
                  ? {
                      draggable: true,
                      onDragStart: (e: DragEvent) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData(DRAG_TYPE, String(key));
                        // Let the browser snapshot the card before it dims.
                        requestAnimationFrame(() => setDragging(item));
                      },
                      onDragEnd: endDrag,
                    }
                  : { draggable: false };
                const body = (
                  <>
                    <div className="flex items-center gap-2">
                      {c.avatar !== false && <NameAvatar name={c.title} />}
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">{c.title || "—"}</span>
                      {c.id != null && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{c.id}</span>}
                    </div>
                    {c.subtitle && <div className="mt-2 truncate text-[13px] text-muted-foreground">{c.subtitle}</div>}
                    {(c.footer || c.tag) && (
                      <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2.5">
                        <span className="flex min-w-0 items-center gap-1.5 text-xs text-foreground/80">{c.footer}</span>
                        {c.tag && (
                          <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] capitalize text-muted-foreground">{c.tag}</span>
                        )}
                      </div>
                    )}
                  </>
                );
                return c.href ? (
                  <Link key={key} href={c.href} className={cardClass} {...dragProps}>
                    {body}
                  </Link>
                ) : (
                  <div
                    key={key}
                    className={cn(cardClass, onOpen && "cursor-pointer")}
                    {...dragProps}
                    {...(onOpen && {
                      role: "button",
                      tabIndex: 0,
                      onClick: () => onOpen(item),
                      onKeyDown: (e: KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpen(item);
                        }
                      },
                    })}
                  >
                    {body}
                  </div>
                );
              })}
              {colItems.length === 0 && !locked && (
                <div
                  className={cn(
                    "flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors",
                    target && "border-[#017D58]/50 text-[#017D58] dark:border-[#2FB585]/50 dark:text-[#2FB585]",
                  )}
                >
                  {dragging ? "Drop here" : emptyColumnLabel}
                </div>
              )}
              {locked && (
                <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  <Lock className="size-3.5" strokeWidth={1.75} />
                  {lockedHint?.(column) ?? "Can't move here"}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
