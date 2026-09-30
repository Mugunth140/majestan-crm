"use client";

import { useRouter } from "next/navigation";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { lastFollowupView, type LastFollowupRow } from "@/lib/last-followup";

export function LastFollowupCell({ row }: { row: LastFollowupRow }) {
  const router = useRouter();
  const view = lastFollowupView(row);

  // No follow-up is not a link. There is no timeline to open, and a dead target
  // in a dense table only invites mis-clicks.
  if (view.state === "none") {
    return <span className="text-muted-foreground italic">—</span>;
  }

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              title={view.absolute}
              onClick={(e) => {
                // The whole row is a selection target, so opening the timeline
                // must not also select the lead.
                e.stopPropagation();
                router.push(view.href);
              }}
              className="text-[#0052FF] hover:underline font-medium text-sm cursor-pointer"
            >
              {view.label}
            </button>
          }
        />
        <TooltipContent
          side="top"
          className="max-w-[300px] max-h-64 overflow-y-auto text-sm break-words whitespace-normal p-3 border-border/50 shadow-xl bg-background text-foreground relative z-50"
        >
          {view.notes ?? "No notes recorded"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
