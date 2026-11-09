"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FOCUS_BUTTON } from "@/components/shared/focus-modal";
import { FOCUS_INPUT } from "@/components/shared/focus-steps";
import { EMPTY_LAYOUT, type AssetLayout } from "@/lib/asset-options";
import { cn } from "@/lib/utils";

const COLUMNS: { key: keyof AssetLayout; label: string; placeholder: string; numeric?: boolean; className: string }[] = [
  { key: "layout_no", label: "Layout no.", placeholder: "L-12", className: "md:w-24" },
  { key: "name", label: "Name", placeholder: "Green Meadows", className: "md:flex-1" },
  { key: "price", label: "Price (₹)", placeholder: "450000", numeric: true, className: "md:w-32" },
  { key: "duration", label: "Duration", placeholder: "18 months", className: "md:w-32" },
  { key: "no_of_plots", label: "Plots", placeholder: "40", numeric: true, className: "md:w-20" },
];

/** The layouts approved on or next to the site, one row each. */
export function LayoutsEditor({ rows, onChange }: { rows: AssetLayout[]; onChange: (rows: AssetLayout[]) => void }) {
  const set = (index: number, key: keyof AssetLayout, value: string) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className="hidden gap-2 px-0.5 text-[13px] font-medium text-muted-foreground md:flex">
          {COLUMNS.map((c) => <span key={c.key} className={c.className}>{c.label}</span>)}
          <span className="w-8" />
        </div>
      )}
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-2 gap-2 rounded-lg border p-3 md:flex md:items-center md:rounded-none md:border-0 md:p-0">
          {COLUMNS.map((c) => (
            <Input
              key={c.key}
              aria-label={`${c.label}, row ${index + 1}`}
              inputMode={c.numeric ? "numeric" : undefined}
              value={row[c.key]}
              onChange={(e) => set(index, c.key, c.numeric ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)}
              placeholder={c.placeholder}
              className={cn(FOCUS_INPUT, c.className, c.key === "name" && "col-span-2")}
            />
          ))}
          <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))} aria-label={`Remove row ${index + 1}`}
            className="col-span-2 inline-flex h-9 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600 md:w-8">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { ...EMPTY_LAYOUT }])} className={FOCUS_BUTTON.secondary}>
        <Plus className="h-3.5 w-3.5" /> Add layout
      </button>
    </div>
  );
}
