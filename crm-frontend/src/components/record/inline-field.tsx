"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OptionSearchList } from "@/components/shared/option-search-list";
import { cn } from "@/lib/utils";

// Frappe-style record fields: each row reads as plain text and turns into an
// input on hover/focus. A change saves on blur or Enter; Escape reverts.

const CONTROL =
  "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-foreground/[0.05] focus:border-border focus:bg-background focus:hover:bg-background disabled:cursor-default disabled:hover:bg-transparent";

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-2">
      <span className="w-[112px] shrink-0 truncate text-[13px] text-muted-foreground">{label}</span>
      <div className="relative flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

type Save = (value: string) => Promise<unknown> | void;

function useSaving(onSave: Save) {
  const [saving, setSaving] = useState(false);
  const run = async (value: string) => {
    setSaving(true);
    try {
      await onSave(value);
    } finally {
      setSaving(false);
    }
  };
  return { saving, run };
}

function Spinner() {
  return <Loader2 className="absolute right-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />;
}

export function InlineText({
  label,
  value,
  onSave,
  disabled,
  placeholder = "Add…",
  type = "text",
  multiline,
}: {
  label: string;
  value: string | number | null | undefined;
  onSave: Save;
  disabled?: boolean;
  placeholder?: string;
  type?: "text" | "tel" | "email" | "number";
  multiline?: boolean;
}) {
  const stored = value == null ? "" : String(value);
  const [draft, setDraft] = useState(stored);
  const [synced, setSynced] = useState(stored);
  const { saving, run } = useSaving(onSave);
  const skipBlur = useRef(false);

  // A refetch brings a new stored value: show it instead of the old draft.
  if (synced !== stored) {
    setSynced(stored);
    setDraft(stored);
  }

  const commit = async () => {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    if (draft.trim() === stored.trim()) return;
    try {
      await run(draft.trim());
    } catch {
      setDraft(stored);
    }
  };

  const shared = {
    "aria-label": label,
    value: draft,
    disabled: disabled || saving,
    placeholder: disabled ? "—" : placeholder,
    onBlur: commit,
  };

  return (
    <FieldRow label={label}>
      {multiline ? (
        <textarea
          {...shared}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              skipBlur.current = true;
              setDraft(stored);
              e.currentTarget.blur();
            }
          }}
          className={cn(CONTROL, "field-sizing-content h-auto min-h-8 resize-none py-1.5 leading-5")}
        />
      ) : (
        <input
          {...shared}
          type={type}
          inputMode={type === "number" ? "decimal" : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              skipBlur.current = true;
              setDraft(stored);
              e.currentTarget.blur();
            }
          }}
          className={cn(CONTROL, saving && "pr-7")}
        />
      )}
      {saving && <Spinner />}
    </FieldRow>
  );
}

export type Option = { label: string; value: string; dot?: string; hint?: string };

export function InlineSelect({
  label,
  value,
  options,
  onSave,
  disabled,
  placeholder = "Select…",
  searchable,
}: {
  label: string;
  value: string | null | undefined;
  options: Option[];
  onSave: Save;
  disabled?: boolean;
  placeholder?: string;
  /** Adds a search box: for long lists like localities. */
  searchable?: boolean;
}) {
  const { saving, run } = useSaving(onSave);
  const [open, setOpen] = useState(false);
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const current = value ? byValue.get(value) : undefined;

  if (disabled) {
    return (
      <FieldRow label={label}>
        <span className="flex h-8 items-center gap-2 px-2 text-[14px] text-foreground">
          {current?.dot && <span className={cn("h-2 w-2 rounded-full", current.dot)} />}
          {current?.label ?? (value || "—")}
        </span>
      </FieldRow>
    );
  }

  if (searchable) {
    return (
      <FieldRow label={label}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<button type="button" aria-label={label} disabled={saving} className={TRIGGER} />}>
            {current?.dot && <span className={cn("h-2 w-2 shrink-0 rounded-full", current.dot)} />}
            <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground/60")}>{current?.label ?? (value || placeholder)}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(300px,calc(100vw-2rem))] gap-0 p-0">
            <OptionSearchList
              options={options}
              value={value}
              label={label}
              placeholder={`Search ${label.toLowerCase()}…`}
              onPick={(next) => { setOpen(false); if (next !== value) run(next).catch(() => {}); }}
            />
          </PopoverContent>
        </Popover>
        {saving && <Spinner />}
      </FieldRow>
    );
  }

  return (
    <FieldRow label={label}>
      <Select
        value={value ?? ""}
        onValueChange={(next) => {
          if (next && next !== value) run(String(next)).catch(() => {});
        }}
        disabled={saving}
      >
        <SelectTrigger
          aria-label={label}
          className="h-8 w-full border-transparent bg-transparent px-2 text-[14px] shadow-none hover:bg-foreground/[0.05] dark:bg-transparent dark:hover:bg-foreground/[0.05] [&>svg]:opacity-0 hover:[&>svg]:opacity-100"
        >
          <SelectValue placeholder={placeholder}>
            {(val: string | null) => {
              const opt = val ? byValue.get(val) : undefined;
              if (!val) return <span className="text-muted-foreground/60">{placeholder}</span>;
              return (
                <span className="flex min-w-0 items-center gap-2">
                  {opt?.dot && <span className={cn("h-2 w-2 shrink-0 rounded-full", opt.dot)} />}
                  <span className="truncate">{opt?.label ?? val}</span>
                </span>
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[320px]" alignItemWithTrigger={false} side="bottom" align="start">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="py-1.5 text-[14px]">
              <span className="flex items-center gap-2">
                {opt.dot && <span className={cn("h-2 w-2 rounded-full", opt.dot)} />}
                {opt.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving && <Spinner />}
    </FieldRow>
  );
}

const TRIGGER =
  "group flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-[14px] text-foreground transition-colors hover:bg-foreground/[0.05] data-[popup-open]:bg-foreground/[0.05] disabled:cursor-default disabled:hover:bg-transparent";

/**
 * Pick one value from a searched list (e.g. projects from the site). Typing a
 * name that isn't listed can still be saved as typed.
 */
export function InlineSearch({
  label,
  value,
  search,
  onSave,
  disabled,
  placeholder = "Search…",
}: {
  label: string;
  value: string | null | undefined;
  search: (query: string) => Promise<Option[]>;
  onSave: Save;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { saving, run } = useSaving(onSave);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Option[] | null>(null);

  // Debounced search while the list is open; the last answer wins.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const timer = setTimeout(() => {
      search(query.trim()).then((r) => { if (live) setResults(r); }, () => { if (live) setResults([]); });
    }, 200);
    return () => { live = false; clearTimeout(timer); };
  }, [open, query, search]);

  const pick = (next: string) => {
    setOpen(false);
    setQuery("");
    if (next !== (value ?? "")) run(next).catch(() => {});
  };

  if (disabled) {
    return (
      <FieldRow label={label}>
        <span className="flex h-8 items-center px-2 text-[14px] text-foreground">{value || "—"}</span>
      </FieldRow>
    );
  }

  const typed = query.trim();
  const exact = results?.some((r) => r.label.toLowerCase() === typed.toLowerCase());

  return (
    <FieldRow label={label}>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQuery(""); setResults(null); } }}>
        <PopoverTrigger render={<button type="button" aria-label={label} disabled={saving} className={TRIGGER} />}>
          <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground/60")}>{value || placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(320px,calc(100vw-2rem))] gap-0 p-0">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && typed) pick(results?.find((r) => r.label.toLowerCase() === typed.toLowerCase())?.label ?? (results?.[0]?.label || typed));
              }}
              placeholder={placeholder}
              aria-label={`Search ${label.toLowerCase()}`}
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
                {!results.length && !typed && <p className="px-2 py-2 text-[13px] text-muted-foreground">Nothing found.</p>}
                {typed && !exact && (
                  <button type="button" onClick={() => pick(typed)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[14px] text-muted-foreground hover:bg-muted">
                    Use “<span className="truncate text-foreground">{typed}</span>”
                  </button>
                )}
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
      {saving && <Spinner />}
    </FieldRow>
  );
}

