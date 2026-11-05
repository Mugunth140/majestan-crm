"use client";

import { Phone } from "lucide-react";
import { NameAvatar } from "@/components/shared/name-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { KanbanBoard, type KanbanCardData } from "@/components/views/kanban-board";
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

/** What a lead shows as a board card, and as a list row on phones. */
export const leadCard = (lead: KanbanLead): KanbanCardData => ({
    title: lead.name,
    id: lead.id,
    href: `/leads/${lead.rawId}`,
    subtitle: lead.mobile && (
      <span className="flex items-center gap-1.5 tabular-nums">
        <Phone className="size-3.5" strokeWidth={1.75} />
        {lead.mobile}
      </span>
    ),
    footer:
      lead.staff && lead.staff !== "Unassigned" ? (
        <>
          <NameAvatar name={lead.staff} staff className="size-5 text-[10px]" />
          <span className="truncate">{lead.staff}</span>
        </>
      ) : (
        <span className="text-muted-foreground">Unassigned</span>
      ),
    tag: lead.propertyType?.replace(/_/g, " "),
  });

// Leads as a board, one column per status in pipeline order. Cards drag between columns to change status.
export function LeadsKanban({
  leads,
  onMove,
}: {
  leads: KanbanLead[];
  onMove?: (lead: KanbanLead, status: string) => void;
}) {
  return (
    <KanbanBoard
      items={leads}
      getKey={(lead) => lead.rawId}
      columnOf={(lead) => lead.status || "No Status"}
      columnOrder={LEAD_STATUS_ORDER}
      renderColumnLabel={(status) => (
        <>
          <span className={cn("size-2 shrink-0 rounded-full", LEAD_STATUS_DOTS[status] ?? "bg-gray-400")} />
          <span className="truncate">{status}</span>
        </>
      )}
      onMove={onMove}
      canDrop={(_, status) => !KANBAN_LOCKED_STATUSES.includes(status)}
      lockedHint={(status) => (KANBAN_LOCKED_STATUSES.includes(status) ? "Set from the lead page" : "Can't move here")}
      emptyColumnLabel="No leads"
      emptyState={<EmptyState kind="people" title="No leads to show" description="Leads that match this view will appear here as cards." />}
      card={leadCard}
    />
  );
}
