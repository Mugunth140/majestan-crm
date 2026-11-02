"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";

export const LEAD_GROUP_FIELDS = [
  { id: "status", label: "Status" },
  { id: "staff", label: "Assigned to" },
  { id: "source", label: "Source" },
  { id: "propertyType", label: "Property type" },
] as const;

export type LeadGroupField = (typeof LEAD_GROUP_FIELDS)[number]["id"];

// Toolbar control for the Group By view: which lead field the list is grouped on.
export function GroupByPicker({ value, onChange }: { value: LeadGroupField; onChange: (field: LeadGroupField) => void }) {
  const current = LEAD_GROUP_FIELDS.find((f) => f.id === value) ?? LEAD_GROUP_FIELDS[0];
  return (
    <Menu.Root>
      <Menu.Trigger className="flex h-8 items-center gap-1.5 rounded-md bg-muted/70 px-2.5 text-[13px] text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-[#017D58]/40">
        <ListTree className="size-4 text-muted-foreground" strokeWidth={1.75} />
        <span className="text-muted-foreground">Group by</span>
        <span className="font-medium">{current.label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50 outline-none">
          <Menu.Popup className="min-w-44 origin-[var(--transform-origin)] rounded-xl bg-popover p-1.5 text-popover-foreground shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18),0_4px_8px_-4px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0 dark:ring-white/10">
            {LEAD_GROUP_FIELDS.map((f) => (
              <Menu.Item
                key={f.id}
                onClick={() => onChange(f.id)}
                className={cn(
                  "flex h-8 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-[14px] text-foreground/85 outline-none data-[highlighted]:bg-black/[0.05] dark:data-[highlighted]:bg-white/[0.08]",
                  f.id === value && "text-foreground",
                )}
              >
                <span className="flex-1">{f.label}</span>
                {f.id === value && <Check className="size-4" strokeWidth={2} />}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
