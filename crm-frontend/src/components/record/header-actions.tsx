"use client";

import type { ReactElement, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/record/feed";
import { AssigneePicker, type Person } from "@/components/record/assignee-picker";
import { cn } from "@/lib/utils";

// The status and "assigned to" buttons at the top of every record page, so
// leads, inbounds, agents, candidates and assets all look and work alike.

/** An outlined button in the page's top bar. */
export const HEADER_BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-[14px] font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-muted disabled:opacity-50";
/** The filled button in the top bar (Convert, Save…). */
export const HEADER_PRIMARY =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[14px] font-medium text-background shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors hover:bg-foreground/85 disabled:opacity-50";
/** The assignee as an inline field in a side panel or data card. */
export const FIELD_TRIGGER =
  "flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-[14px] text-foreground transition-colors hover:bg-foreground/[0.05] data-[popup-open]:bg-foreground/[0.05]";
const PHONE_BUTTON = "flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-[15px] font-medium text-foreground";

export type StatusOption = { value: string; label?: string; dot?: string };

/**
 * The record's status as a tinted, square-cornered button that opens the list
 * of statuses. Without `onChange` it's a plain pill.
 */
export function StatusMenu({ status, options, pillClass, onChange, size = "h-8", align = "end" }: {
  status: string;
  options: StatusOption[];
  /** The tint (bg + text classes) for the current status. */
  pillClass: string;
  onChange?: (status: string) => void;
  size?: "h-7" | "h-8";
  align?: "start" | "end";
}) {
  const pill = cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md text-[13px] font-medium", size, pillClass);
  if (!onChange) return <span className={cn(pill, "px-3")}>{status}</span>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" aria-label={`Status: ${status}. Change status`} className={cn(pill, "pl-3 pr-2 transition-[filter] hover:brightness-[0.97] dark:hover:brightness-110")} />}
      >
        {status}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="max-h-[360px] w-56">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => { if (o.value !== status) onChange(o.value); }} className="gap-2 text-[14px]">
            <span className={cn("h-2 w-2 rounded-full", o.dot)} />
            <span className="flex-1">{o.label ?? o.value}</span>
            {o.value === status && <span className="text-[12px] text-muted-foreground">Current</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Avatar + name, or a dashed circle and "Unassigned". */
export function AssigneeLabel({ name, empty = "Unassigned" }: { name?: string | null; empty?: string }) {
  return (
    <>
      {name ? <Avatar name={name} className="h-5 w-5" /> : <span className="h-5 w-5 shrink-0 rounded-full border border-dashed border-muted-foreground/50" />}
      <span className="max-w-[160px] truncate">{name ?? empty}</span>
    </>
  );
}

type AssigneeProps = {
  name?: string | null;
  /** What to call nobody ("Unassigned", "In the queue"). */
  empty?: string;
  /** Where it sits: the top bar, a side-panel field, or the phone summary. */
  variant?: "header" | "field" | "phone";
  /** Who can be picked; without `onPick` the assignee is read-only. */
  people?: Person[];
  value?: number | null;
  onPick?: (id: number | null) => Promise<unknown>;
  clearLabel?: string;
  allowClear?: boolean;
  loading?: boolean;
  onOpen?: () => void;
};

/** "Assigned to": opens the searchable people list when the viewer may reassign. */
export function AssigneeButton({ name, empty, variant = "header", people = [], value, onPick, clearLabel, allowClear, loading, onOpen }: AssigneeProps) {
  const label = <AssigneeLabel name={name} empty={empty} />;
  const chevron = <ChevronDown className={cn("shrink-0 text-muted-foreground", variant === "phone" ? "h-4 w-4" : "h-3.5 w-3.5")} />;
  const look = {
    header: cn(HEADER_BUTTON, "pl-1.5 pr-2"),
    field: FIELD_TRIGGER,
    phone: cn(PHONE_BUTTON, "bg-foreground/[0.06]"),
  }[variant];

  if (!onPick) {
    const still = {
      header: cn(HEADER_BUTTON, "pl-1.5 hover:bg-background"),
      field: "flex h-8 items-center gap-2 px-2 text-[14px] text-foreground",
      phone: cn(PHONE_BUTTON, "bg-foreground/[0.04]"),
    }[variant];
    return <span title="Assigned to" className={still}>{label}</span>;
  }
  const trigger: ReactElement = <button type="button" aria-label={`Assigned to ${name ?? "nobody"}. Reassign`} className={look} />;
  const content: ReactNode = variant === "field" ? label : <>{label}{chevron}</>;
  return (
    <AssigneePicker people={people} value={value} onPick={onPick} trigger={trigger} align={variant === "header" ? "end" : "start"}
      clearLabel={clearLabel} allowClear={allowClear} loading={loading} onOpen={onOpen}>
      {content}
    </AssigneePicker>
  );
}
