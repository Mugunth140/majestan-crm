"use client";

import Link from "next/link";
import { useMemo, useState, type DragEvent } from "react";
import { Lock, Phone } from "lucide-react";
import { NameAvatar } from "@/components/shared/name-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { LEAD_STATUS_DOTS, LEAD_STATUS_ORDER } from "@/lib/lead-constants";
import { cn } from "@/lib/utils";

// Lead fields the board reads (rows come from GET /leads).
export interface KanbanLead {
  rawId: number;
  id: string;
  name: string;
  mobile?: string;
  status: string;
  staff?: string;
  propertyType?: string;
  source?: string;
  date?: string;
}

// These statuses need details first (visit slot, drop reason), so they're set from the lead page.
export const KANBAN_LOCKED_STATUSES = ["Site Visit Scheduled", "Re Visit Scheduled", "Not Interested", "Dropped"];

const DRAG_TYPE = "application/x-crm-lead";

// Leads as a board, one column per status in pipeline order. Cards drag between columns to change status.
export function LeadsKanban({
  leads,
  onMove,
}: {
  leads: KanbanLead[];
  onMove?: (lead: KanbanLead, status: string) => void;
}) {
  const [dragging, setDragging] = useState<KanbanLead | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const columns = useMemo(() => {
    const byStatus = new Map<string, KanbanLead[]>();
    // Every pipeline status gets a column, so empty ones are still drop targets.
    if (onMove) for (const s of LEAD_STATUS_ORDER) byStatus.set(s, []);
    for (const lead of leads) {
      const key = lead.status || "No Status";
      if (!byStatus.has(key)) byStatus.set(key, []);
      byStatus.get(key)!.push(lead);
    }
    const rank = (s: string) => {
      const i = LEAD_STATUS_ORDER.indexOf(s);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...byStatus.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  }, [leads, onMove]);

  if (leads.length === 0) {
    return <EmptyState kind="people" title="No leads to show" description="Leads that match this view will appear here as cards." />;
  }

  const canDrop = (status: string) =>
    !!dragging &&
    status !== dragging.status &&
    LEAD_STATUS_ORDER.includes(status) &&
    !KANBAN_LOCKED_STATUSES.includes(status);

  const endDrag = () => {
    setDragging(null);
    setOver(null);
  };

  const onColumnDragOver = (e: DragEvent, status: string) => {
    if (!canDrop(status)) return; // no preventDefault → the browser shows "not allowed"
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (over !== status) setOver(status);
  };

  const onColumnDrop = (e: DragEvent, status: string) => {
    e.preventDefault();
    const lead = dragging;
    endDrag();
    if (lead && canDrop(status)) onMove?.(lead, status);
  };

  return (
    <div className="kanban-scroll flex h-full min-h-0 flex-1 gap-3 overflow-x-auto px-5 py-4">
      {columns.map(([status, items]) => {
        const locked = !!dragging && status !== dragging.status && !canDrop(status);
        const target = over === status;
        return (
          <section
            key={status}
            aria-label={status}
            onDragOver={(e) => onColumnDragOver(e, status)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null) && over === status) setOver(null);
            }}
            onDrop={(e) => onColumnDrop(e, status)}
            className={cn(
              "flex max-h-full w-[280px] shrink-0 flex-col rounded-xl bg-muted/50 transition-[background-color,box-shadow,opacity] duration-150 dark:bg-white/[0.03]",
              target && "bg-[#017D58]/[0.07] shadow-[inset_0_0_0_1.5px_rgba(1,125,88,0.45)] dark:bg-[#2FB585]/[0.08]",
              locked && "opacity-50",
            )}
          >
            <header className="flex h-10 shrink-0 items-center gap-2 px-3">
              <span className={cn("size-2 rounded-full", LEAD_STATUS_DOTS[status] ?? "bg-gray-400")} />
              <h3 className="truncate text-[14px] font-medium text-foreground">{status}</h3>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{items.length}</span>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {items.map((lead) => (
                <Link
                  key={lead.rawId}
                  href={`/leads/${lead.rawId}`}
                  draggable={!!onMove}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData(DRAG_TYPE, String(lead.rawId));
                    // Let the browser snapshot the card before it dims.
                    requestAnimationFrame(() => setDragging(lead));
                  }}
                  onDragEnd={endDrag}
                  className={cn(
                    "group rounded-lg bg-background p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.05)] outline-none transition-[box-shadow,opacity] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_4px_12px_-4px_rgba(0,0,0,0.12)] focus-visible:ring-2 focus-visible:ring-[#017D58]/40 dark:bg-card dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
                    onMove && "cursor-grab active:cursor-grabbing",
                    dragging?.rawId === lead.rawId && "opacity-40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <NameAvatar name={lead.name} />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">{lead.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{lead.id}</span>
                  </div>
                  {lead.mobile && (
                    <p className="mt-2 flex items-center gap-1.5 text-[13px] tabular-nums text-muted-foreground">
                      <Phone className="size-3.5" strokeWidth={1.75} />
                      {lead.mobile}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2.5">
                    {lead.staff && lead.staff !== "Unassigned" ? (
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-foreground/80">
                        <NameAvatar name={lead.staff} className="size-5 text-[10px]" />
                        <span className="truncate">{lead.staff}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                    {lead.propertyType && (
                      <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] capitalize text-muted-foreground">
                        {lead.propertyType.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
              {items.length === 0 && !locked && (
                <div
                  className={cn(
                    "flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors",
                    target && "border-[#017D58]/50 text-[#017D58] dark:border-[#2FB585]/50 dark:text-[#2FB585]",
                  )}
                >
                  {dragging ? "Drop here" : "No leads"}
                </div>
              )}
              {locked && (
                <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  <Lock className="size-3.5" strokeWidth={1.75} />
                  {KANBAN_LOCKED_STATUSES.includes(status) ? "Set from the lead page" : "Can't move here"}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
