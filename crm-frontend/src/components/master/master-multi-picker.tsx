"use client";

import { useState, type ReactNode } from "react";
import { Plus, Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { sameName } from "@/lib/master-kinds";

export type PickerItem = { id: number; name: string; hint?: string | null; icon?: ReactNode };

/**
 * Pick several items from a master list (amenities, furnishing items). The
 * picked ones show as chips; below, a search box and a few suggestions rather
 * than the whole list. A search that matches nothing can add it to the master
 * list (`onCreate`), so staff needn't leave the form.
 */
export function MasterMultiPicker({ items, selected, onChange, noun, plural = `${noun}s`, onCreate, limit = 8, className }: {
  items: PickerItem[];
  selected: number[];
  onChange: (ids: number[]) => void;
  /** Singular, lower case: "amenity". */
  noun: string;
  plural?: string;
  onCreate?: (query: string) => void;
  /** How many suggestions show before the search is needed. */
  limit?: number;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const picked = selected.map((id) => items.find((it) => it.id === id) ?? { id, name: `#${id}` });
  const matches = items.filter((it) => !selected.includes(it.id) && (!q || it.name.toLowerCase().includes(q) || it.hint?.toLowerCase().includes(q)));
  const shown = matches.slice(0, limit);
  const canCreate = !!onCreate && !!q && !items.some((it) => sameName(it.name, query));
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className={cn("space-y-3", className)}>
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Selected ${plural}`}>
          {picked.map((it) => (
            <li key={it.id} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-foreground/30 bg-foreground/[0.04] pl-2.5 pr-1 text-[13px] font-medium text-foreground">
              {"icon" in it && it.icon}
              <span className="max-w-[220px] truncate capitalize" title={it.name}>{it.name}</span>
              <button type="button" onClick={() => toggle(it.id)} aria-label={`Remove ${it.name}`}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:ring-2 focus-within:ring-ring/40 dark:bg-white/[0.04]">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // Enter picks the first match (or offers to create it); it never submits the form.
            e.preventDefault();
            if (shown[0]) { toggle(shown[0].id); setQuery(""); }
            else if (canCreate) onCreate(query.trim());
          }}
          placeholder={`Search ${plural}…`}
          aria-label={`Search ${plural}`}
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/70"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {shown.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((it) => (
            <label key={it.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-muted/10 p-2.5 transition-colors hover:bg-muted/40">
              <Checkbox checked={false} onCheckedChange={() => { toggle(it.id); setQuery(""); }} />
              {it.icon}
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[14px] font-medium capitalize text-foreground" title={it.name}>{it.name}</span>
                {it.hint && <span className="truncate text-[12px] text-muted-foreground">{it.hint}</span>}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
        {items.length === 0 && !q && <span>No {plural} in the master list yet. Type one to add it.</span>}
        {q && !shown.length && !canCreate && <span>Nothing matches “{query.trim()}”.</span>}
        {matches.length > shown.length && <span>Showing {shown.length} of {matches.length}. Search to find the rest.</span>}
        {canCreate && (
          <button type="button" onClick={() => onCreate(query.trim())}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-[13px] font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-muted dark:bg-white/[0.06]">
            <Plus className="h-3.5 w-3.5" /> Create {noun} “{query.trim()}”
          </button>
        )}
      </div>
    </div>
  );
}
