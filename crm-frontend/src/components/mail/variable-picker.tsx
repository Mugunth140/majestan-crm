"use client";

import { useState } from "react";
import { Braces, Search } from "lucide-react";
import type { MailVariableDoc } from "@/lib/mail-templates-api";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  variables: MailVariableDoc[];
  onPick: (token: string, doc: MailVariableDoc) => void;
  disabled?: boolean;
  /** Blocks (cards, buttons) only make sense in the body. */
  allowBlocks?: boolean;
  label?: string;
};

const GENERAL = /^(sender|team|company)\.|^today$/;

/** Lists the {{variables}} a record offers; picking one inserts it where the cursor is. */
export function VariablePicker({ variables, onPick, disabled, allowBlocks = true, label = "Insert field" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = variables.filter(
    (v) => (allowBlocks || !v.block) && (!q || v.label.toLowerCase().includes(q) || v.key.toLowerCase().includes(q)),
  );
  const groups: [string, MailVariableDoc[]][] = [
    ["This record", visible.filter((v) => !v.block && !GENERAL.test(v.key))],
    ["Ready-made blocks", visible.filter((v) => v.block)],
    ["You & the company", visible.filter((v) => !v.block && GENERAL.test(v.key))],
  ];

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" size="sm" disabled={disabled} className="h-8 gap-1.5 rounded-lg text-[13px] font-semibold" />
        }
      >
        <Braces className="h-3.5 w-3.5" /> {label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fields"
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {groups.map(([title, items]) =>
            items.length ? (
              <div key={title} className="py-1">
                <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
                {items.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => { onPick(`{{${v.key}}}`, v); setOpen(false); setQuery(""); }}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-muted focus-visible:bg-muted outline-none"
                  >
                    <span className="text-[13px] font-medium text-foreground">{v.label}</span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-full">{v.block ? "Inserted as its own section" : v.sample}</span>
                  </button>
                ))}
              </div>
            ) : null,
          )}
          {visible.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">No matching fields</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
