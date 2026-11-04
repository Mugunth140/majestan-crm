"use client";

import { useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { sameName } from "@/lib/master-kinds";

export type SearchableOption = { label: string; value: string; dot?: string };

/**
 * A search box over a fixed list of options, for popovers where the list is
 * long (localities, states). Enter picks the first match. With `onCreate`, a
 * search that matches nothing offers to add it (e.g. to a master list).
 */
export function OptionSearchList({ options, value, onPick, placeholder = "Search…", label, onCreate, createNoun = "item" }: {
  options: SearchableOption[];
  value: string | null | undefined;
  onPick: (value: string) => void;
  placeholder?: string;
  /** For screen readers: what's being picked. */
  label: string;
  /** Offered when the search has no exact match; gets what was typed. */
  onCreate?: (query: string) => void;
  /** What a new one is called in the "Create" row, e.g. "room name". */
  createNoun?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const canCreate = !!onCreate && !!q && !options.some((o) => sameName(o.label, query));

  return (
    <>
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (shown[0]) onPick(shown[0].value);
            else if (canCreate) onCreate(query.trim());
          }}
          placeholder={placeholder}
          aria-label={`Search ${label.toLowerCase()}`}
          className="h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div role="listbox" aria-label={label} className="max-h-64 overflow-y-auto p-1">
        {shown.map((o) => (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={o.value === value}
            onClick={() => onPick(o.value)}
            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[14px] hover:bg-muted", o.value === value && "font-medium")}
          >
            {o.dot && <span className={cn("h-2 w-2 shrink-0 rounded-full", o.dot)} />}
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.value === value && <Check className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </button>
        ))}
        {!shown.length && !canCreate && (
          <p className="px-2 py-2 text-[13px] text-muted-foreground">{options.length ? `Nothing matches “${query.trim()}”.` : "Nothing to pick yet."}</p>
        )}
        {canCreate && (
          <button
            type="button"
            onClick={() => onCreate(query.trim())}
            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[14px] hover:bg-muted", shown.length > 0 && "mt-1 border-t pt-2")}
          >
            <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">Create {createNoun} “{query.trim()}”</span>
          </button>
        )}
      </div>
    </>
  );
}
