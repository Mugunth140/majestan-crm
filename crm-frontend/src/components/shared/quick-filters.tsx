"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OptionSearchList, type SearchableOption } from "@/components/shared/option-search-list";
import { cn } from "@/lib/utils";

/**
 * Filters that sit in the toolbar row itself, one button each, so staff see and
 * change them without opening a panel. Empty: the field name on a soft fill.
 * Set: the field and its value, tinted, with an × to clear.
 */
const base = "flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#017D58]/40";
const emptyClass = cn(base, "bg-muted/70 px-2.5 text-muted-foreground hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground");
const setClass = cn(base, "bg-[#017D58]/[0.09] pl-2.5 pr-1 text-foreground ring-1 ring-inset ring-[#017D58]/25 dark:bg-[#2FB585]/[0.12] dark:ring-[#2FB585]/25");
/** A filter that always has a value (e.g. the pipeline): shown like a set one, without the ×. */
const fixedClass = cn(base, "bg-muted/70 px-2.5 text-foreground hover:bg-muted data-[popup-open]:bg-muted");

function Chip({ label, value, open, onOpenChange, onClear, icon, children, width = "w-64" }: {
  label: string;
  value: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Without it the filter can't be emptied. */
  onClear?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {value && onClear ? (
        <span className={setClass}>
          <PopoverTrigger render={<button type="button" className="flex items-center gap-1 outline-none" aria-label={`${label}: ${value}. Change`} />}>
            {icon}
            <span className="text-muted-foreground">{label}</span>
            <span className="max-w-[140px] truncate font-medium">{value}</span>
          </PopoverTrigger>
          <button type="button" onClick={onClear} aria-label={`Clear ${label}`} className="ml-0.5 flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </span>
      ) : value ? (
        <PopoverTrigger render={<button type="button" className={fixedClass} aria-label={`${label}: ${value}. Change`} />}>
          {icon}
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{value}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </PopoverTrigger>
      ) : (
        <PopoverTrigger render={<button type="button" className={emptyClass} />}>
          {icon}
          {label}
          <ChevronDown className="size-3.5 opacity-60" />
        </PopoverTrigger>
      )}
      <PopoverContent align="start" className={cn(width, "gap-0 p-0")}>{children}</PopoverContent>
    </Popover>
  );
}

/** One field, one value, picked from a list (searchable once it's long). `required` filters always keep a value. */
export function QuickFilter({ label, value, options, onChange, required }: {
  label: string;
  value: string;
  options: SearchableOption[];
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // "All …" rows from older option lists are what the × is for.
  const list = options.filter((o) => o.value !== "");
  const shown = list.find((o) => o.value === value)?.label ?? value;
  const pick = (v: string) => { onChange(v === value && !required ? "" : v); setOpen(false); };
  return (
    <Chip label={label} value={value ? shown : null} open={open} onOpenChange={setOpen} onClear={required ? undefined : () => onChange("")} width={list.length > 7 ? "w-64" : "w-52"}>
      {list.length > 7 ? (
        <OptionSearchList label={label} options={list} value={value} placeholder={`Find ${label.toLowerCase()}`} onPick={pick} />
      ) : (
        <div role="listbox" aria-label={label} className="p-1">
          {list.map((o) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === value} onClick={() => pick(o.value)}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] hover:bg-muted", o.value === value && "font-medium")}>
              {o.dot && <span className={cn("size-2 shrink-0 rounded-full", o.dot)} />}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.value === value && <Check className="size-3.5 shrink-0 text-muted-foreground" />}
            </button>
          ))}
          {!list.length && <p className="px-2 py-2 text-[13px] text-muted-foreground">Nothing to pick yet.</p>}
        </div>
      )}
    </Chip>
  );
}

/** A min–max number pair, e.g. budget in lakh. */
export function RangeQuickFilter({ label, unit, min, max, onChange }: {
  label: string;
  unit?: string;
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const u = unit ? ` ${unit}` : "";
  const value = min && max ? `${min}–${max}${u}` : min ? `${min}+${u}` : max ? `up to ${max}${u}` : null;
  const field = "h-8 w-full min-w-0 rounded-md border bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <Chip label={label} value={value} open={open} onOpenChange={setOpen} onClear={() => onChange("", "")} width="w-60">
      <div className="space-y-2 p-3">
        <p className="text-[12.5px] font-medium">{label}{unit && ` (${unit})`}</p>
        <div className="flex items-center gap-2">
          <input type="number" min="0" inputMode="decimal" placeholder="Min" aria-label={`Minimum ${label.toLowerCase()}`} value={min} onChange={(e) => onChange(e.target.value, max)} className={field} />
          <span className="text-[12px] text-muted-foreground">to</span>
          <input type="number" min="0" inputMode="decimal" placeholder="Max" aria-label={`Maximum ${label.toLowerCase()}`} value={max} onChange={(e) => onChange(min, e.target.value)} className={field} />
        </div>
      </div>
    </Chip>
  );
}

