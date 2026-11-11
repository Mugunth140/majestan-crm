"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Check, ChevronDown, Loader2, Plus, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchProjects, type SearchOption } from "@/lib/project-search";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface VisitDetails {
  date: string;
  time: string;
  project: string;
  location: string;
}

type Props = {
  /** null = closed. `status` is the status being set, if this was opened from the status menu. */
  open: { status: string | null; initial: Partial<VisitDetails> } | null;
  busy: boolean;
  onClose: () => void;
  /** Save the visit (and the status, if any). */
  onSave: (visit: VisitDetails) => void;
  /** Change the status without visit details (no confirmation email). */
  onSkip?: () => void;
};

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Date, time, project and meeting point of a site visit: what the confirmation email needs. */
export function ScheduleVisitDialog(props: Props) {
  return props.open ? <OpenDialog key={JSON.stringify(props.open)} {...props} open={props.open} /> : null;
}

function OpenDialog({ open, busy, onClose, onSave, onSkip }: Props & { open: NonNullable<Props["open"]> }) {
  const [visit, setVisit] = useState<VisitDetails>({
    date: open.initial.date ?? "",
    time: open.initial.time ?? "",
    project: open.initial.project ?? "",
    location: open.initial.location ?? "",
  });
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(visit.date) && visit.date >= todayLocal() && /^\d{2}:\d{2}$/.test(visit.time);
  const set = (key: keyof VisitDetails) => (e: React.ChangeEvent<HTMLInputElement>) => setVisit((v) => ({ ...v, [key]: e.target.value }));

  return (
    <Dialog open onOpenChange={(value) => { if (!value && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-[#017D58] dark:text-[#2FB585]" /> Schedule site visit</DialogTitle>
          <DialogDescription>
            {open.status ? <>Status will change to <strong>{open.status}</strong>. </> : null}
            These details go into the visit confirmation email and the reminder the day before.
          </DialogDescription>
        </DialogHeader>
        <form id="schedule-visit" onSubmit={(e) => { e.preventDefault(); if (valid) onSave(visit); }} className="grid grid-cols-2 gap-4 py-2">
          <label className="space-y-1.5">
            <span className="text-[13px] font-medium text-foreground/80">Date</span>
            <Input type="date" min={todayLocal()} value={visit.date} onChange={set("date")} required className="h-10 rounded-xl" />
          </label>
          <label className="space-y-1.5">
            <span className="text-[13px] font-medium text-foreground/80">Time (IST)</span>
            <Input type="time" value={visit.time} onChange={set("time")} required className="h-10 rounded-xl" />
          </label>
          <div className="col-span-2 space-y-1.5">
            <span className="text-[13px] font-medium text-foreground/80">Project</span>
            <ProjectPicker value={visit.project} onChange={(project) => setVisit((v) => ({ ...v, project }))} />
          </div>
          <label className="col-span-2 space-y-1.5">
            <span className="text-[13px] font-medium text-foreground/80">Meeting point</span>
            <Input value={visit.location} onChange={set("location")} maxLength={500} placeholder="Leave empty to use the project address" className="h-10 rounded-xl" />
          </label>
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {onSkip ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={onSkip} className="rounded-xl text-muted-foreground">Skip for now</Button>
          ) : <span />}
          <Button type="submit" form="schedule-visit" disabled={busy || !valid} className="px-5 bg-foreground text-background hover:bg-foreground/85">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save visit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One project: search the site's projects, or add a name that isn't listed. */
function ProjectPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchOption[] | null>(null);
  const typed = query.trim().slice(0, 255);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const timer = setTimeout(() => {
      searchProjects(typed).then((r) => { if (live) setResults(r); }, () => { if (live) setResults([]); });
    }, 200);
    return () => { live = false; clearTimeout(timer); };
  }, [open, typed]);

  const pick = (name: string) => { onChange(name); setOpen(false); setQuery(""); setResults(null); };
  const listed = results?.some((r) => r.label.toLowerCase() === typed.toLowerCase());

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQuery(""); setResults(null); } }}>
        <PopoverTrigger render={<button type="button" aria-label="Project" className="flex h-10 w-full items-center gap-2 rounded-xl border border-input bg-transparent px-3 text-left text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />}>
          <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>{value || "Search projects…"}</span>
          {!value && <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) min-w-[260px] gap-0 p-0">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !typed) return;
                e.preventDefault();
                pick(results?.find((r) => r.label.toLowerCase() === typed.toLowerCase())?.label ?? results?.[0]?.label ?? typed);
              }}
              placeholder="Search projects…"
              aria-label="Search projects"
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
                    {r.label === value && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                ))}
                {!results.length && !typed && <p className="px-2 py-2 text-[13px] text-muted-foreground">No projects found.</p>}
                {typed && !listed && (
                  <button type="button" onClick={() => pick(typed)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[14px] text-muted-foreground hover:bg-muted">
                    <Plus className="h-3.5 w-3.5 shrink-0" /> Add “<span className="truncate text-foreground">{typed}</span>”
                  </button>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {value && (
        <button type="button" aria-label="Clear project" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