/** Pick several values (e.g. localities); saves when the list closes. */
export function InlineMulti({
  label,
  values,
  options,
  onSave,
  disabled,
  placeholder = "Select…",
  emptyHint = "Nothing to pick from.",
}: {
  label: string;
  values: string[];
  options: Option[];
  onSave: (values: string[]) => Promise<unknown> | void;
  disabled?: boolean;
  placeholder?: string;
  emptyHint?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(values);
  const [filter, setFilter] = useState("");

  const close = async () => {
    setOpen(false);
    setFilter("");
    const same = draft.length === values.length && draft.every((v) => values.includes(v));
    if (same) return;
    setSaving(true);
    try {
      await onSave(draft);
    } catch {
      setDraft(values);
    } finally {
      setSaving(false);
    }
  };

  const chips = values.length ? (
    <span className="flex min-w-0 flex-1 flex-wrap gap-1 py-1">
      {values.map((v) => <span key={v} className="rounded bg-foreground/[0.06] px-1.5 py-px text-[13px] text-foreground/85">{v}</span>)}
    </span>
  ) : (
    <span className="min-w-0 flex-1 truncate text-muted-foreground/60">{disabled ? "—" : placeholder}</span>
  );

  if (disabled) return <FieldRow label={label}><span className="flex min-h-8 w-full items-center px-2 text-[14px]">{chips}</span></FieldRow>;

  const shown = options.filter((o) => o.label.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <FieldRow label={label}>
      <Popover open={open} onOpenChange={(o) => { if (o) { setDraft(values); setOpen(true); } else void close(); }}>
        <PopoverTrigger render={<button type="button" aria-label={label} disabled={saving} className={cn(TRIGGER, "h-auto min-h-8")} />}>
          {chips}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(300px,calc(100vw-2rem))] gap-0 p-0">
          {options.length > 8 && (
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" aria-label={`Filter ${label.toLowerCase()}`} className="h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground" />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto p-1">
            {!options.length && <p className="px-2 py-2 text-[13px] text-muted-foreground">{emptyHint}</p>}
            {shown.map((o) => {
              const on = draft.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setDraft((d) => (on ? d.filter((v) => v !== o.value) : [...d, o.value]))}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[14px] hover:bg-muted"
                >
                  <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", on && "border-foreground bg-foreground text-background")}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {saving && <Spinner />}
    </FieldRow>
  );
}

// A value that opens something else to change it (e.g. the reassign dialog).
export function InlineAction({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <FieldRow label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || !onClick}
        className="group flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-[14px] text-foreground transition-colors hover:bg-foreground/[0.05] disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">{children}</span>
        {onClick && !disabled && (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </button>
    </FieldRow>
  );
}

export function Section({
  title,
  children,
  defaultOpen = true,
  action,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b px-3 py-2 last:border-b-0 md:px-4">
      <div className="flex h-9 items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="-ml-1 flex flex-1 items-center gap-1 rounded-md px-1 py-1 text-left text-[14px] font-semibold text-foreground"
        >
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
          {title}
        </button>
        {action}
      </div>
      {open && <div className="pb-2">{children}</div>}
    </section>
  );
}