/** Free text a field should contain, e.g. a floor or a purpose. */
export function TextQuickFilter({ label, value, placeholder, onChange }: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Chip label={label} value={value || null} open={open} onOpenChange={setOpen} onClear={() => onChange("")} width="w-60">
      <form className="space-y-2 p-3" onSubmit={(e) => { e.preventDefault(); setOpen(false); }}>
        <p className="text-[12.5px] font-medium">{label} contains</p>
        <input autoFocus value={value} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full rounded-md border bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </form>
    </Chip>
  );
}

/**
 * A row of filters that scrolls sideways when it doesn't fit, fading at the
 * edge that has more and offering an arrow to get there.
 */
export function FilterStrip({ children, label = "Filters" }: { children: ReactNode; label?: string }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, [el]);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    el.addEventListener("scroll", measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", measure); };
  }, [el, measure]);
  const go = (dir: -1 | 1) => el?.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: "smooth" });
  const arrow = "absolute top-0 z-10 flex h-8 w-9 items-center text-muted-foreground transition-colors hover:text-foreground";
  return (
    <div className="relative min-w-0 flex-1">
      {edges.left && (
        <button type="button" onClick={() => go(-1)} aria-label="Scroll filters left" className={cn(arrow, "left-0 justify-start bg-gradient-to-r from-background from-50% to-transparent")}>
          <ChevronLeft className="size-4" />
        </button>
      )}
      <div ref={setEl} role="group" aria-label={label} className="flex items-center gap-1.5 overflow-x-auto scroll-smooth scrollbar-hide">
        {children}
      </div>
      {edges.right && (
        <button type="button" onClick={() => go(1)} aria-label="Scroll filters right" className={cn(arrow, "right-0 justify-end bg-gradient-to-l from-background from-50% to-transparent")}>
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

const IST = "Asia/Kolkata";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date());
const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const short = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "Today", range: () => [today(), today()] },
  { label: "Yesterday", range: () => [shift(today(), -1), shift(today(), -1)] },
  { label: "Last 7 days", range: () => [shift(today(), -6), today()] },
  { label: "Last 30 days", range: () => [shift(today(), -29), today()] },
  { label: "This month", range: () => [`${today().slice(0, 7)}-01`, today()] },
];

/** Created between two days, with the usual shortcuts. */
export function DateQuickFilter({ label, from, to, onChange }: {
  label: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const preset = PRESETS.find((p) => { const [f, t] = p.range(); return f === from && t === to; });
  const value = !from && !to ? null : preset ? preset.label : from && to ? (from === to ? short(from) : `${short(from)} – ${short(to)}`) : from ? `From ${short(from)}` : `Until ${short(to)}`;
  const field = "h-8 w-full rounded-md border bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <Chip label={label} value={value} open={open} onOpenChange={setOpen} onClear={() => onChange("", "")} width="w-60"
      icon={<CalendarDays className="size-3.5 opacity-70" strokeWidth={1.75} />}>
      <div className="p-1">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => { const [f, t] = p.range(); onChange(f, t); setOpen(false); }}
            className={cn("flex w-full items-center rounded-md px-2 py-1.5 text-left text-[13.5px] hover:bg-muted", preset?.label === p.label && "bg-muted font-medium")}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t p-2.5">
        <label className="space-y-1 text-[12px] text-muted-foreground">From
          <input type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className={field} />
        </label>
        <label className="space-y-1 text-[12px] text-muted-foreground">To
          <input type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className={field} />
        </label>
      </div>
    </Chip>
  );
}

/** Plain strings as filter options. */
export const toOptions = (values: (string | null | undefined)[]): SearchableOption[] =>
  [...new Set(values.filter((v): v is string => !!v && v !== "—"))].map((v) => ({ label: v, value: v }));

/** The thin rule between a page's tabs and its filter strip. */
export function FilterDivider() {
  return <span aria-hidden className="h-5 w-px shrink-0 bg-border" />;
}

/** Ends the strip once anything is filtered. */
export function ClearFilters({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <button type="button" onClick={onClick} className="h-8 shrink-0 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      Clear all
    </button>
  );
}
