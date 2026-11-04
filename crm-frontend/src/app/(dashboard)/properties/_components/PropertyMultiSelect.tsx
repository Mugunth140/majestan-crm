"use client";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { sameName } from "@/lib/master-kinds";
export function parseMultiValue(
  value: string,
  options: readonly string[] = [],
): string[] {
  if (!value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
    )
      return [...new Set(parsed)];
  } catch {
    /* Existing selections may be stored as plain text. */
  }
  return options.includes(value)
    ? [value]
    : [
        ...new Set(
          value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ];
}
export function PropertyMultiSelect({
  name,
  value,
  options,
  onChange,
  serializeAsJson = false,
  onCreate,
  createNoun = "item",
}: {
  name: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  serializeAsJson?: boolean;
  /** Offered when the search matches nothing: add the typed value to its master list. */
  onCreate?: (query: string) => void;
  createNoun?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = parseMultiValue(value, options);
  const choices = [
    ...options,
    ...selected.filter((item) => !options.includes(item)),
  ];
  const q = query.trim().toLowerCase();
  const searchable = !!onCreate || choices.length > 8;
  const shown = q ? choices.filter((c) => c.toLowerCase().includes(q)) : choices;
  const canCreate = !!onCreate && !!q && !choices.some((c) => sameName(c, query));
  return (
    <details className="relative rounded-md border border-border bg-muted/40 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-white/[0.04]">
      <summary
        title={selected.join(", ")}
        className="min-h-9 cursor-pointer px-2.5 py-2 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {selected.length
          ? selected.length > 2
            ? `${selected.length} selected`
            : selected.join(", ")
          : `Select ${name.toLowerCase()}`}
      </summary>
      <div
        role="group"
        aria-label={name}
        className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border bg-popover p-2 shadow-md"
      >
        {searchable && (
          <div className="mb-1 flex items-center gap-2 border-b px-1 pb-1">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (canCreate && !shown.length) onCreate(query.trim());
              }}
              placeholder={`Search ${name.toLowerCase()}…`}
              aria-label={`Search ${name.toLowerCase()}`}
              className="h-8 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        {shown.map((choice) => (
          <label
            key={choice}
            className="flex cursor-pointer items-start gap-3 rounded-lg p-2 text-sm hover:bg-muted"
          >
            <Checkbox
              checked={selected.includes(choice)}
              onCheckedChange={(checked) => {
                const next = checked
                  ? [...selected, choice]
                  : selected.filter((item) => item !== choice);
                onChange(
                  serializeAsJson ? JSON.stringify(next) : next.join(", "),
                );
              }}
            />
            {choice}
          </label>
        ))}
        {q && !shown.length && !canCreate && <p className="p-2 text-[13px] text-muted-foreground">Nothing matches “{query.trim()}”.</p>}
        {canCreate && (
          <button type="button" onClick={() => { onCreate(query.trim()); setQuery(""); }}
            className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-muted">
            <Plus className="h-4 w-4 shrink-0 text-muted-foreground" /> Create {createNoun} “{query.trim()}”
          </button>
        )}
      </div>
    </details>
  );
}
