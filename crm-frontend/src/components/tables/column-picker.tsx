"use client";

import { Columns3, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type PickerColumn = { id: string; label: string; visible: boolean };

/** "Columns" menu: tick the columns to show, or go back to the default set. */
export function ColumnPicker({ columns, onToggle, onReset, changed }: {
  columns: PickerColumn[];
  onToggle: (id: string, visible: boolean) => void;
  onReset: () => void;
  /** The user has moved away from the default columns. */
  changed: boolean;
}) {
  const shown = columns.filter((c) => c.visible).length;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Choose columns"
            title="Choose columns"
            className={cn(
              "relative flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
              changed && "text-foreground",
            )}
          />
        }
      >
        <Columns3 className="size-4" />
        {changed && <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 gap-0 p-0">
        <div className="flex items-baseline justify-between border-b px-3 py-2.5">
          <span className="text-[13px] font-medium">Columns</span>
          <span className="text-[12px] tabular-nums text-muted-foreground">{shown} of {columns.length} shown</span>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {columns.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[14px] hover:bg-muted">
              <Checkbox
                checked={c.visible}
                // Keep at least one column besides the first.
                disabled={c.visible && shown === 1}
                onCheckedChange={(v) => onToggle(c.id, v === true)}
              />
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
            </label>
          ))}
        </div>
        <div className="border-t p-1">
          <button
            type="button"
            onClick={onReset}
            disabled={!changed}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" /> Reset to default
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
