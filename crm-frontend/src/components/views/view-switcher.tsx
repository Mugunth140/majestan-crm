"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, Columns3, List, ListTree, type LucideIcon } from "lucide-react";
import { PageCrumb } from "@/components/layout/page-actions";
import { cn } from "@/lib/utils";

export type ViewType = "list" | "kanban" | "group";

export const VIEW_TYPES: { id: ViewType; label: string; icon: LucideIcon }[] = [
  { id: "list", label: "List", icon: List },
  { id: "kanban", label: "Kanban", icon: Columns3 },
  { id: "group", label: "Group By", icon: ListTree },
];

// "Leads / ☰ List ⌄" — the current view as a breadcrumb that opens the view picker.
export function ViewSwitcher({
  value,
  onChange,
  defaultView = "list",
}: {
  value: ViewType;
  onChange: (view: ViewType) => void;
  defaultView?: ViewType;
}) {
  const current = VIEW_TYPES.find((v) => v.id === value) ?? VIEW_TYPES[0];
  const CurrentIcon = current.icon;

  return (
    <PageCrumb>
      <span aria-hidden className="mx-1 text-[15px] text-muted-foreground/50">
        /
      </span>
      <Menu.Root>
        <Menu.Trigger
          aria-label={`View: ${current.label}`}
          className="group flex h-8 items-center gap-1.5 rounded-md px-2 text-[16px] font-medium text-foreground outline-none transition-colors hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-[#017D58]/40 data-[popup-open]:bg-black/[0.06] dark:hover:bg-white/[0.07] dark:data-[popup-open]:bg-white/[0.09]"
        >
          <CurrentIcon className="size-4 text-muted-foreground" strokeWidth={1.75} />
          {current.label}
          <ChevronDown className="size-4 text-muted-foreground transition-transform duration-150 group-data-[popup-open]:rotate-180" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-50 outline-none">
            <Menu.Popup className="min-w-52 origin-[var(--transform-origin)] rounded-xl bg-popover p-1.5 text-popover-foreground shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18),0_4px_8px_-4px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0 dark:ring-white/10">
              {VIEW_TYPES.map(({ id, label, icon: Icon }) => {
                const selected = id === value;
                return (
                  <Menu.Item
                    key={id}
                    onClick={() => onChange(id)}
                    className={cn(
                      "flex h-8 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-[14px] text-foreground/85 outline-none data-[highlighted]:bg-black/[0.05] dark:data-[highlighted]:bg-white/[0.08]",
                      selected && "bg-black/[0.05] text-foreground dark:bg-white/[0.08]",
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span className="flex-1">{label}</span>
                    {id === defaultView && <span className="text-xs text-muted-foreground">Default</span>}
                    {selected && <Check className="size-4 shrink-0" strokeWidth={2} />}
                  </Menu.Item>
                );
              })}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </PageCrumb>
  );
}
