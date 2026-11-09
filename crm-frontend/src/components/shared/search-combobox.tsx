"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SearchOption } from "@/lib/project-search";
import { cn } from "@/lib/utils";

/**
 * A form field that searches a server list as you type (projects, builders…).
 * Stores the picked label; anything typed that isn't in the list can be kept too.
 */
export function SearchCombobox({
  id, value, onChange, search, placeholder = "Search…", className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  search: (query: string) => Promise<SearchOption[]>;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchOption[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const timer = setTimeout(() => {
      search(query.trim()).then((r) => { if (live) setResults(r); }, () => { if (live) setResults([]); });
    }, 200);
    return () => { live = false; clearTimeout(timer); };
  }, [open, query, search]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  const typed = query.trim();
  const exact = results?.some((r) => r.label.toLowerCase() === typed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQuery(""); setResults(null); } }}>
      <PopoverTrigger
        render={
          <button
            id={id}
            type="button"
            className={cn("flex h-9 w-full items-center gap-2 border text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}
          />
        }
      >
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground/70")}>{value || placeholder}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-[260px] gap-0 p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !typed) return;
              e.preventDefault();
              pick(results?.find((r) => r.label.toLowerCase() === typed.toLowerCase())?.label ?? results?.[0]?.label ?? typed);
            }}
            placeholder={placeholder}
            className="h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {results === null ? (
            <p className="flex items-center gap-2 px-2 py-2 text-[13px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</p>
          ) : (
            <>
              {results.map((r) => (
                <button key={r.value} type="button" onClick={() => pick(r.label)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[14px] hover:bg-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.label}</span>
                    {r.hint && <span className="block truncate text-[12px] text-muted-foreground">{r.hint}</span>}
                  </span>
                  {r.label === value && <Check className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
              ))}
              {typed && !exact && (
                <button type="button" onClick={() => pick(typed)} className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-[14px] hover:bg-muted">
                  Use “{typed}”
                </button>
              )}
              {!results.length && !typed && <p className="px-2 py-2 text-[13px] text-muted-foreground">Nothing found.</p>}
            </>
          )}
        </div>
        {value && (
          <button type="button" onClick={() => pick("")} className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-[13px] text-muted-foreground hover:bg-muted">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
