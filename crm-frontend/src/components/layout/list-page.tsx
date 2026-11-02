import type { ReactNode } from "react";
import { Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Building blocks for module list pages, matching the Leads page: the page's
// actions sit in the top row (via <PageActions>), then a compact toolbar and a
// full-bleed list table.

/** Outlined header button, e.g. "Import". */
export const headerButtonClass =
  "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-[14px] font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50";

/** Primary header button, e.g. "Create". */
export const headerPrimaryClass =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[14px] font-medium text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50";

/** Small grey toolbar control, e.g. a Filter popover trigger. */
export const toolbarButtonClass =
  "relative flex h-8 items-center gap-1.5 rounded-md bg-muted/70 px-2.5 text-[13px] text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-[#017D58]/40 data-[popup-open]:bg-muted data-[state=open]:bg-muted";

/** "Filter" trigger for a popover's `render` prop (a plain element, so the popover can wire it up). */
export function toolbarFilterButton(count: number, label = "Filter") {
  return (
    <button type="button" className={toolbarButtonClass}>
      <Filter className="size-4 text-muted-foreground" strokeWidth={1.75} />
      {label}
      {count > 0 && <span className="rounded bg-[#017D58] px-1.5 text-[11px] font-medium leading-[18px] text-white">{count}</span>}
    </button>
  );
}

/** Full-bleed page body:cancels the scroller padding on desktop so the table runs edge to edge. */
export function ListFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col md:min-h-0 md:flex-1 lg:-mx-6 lg:-mb-8 lg:-mt-6", className)}>{children}</div>
  );
}

/** Toolbar row above the table. Put tabs first; wrap the right side in <ToolbarEnd>. */
export function ListToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2 px-4 pb-2 pt-3 md:px-5", className)}>{children}</div>;
}

export function ToolbarEnd({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex items-center gap-2">{children}</div>;
}

export const segmentClass = (active: boolean) =>
  cn(
    "relative h-7 whitespace-nowrap rounded px-2.5 text-[13px] transition-colors",
    active
      ? "bg-background font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:bg-white/10"
      : "text-muted-foreground hover:text-foreground",
  );

/** Segmented control for a page's tabs. */
export function SegmentTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  disabled,
}: {
  tabs: readonly (T | { value: T; label: ReactNode; title?: string })[];
  value: T;
  onChange: (tab: T) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex max-w-full items-center overflow-x-auto rounded-md bg-muted/70 p-0.5 scrollbar-hide">
      {tabs.map((tab) => {
        const v = typeof tab === "string" ? tab : tab.value;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={v === value}
            disabled={disabled}
            title={typeof tab === "string" ? undefined : tab.title}
            onClick={() => onChange(v)}
            className={cn(segmentClass(v === value), "disabled:opacity-60")}
          >
            {typeof tab === "string" ? tab : tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function ToolbarSearch({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded-md border border-transparent bg-muted/70 pl-8 pr-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:bg-muted focus:border-border focus:bg-background focus:shadow-sm md:w-64"
      />
    </div>
  );
}

export function ToolbarClear({ onClick, title = "Clear search and filters" }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <X className="size-4" />
    </button>
  );
}

/** Table area under the toolbar: fills the rest of the page on desktop. */
export function ListBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex w-full min-w-0 flex-col md:min-h-0 md:flex-1 md:overflow-hidden", className)}>{children}</div>;
}
