"use client";

import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { GroupedList } from "@/components/tables/grouped-list";
import { EmptyState } from "@/components/shared/empty-state";
import { ViewSwitcher, type ViewType } from "@/components/views/view-switcher";
import { GroupByPicker } from "@/components/views/group-by-picker";
import { KanbanBoard, type KanbanCardData } from "@/components/views/kanban-board";
import { MobileRowsProvider } from "@/components/mobile/mobile-rows";
import { cn } from "@/lib/utils";

// List / Kanban / Group By for any module. A module describes the fields it can
// be grouped on once; the same fields become kanban columns and group sections.

/** Most list pages work with untyped API rows, so a field defaults to those. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ViewField<T = any> {
  id: string;
  label: string;
  /** The row's value for this field; empty values group under "—". */
  get: (row: T) => string | null | undefined;
  /** Known values in display order (e.g. a pipeline); others follow alphabetically. */
  order?: readonly string[];
  /** Dot colour class for a value, shown beside group and column labels. */
  dot?: (value: string) => string | undefined;
  /** Lower-case values (e.g. "draft") are shown capitalised. */
  capitalize?: boolean;
}

/** Rows fetched for board views on server-paginated modules (the API caps a page at 200). */
export const BOARD_PAGE = { pageIndex: 0, pageSize: 200 };

/**
 * View state for a module page, remembered per user like the other list settings.
 * `kanbanField` picks which field becomes the board's columns (default: the first).
 */
export function useModuleView<T>(key: string, fields: readonly ViewField<T>[], kanbanField?: string) {
  const [view, setView] = usePersistedState<ViewType>(`${key}:view`, "list", { allowed: ["list", "kanban", "group"] });
  const [groupId, setGroupId] = usePersistedState<string>(`${key}:groupBy`, fields[0]?.id ?? "", {
    allowed: fields.map((f) => f.id),
  });
  const groupField = fields.find((f) => f.id === groupId) ?? fields[0];
  const columnField = fields.find((f) => f.id === kanbanField) ?? fields[0];
  return {
    view,
    setView,
    /** True for Kanban and Group By: show every matching row, not one page. */
    isBoard: view !== "list",
    fields,
    groupField,
    columnField,
    /** "Leads / List ⌄" crumb in the page header. */
    switcher: <ViewSwitcher value={view} onChange={setView} />,
    /** Toolbar picker, only while grouping. */
    picker: view === "group" && fields.length > 1 ? <GroupByPicker fields={fields} value={groupField.id} onChange={setGroupId} /> : null,
  };
}

export type ModuleViewState<T> = ReturnType<typeof useModuleView<T>>;

function FieldLabel<T>({ field, value }: { field: ViewField<T>; value: string }) {
  const dot = value !== "—" ? field.dot?.(value) : undefined;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {dot && <span className={cn("size-2 shrink-0 rounded-full", dot)} />}
      <span className={cn("truncate", field.capitalize && "capitalize")}>{value}</span>
    </span>
  );
}

/** Lets the module's DataTable list rows natively on phones: the card's fields, with the board column's value as the status. */
export function ModuleMobileRows<T>({
  state,
  card,
  onOpen,
  children,
}: {
  state: ModuleViewState<T>;
  card: (row: T) => KanbanCardData;
  onOpen?: (row: T) => void;
  children: ReactNode;
}) {
  const field = state.columnField;
  const row = (r: T) => {
    const value = field.get(r);
    return { ...card(r), status: value ? { label: value, dot: field.dot?.(value) } : undefined };
  };
  return (
    <MobileRowsProvider row={row} onOpen={onOpen}>
      {children}
    </MobileRowsProvider>
  );
}

export function ModuleViews<T>({
  state,
  data,
  list,
  columns,
  getKey,
  card,
  onOpen,
  onMove,
  canDrop,
  lockedHint,
  emptyState,
  totalCount,
  noun = "records",
}: {
  state: ModuleViewState<T>;
  data: T[];
  /** The module's normal list (its DataTable). */
  list: ReactNode;
  /** Columns for the Group By list; the selection column is dropped automatically. */
  columns: ColumnDef<T, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  getKey: (row: T) => string | number;
  card: (row: T) => KanbanCardData;
  onOpen?: (row: T) => void;
  /** Enables kanban drag and drop on the column field. */
  onMove?: (row: T, value: string) => void;
  canDrop?: (row: T, value: string) => boolean;
  lockedHint?: (value: string) => string;
  emptyState?: ReactNode;
  /** Server total, to say when a board shows only the first rows. */
  totalCount?: number;
  noun?: string;
}) {
  const { view, groupField, columnField } = state;
  if (view === "list") {
    return (
      <ModuleMobileRows state={state} card={card} onOpen={onOpen}>
        {list}
      </ModuleMobileRows>
    );
  }

  const truncated = totalCount != null && totalCount > data.length && (
    <p className="border-t px-5 py-2 text-[13px] text-muted-foreground">
      Showing the first {data.length} of {totalCount} {noun}. Narrow it down with search or filters.
    </p>
  );

  if (view === "kanban") {
    return (
      <>
        <KanbanBoard
          items={data}
          getKey={getKey}
          columnOf={(row) => columnField.get(row) || "—"}
          columnOrder={columnField.order}
          renderColumnLabel={(value) => <FieldLabel field={columnField} value={value} />}
          card={card}
          onOpen={onOpen}
          onMove={onMove}
          canDrop={canDrop}
          lockedHint={lockedHint}
          emptyState={emptyState}
        />
        {truncated}
      </>
    );
  }

  return (
    <>
      <GroupedList
        columns={columns.filter((c) => c.id !== "select")}
        data={data}
        groupBy={(row) => groupField.get(row) || "—"}
        groupOrder={groupField.order ? [...groupField.order] : undefined}
        renderGroupLabel={(value) => <FieldLabel field={groupField} value={value} />}
        onRowClick={onOpen}
        emptyState={
          emptyState ? (
            <div className="sticky left-0">{emptyState}</div>
          ) : (
            <EmptyState className="sticky left-0" kind="search" title="No results" description="Nothing to show here yet. Try a different search or filter." />
          )
        }
      />
      {truncated}
    </>
  );
}
