"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { Check, Loader2, Search, UserMinus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "@/components/record/feed";
import { cn } from "@/lib/utils";

export type Person = { id: number; name: string; hint?: string };

/**
 * "Assign to" as a searchable list under its trigger, like Frappe CRM's, in
 * place of a dialog. Picking someone saves straight away.
 */
export function AssigneePicker({ people, value, onPick, trigger, children, align = "end", clearLabel = "Unassign" }: {
  people: Person[];
  value: number | null | undefined;
  /** Resolves when saved; the list stays open (showing a spinner) until then. */
  onPick: (id: number | null) => Promise<unknown>;
  /** The button that opens the list (base-ui `render`). */
  trigger: ReactElement;
  /** What the trigger shows. */
  children: ReactNode;
  align?: "start" | "end";
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<number | "none" | null>(null);

  const q = query.trim().toLowerCase();
  const shown = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;

  const pick = async (id: number | null) => {
    if (busy !== null) return;
    if (id === (value ?? null)) return setOpen(false);
    setBusy(id ?? "none");
    try {
      await onPick(id);
      setOpen(false);
      setQuery("");
    } catch {
      // The caller shows the error; keep the list open to try again.
    } finally {
      setBusy(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-[min(280px,calc(100vw-2rem))] gap-0 p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && shown.length === 1) void pick(shown[0].id); }}
            placeholder="Assign to…"
            aria-label="Search people"
            className="h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div role="listbox" aria-label="People" className="max-h-64 overflow-y-auto p-1">
          {shown.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === value}
              onClick={() => void pick(p.id)}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[14px] hover:bg-muted", busy !== null && busy !== p.id && "opacity-60")}
            >
              <Avatar name={p.name} className="h-5 w-5 text-[10px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{p.name}</span>
                {p.hint && <span className="block truncate text-[12px] text-muted-foreground">{p.hint}</span>}
              </span>
              {busy === p.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                : p.id === value && <Check className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>
          ))}
          {!shown.length && <p className="px-2 py-2 text-[13px] text-muted-foreground">No one matches “{query.trim()}”.</p>}
        </div>
        {value != null && (
          <button type="button" onClick={() => void pick(null)} className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-[13px] text-muted-foreground hover:bg-muted">
            {busy === "none" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />} {clearLabel}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
