"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { headerButtonClass, headerPrimaryClass } from "@/components/layout/list-page";

// A page that throws is replaced by this; the sidebar and top row stay usable.
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard caught an error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        kind="error"
        title="This page hit a problem"
        description="Something went wrong while showing it. Try again, and if it keeps happening, reload the app."
        action={
          <div className="flex items-center gap-2">
            <button type="button" className={headerButtonClass} onClick={() => window.location.reload()}>
              Reload app
            </button>
            <button type="button" className={headerPrimaryClass} onClick={() => unstable_retry()}>
              <RotateCcw className="size-4" />
              Try again
            </button>
          </div>
        }
      />
    </div>
  );
}
