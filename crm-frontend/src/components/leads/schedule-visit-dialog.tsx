"use client";

import { useState } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
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
          <DialogTitle className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-[#0052FF]" /> Schedule site visit</DialogTitle>
          <DialogDescription>
            {open.status ? <>Status will change to <strong>{open.status}</strong>. </> : null}
            These details go into the visit confirmation email and the reminder the day before.
          </DialogDescription>
        </DialogHeader>
        <form id="schedule-visit" onSubmit={(e) => { e.preventDefault(); if (valid) onSave(visit); }} className="grid grid-cols-2 gap-4 py-2">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</span>
            <Input type="date" min={todayLocal()} value={visit.date} onChange={set("date")} required className="h-10 rounded-xl" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Time (IST)</span>
            <Input type="time" value={visit.time} onChange={set("time")} required className="h-10 rounded-xl" />
          </label>
          <label className="col-span-2 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project</span>
            <Input value={visit.project} onChange={set("project")} maxLength={255} placeholder="e.g. Emerald Heights" className="h-10 rounded-xl" />
          </label>
          <label className="col-span-2 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Meeting point</span>
            <Input value={visit.location} onChange={set("location")} maxLength={500} placeholder="Leave empty to use the project address" className="h-10 rounded-xl" />
          </label>
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {onSkip ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={onSkip} className="rounded-xl text-muted-foreground">Skip for now</Button>
          ) : <span />}
          <Button type="submit" form="schedule-visit" disabled={busy || !valid} className="rounded-xl px-6 bg-[#0052FF] text-white hover:bg-[#0040CC]">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save visit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
