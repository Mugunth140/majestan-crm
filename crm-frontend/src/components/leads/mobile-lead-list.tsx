"use client";

import { Phone, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LEAD_STATUS_STYLES } from "@/lib/lead-constants";
import { cn } from "@/lib/utils";

interface MobileLeadListProps {
  leads: any[];
  isLoading: boolean;
  onCardClick: (lead: any) => void;
  onCall: (lead: any) => void;
  onWhatsApp: (lead: any) => void;
}

export function MobileLeadList({ leads, isLoading, onCardClick, onCall, onWhatsApp }: MobileLeadListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border/60 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No results</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {leads.map((lead) => {
        const isPending = lead.isPendingImport === true;
        const statusCls = LEAD_STATUS_STYLES[lead.status] ?? "bg-gray-100 text-gray-800 border-gray-200";
        const assigned = lead.staff && lead.staff !== "Unassigned" ? lead.staff : null;
        const initial = (lead.name || "?").charAt(0).toUpperCase();
        const canContact = !isPending && !!lead.mobile;

        return (
          <div
            key={lead.rawId ?? lead.id}
            onClick={() => !isPending && onCardClick(lead)}
            className={cn(
              "bg-card border border-border/50 rounded-[1.5rem] p-4 shadow-sm transition-all flex flex-col gap-4",
              !isPending && "active:scale-[0.98]"
            )}
          >
            {/* Header: Avatar, Name, Status, Assignment */}
            <div className="flex items-start gap-3">
              <div className="h-[46px] w-[46px] rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center font-bold text-[18px] text-blue-600 dark:text-blue-400 shrink-0 border border-blue-100 dark:border-blue-800/50">
                {initial}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-[17px] text-foreground truncate leading-tight">{lead.name}</h3>
                  <Badge className={cn("font-medium shadow-sm border whitespace-nowrap shrink-0", statusCls)}>
                    {lead.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[13px]">
                  <span className="text-muted-foreground font-medium">{lead.id}</span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  {assigned ? (
                    <span className="text-foreground font-medium truncate">{assigned}</span>
                  ) : (
                    <span className="text-muted-foreground italic">Unassigned</span>
                  )}
                </div>
              </div>
            </div>

            {/* Details: Chips & Next Follow-up */}
            <div className="flex items-center justify-between gap-3 bg-muted/30 rounded-xl p-2.5">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {lead.propertyType && lead.propertyType !== "—" && (
                  <span className="text-[12px] px-2.5 py-1 rounded-lg bg-background border text-foreground font-medium capitalize shadow-sm">
                    {String(lead.propertyType).replace(/_/g, " ")}
                  </span>
                )}
                {lead.source && (
                  <span className="text-[12px] px-2.5 py-1 rounded-lg bg-background border text-foreground font-medium shadow-sm">
                    {lead.source}
                  </span>
                )}
              </div>
              {lead.nextFollowUpDate && (
                <div className="text-[12px] font-semibold text-amber-600 dark:text-amber-500 shrink-0 text-right">
                  Follow-up<br />
                  <span className="font-medium text-muted-foreground text-[11px]">{lead.nextFollowUpDate}</span>
                </div>
              )}
            </div>

            {/* Actions Row */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={(e) => { e.stopPropagation(); if (canContact) onCall(lead); }}
                disabled={!canContact}
                className="flex items-center justify-center gap-2 h-12 rounded-xl bg-[#007AFF]/10 text-[#007AFF] font-semibold text-[15px] active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
              >
                <Phone className="w-[18px] h-[18px]" strokeWidth={2.5} />
                Call
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); if (canContact) onWhatsApp(lead); }}
                disabled={!canContact}
                className="flex items-center justify-center gap-2 h-12 rounded-xl bg-[#25D366]/10 text-[#25D366] font-semibold text-[15px] active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
              >
                <MessageSquare className="w-[18px] h-[18px]" strokeWidth={2.5} />
                WhatsApp
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
