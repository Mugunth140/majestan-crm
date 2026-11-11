"use client";

import { useMemo } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { columnPrefKey, useColumnPrefs } from "@/hooks/use-column-prefs";

/**
 * Which columns a table shows for the signed-in user. Every column with a
 * text header (or meta.label) can be hidden, except the first one after the
 * row checkboxes (it names the row) and actions. `name` null turns the choice off.
 */
export function useTableColumns<TData, TValue>(columns: ColumnDef<TData, TValue>[], pathname: string, name: string | null) {
  const pickable = useMemo(() => columns.filter((c) => c.id !== "select").flatMap((col, index) => {
    const c = col as ColumnDef<TData, TValue> & { accessorKey?: string };
    const id = c.id ?? c.accessorKey;
    const label = c.meta?.label ?? (typeof c.header === "string" ? c.header : "");
    if (!id || !label.trim() || index === 0 || c.meta?.hideable === false || id === "actions") return [];
    return [{ id: String(id), label, defaultVisible: !c.meta?.defaultHidden }];
  }), [columns]);
  const prefKey = name !== null && pickable.length >= 2 ? columnPrefKey(pathname, name) : null;
  const { overrides, save, reset } = useColumnPrefs(prefKey);
  const columnVisibility: VisibilityState = useMemo(() => {
    const v: VisibilityState = {};
    for (const c of pickable) v[c.id] = overrides[c.id] ?? c.defaultVisible;
    return v;
  }, [pickable, overrides]);

  const toggle = (id: string, visible: boolean) => {
    const def = pickable.find((c) => c.id === id)?.defaultVisible ?? true;
    const next = { ...overrides };
    if (visible === def) delete next[id];
    else next[id] = visible;
    save(next);
  };

  return {
    /** Null when this table has no Columns menu. */
    prefKey,
    columnVisibility,
    visibleKey: pickable.filter((c) => columnVisibility[c.id]).map((c) => c.id).join(","),
    picker: {
      columns: pickable.map((c) => ({ id: c.id, label: c.label, visible: !!columnVisibility[c.id] })),
      onToggle: toggle,
      onReset: reset,
      changed: pickable.some((c) => columnVisibility[c.id] !== c.defaultVisible),
    },
  };
}
