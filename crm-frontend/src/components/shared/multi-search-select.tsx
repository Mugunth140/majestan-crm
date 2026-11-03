"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Picks several values from a long list (localities, amenities…): what's
 * chosen sits on top as removable chips, a search box filters the rest, and
 * only the first few suggestions show until you type.
 */
export function MultiSearchSelect({
  id, options, value, onChange, placeholder = "Search…", initial = 12, allowCustom = false, className, emptyText = "Nothing to pick from yet.",
}: {
  id?: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** Suggestions shown before anything is typed. */
  initial?: number;
  /** Lets a typed value that isn't in the list be added. */
  allowCustom?: boolean;
  /** Classes for the search input (match the form's fields). */
  className?: string;
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const typed = query.trim();
  const needle = typed.toLowerCase();

  const matches = useMemo(() => {
    const rest = options.filter((o) => !value.includes(o));
    if (!needle) return rest;
    // Names that start with the search come first, then ones containing it.
    const starts = rest.filter((o) => o.toLowerCase().startsWith(needle));
    const contains = rest.filter((o) => !o.toLowerCase().startsWith(needle) && o.toLowerCase().includes(needle));
    return [...starts, ...contains];
  }, [options, value, needle]);

  const limit = needle ? 30 : initial;
  const shown = matches.slice(0, limit);
  const hidden = matches.length - shown.length;
  const exact = typed && [...options, ...value].some((o) => o.toLowerCase() === needle);
  // A new name only once it's long enough to be one, so short searches stay tidy.
  const canAdd = allowCustom && typed.length >= 3 && !exact;

  const add = (item: string) => {
    if (!value.includes(item)) onChange([...value, item]);
    setQuery("");
  };
  const remove = (item: string) => onChange(value.filter((v) => v !== item));

  const chip = "inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[13px] transition-colors";

  if (!options.length && !allowCustom) return <p className="text-[13px] text-muted-foreground">{emptyText}</p>;

  return (
    <div className="space-y-2.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className={cn(chip, "border-foreground bg-foreground pr-1 text-background")}>
              {v}
              <button type="button" onClick={() => remove(v)} aria-label={`Remove ${v}`} className="flex h-5 w-5 items-center justify-center rounded opacity-70 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (shown[0] && needle) add(shown[0]);
              else if (canAdd) add(typed);
            } else if (e.key === "Backspace" && !query && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          placeholder={placeholder}
          className={cn("h-9 w-full border outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className, "pl-8")}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {shown.map((o) => (
          <button key={o} type="button" onClick={() => add(o)} className={cn(chip, "bg-muted/40 text-foreground/80 hover:bg-muted hover:text-foreground dark:bg-white/[0.04]")}>
            <Plus className="h-3 w-3 text-muted-foreground" />
            {o}
          </button>
        ))}
        {canAdd && (
          <button type="button" onClick={() => add(typed)} className={cn(chip, "border-dashed text-foreground/80 hover:bg-muted")}>
            <Plus className="h-3 w-3" /> Add “{typed}”
          </button>
        )}
      </div>
      {hidden > 0 ? (
        <p className="text-[13px] text-muted-foreground">
          {needle ? `${hidden} more ${hidden === 1 ? "match" : "matches"}. Keep typing to narrow it down.` : `${hidden} more. Search to find them.`}
        </p>
      ) : needle && !shown.length && !allowCustom ? (
        <p className="text-[13px] text-muted-foreground">No match for “{typed}”.</p>
      ) : null}
    </div>
  );
}
