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
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-8 w-full rounded-xl" />
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
    <div className="space-y-3">
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
              "bg-card border border-border/60 rounded-2xl p-4 shadow-sm transition-all",
              !isPending && "active:scale-[0.98]"
            )}
          >
            {/* Row 1: avatar + name + status */}
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-[15px] text-blue-900 dark:text-blue-300 shrink-0">
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[15px] text-foreground truncate">{lead.name}</p>
                  <Badge className={"font-medium shadow-sm border whitespace-nowrap shrink-0 " + statusCls}>
                    {lead.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lead.id} · {lead.date}
                </p>
              </div>
            </div>

            {/* Row 2: mobile + chips + quick actions */}
            <div className="flex items-center justify-between gap-3 mt-3">
              <div className="flex flex-col gap-1.5 min-w-0">
                {lead.mobile && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (canContact) onCall(lead); }}
                    disabled={!canContact}
                    className={cn(
                      "flex items-center gap-1.5 text-[13.5px] font-semibold text-[#007AFF] w-fit",
                      canContact ? "active:opacity-60" : "opacity-40"
                    )}
                  >
                    <Phone className="h-3.5 w-3.5" /> {lead.mobile}
                  </button>
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {lead.propertyType && lead.propertyType !== "—" && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-muted/40 text-muted-foreground capitalize">
                      {String(lead.propertyType).replace(/_/g, " ")}
                    </span>
                  )}
                  {lead.source && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400">
                      {lead.source}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); if (canContact) onCall(lead); }}
                  disabled={!canContact}
                  className="h-11 w-11 rounded-full bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40 disabled:active:scale-100"
                  aria-label="Log call"
                >
                  <Phone className="w-5 h-5" strokeWidth={2} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (canContact) onWhatsApp(lead); }}
                  disabled={!canContact}
                  className="h-11 w-11 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40 disabled:active:scale-100"
                  aria-label="Send WhatsApp"
                >
                  <MessageSquare className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Row 3: assigned + next follow-up */}
            <div className="flex items-center justify-between border-t border-border/50 mt-3 pt-3">
              <div className="flex items-center gap-1.5 min-w-0">
                {assigned ? (
                  <>
                    <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center font-bold text-[10px] text-muted-foreground shrink-0">
                      {assigned.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-foreground truncate">{assigned}</span>
                  </>
                ) : (
                  <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-border/60">
                    Unassigned
                  </Badge>
                )}
              </div>
              {lead.nextFollowUpDate && (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400 shrink-0">
                  Follow-up {lead.nextFollowUpDate}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
