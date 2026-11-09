"use client";

import { useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toolbarButtonClass } from "@/components/layout/list-page";
import { cn } from "@/lib/utils";

/** YYYY-MM-DD ⇄ a local Date at midnight, which is what the calendar works in. */
const toDate = (d: string) => { const [y, m, day] = d.split("-").map(Number); return new Date(y, m - 1, day); };
const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
type DateRange = { from?: Date; to?: Date };

const shortDay = (d: string, withYear: boolean) =>
  toDate(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });

/** "3 Oct – 9 Nov", with the year only when it isn't this year or the two differ. */
export function rangeLabel(from: string, to: string) {
  const thisYear = String(new Date().getFullYear());
  const years = from.slice(0, 4) !== to.slice(0, 4) || from.slice(0, 4) !== thisYear;
  return from === to ? shortDay(from, years) : `${shortDay(from, years)} – ${shortDay(to, years)}`;
}

/**
 * The period for a page of numbers: the usual presets on the left, and a
 * calendar for any other stretch of days. A custom range is applied with a
 * button, so the page doesn't reload on the first click.
 */
export function PeriodPicker<T extends string>({ presets, value, from, to, timeZone, onPreset, onRange, label = "Period", note }: {
  presets: readonly { value: T; label: string }[];
  /** The chosen preset, or "custom". */
  value: T | "custom";
  from?: string;
  to?: string;
  /** Whose calendar days these are; today in it is the last day that can be picked. */
  timeZone: string;
  onPreset: (v: T) => void;
  onRange: (from: string, to: string) => void;
  label?: string;
  /** A line under the calendar, e.g. which time zone the days are in. */
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const [max, setMax] = useState("");
  const custom = value === "custom" && from && to;
  const shown = custom ? rangeLabel(from, to) : presets.find((p) => p.value === value)?.label ?? value;

  const openChange = (o: boolean) => {
    setOpen(o);
    // Start from the range in use, so adjusting it is one click.
    if (!o) return;
    setDraft(custom ? { from: toDate(from), to: toDate(to) } : undefined);
    setMax(new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()));
  };
  const ready = !!draft?.from;
  const apply = () => {
    if (!draft?.from) return;
    onRange(toDay(draft.from), toDay(draft.to ?? draft.from));
    setOpen(false);
  };
  const maxDate = max ? toDate(max) : new Date(8.64e15);

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger render={<button type="button" aria-label={`${label}: ${shown}`} className={toolbarButtonClass} />}>
        {custom ? <CalendarDays className="size-3.5 text-muted-foreground" strokeWidth={1.75} /> : <span className="text-muted-foreground">{label}:</span>}
        <span className="font-medium tabular-nums">{shown}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[calc(100vw-24px)] gap-0 overflow-hidden p-0">
        <div className="flex flex-col sm:flex-row">
          <div role="listbox" aria-label={label} className="flex gap-1 overflow-x-auto border-b p-1.5 sm:w-40 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r">
            {presets.map((p) => {
              const on = value === p.value;
              return (
                <button key={p.value} type="button" role="option" aria-selected={on} onClick={() => { onPreset(p.value); setOpen(false); }}
                  className={cn("flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-left text-[13px] transition-colors hover:bg-muted", on && "bg-muted font-medium")}>
                  <span className="flex-1 whitespace-nowrap">{p.label}</span>
                  {on && <Check className="hidden size-3.5 text-muted-foreground sm:block" />}
                </button>
              );
            })}
            <span className={cn("flex h-8 shrink-0 items-center rounded-md px-2.5 text-[13px] text-muted-foreground sm:mt-auto", value === "custom" && "font-medium text-foreground")}>
              Custom range
            </span>
          </div>
          <div>
            <RangeCalendar value={draft} onChange={setDraft} max={maxDate} />
            <div className="flex items-center gap-3 border-t px-3 py-2.5">
              <p className="min-w-0 flex-1 text-[12.5px] text-muted-foreground">
                {draft?.from ? <span className="font-medium tabular-nums text-foreground">{rangeLabel(toDay(draft.from), toDay(draft.to ?? draft.from))}</span> : "Pick a start and an end day"}
                {note && <span className="block text-[11.5px]">{note}</span>}
              </p>
              <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md px-3 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground">Cancel</button>
              <button type="button" disabled={!ready} onClick={apply}
                className="h-8 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-40">
                Apply
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const sameDay = (a?: Date, b?: Date) => !!a && !!b && a.getTime() === b.getTime();

/**
 * Two months side by side (one on a phone). The first click sets the start,
 * the second the end; hovering shows the range before it's picked.
 */
function RangeCalendar({ value, onChange, max }: { value?: DateRange; onChange: (r: DateRange) => void; max: Date }) {
  // The right-hand month is the end of the range, or the month of the last pickable day.
  const anchor = value?.to ?? value?.from ?? max;
  const [shown, setShown] = useState(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const [hover, setHover] = useState<Date | null>(null);
  const first = new Date(shown.getFullYear(), shown.getMonth() - 1, 1);
  const canNext = new Date(shown.getFullYear(), shown.getMonth() + 1, 1) <= max;

  const pick = (d: Date) => {
    if (!value?.from || value.to) return onChange({ from: d, to: undefined });
    if (d < value.from) return onChange({ from: d, to: value.from });
    onChange({ from: value.from, to: d });
  };
  const end = value?.to ?? (value?.from && hover && hover >= value.from ? hover : undefined);

  const month = (start: Date, hideOnPhone: boolean) => {
    const offset = (start.getDay() + 6) % 7; // weeks start on Monday
    const count = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => new Date(start.getFullYear(), start.getMonth(), i + 1))];
    return (
      <div className={cn("w-[238px]", hideOnPhone && "hidden sm:block")}>
        <p className="pb-2 text-center text-[13px] font-medium">{start.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
        <div className="grid grid-cols-7 text-center text-[11.5px] text-muted-foreground">
          {WEEKDAYS.map((w) => <span key={w} className="pb-1">{w}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => setHover(null)}>
          {cells.map((d, i) => {
            if (!d) return <span key={`b${i}`} />;
            const disabled = d > max;
            const isStart = sameDay(d, value?.from);
            const isEnd = sameDay(d, end) || (isStart && !end);
            const inside = !!value?.from && !!end && d > value.from && d < end;
            const today = sameDay(d, max);
            return (
              <div key={i} className={cn("relative h-8",
                inside && "bg-foreground/[0.07]",
                isStart && end && !sameDay(value?.from, end) && "rounded-l-md bg-gradient-to-r from-transparent from-50% to-foreground/[0.07] to-50%",
                isEnd && !isStart && "bg-gradient-to-l from-transparent from-50% to-foreground/[0.07] to-50%")}>
                <button type="button" disabled={disabled} onClick={() => pick(d)} onMouseEnter={() => setHover(d)}
                  aria-label={d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} aria-pressed={isStart || isEnd}
                  className={cn("relative mx-auto flex size-8 items-center justify-center rounded-md text-[13px] tabular-nums transition-colors",
                    disabled ? "cursor-default text-muted-foreground/35" : "hover:bg-foreground/[0.08]",
                    (isStart || isEnd) && "bg-foreground font-medium text-background hover:bg-foreground",
                    today && !(isStart || isEnd) && "font-semibold text-[#017D58] dark:text-[#2FB585]")}>
                  {d.getDate()}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const nav = "absolute top-2.5 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="relative flex gap-5 p-3">
      <button type="button" aria-label="Previous month" onClick={() => setShown(new Date(shown.getFullYear(), shown.getMonth() - 1, 1))} className={cn(nav, "left-3")}>
        <ChevronLeft className="size-4" />
      </button>
      <button type="button" aria-label="Next month" disabled={!canNext} onClick={() => setShown(new Date(shown.getFullYear(), shown.getMonth() + 1, 1))} className={cn(nav, "right-3")}>
        <ChevronRight className="size-4" />
      </button>
      {month(first, true)}
      {month(shown, false)}
    </div>
  );
}
