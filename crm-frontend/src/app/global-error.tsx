"use client";

import "./globals.css";
import { EmptyState } from "@/components/shared/empty-state";

// Last resort when the root layout itself fails: no shell, so a standalone page.
export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background text-foreground antialiased">
        <EmptyState
          kind="error"
          title="The CRM couldn't start"
          description="Something went wrong while loading. Try again, or reload the page."
          action={
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => window.location.reload()} className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-[14px] font-medium">
                Reload
              </button>
              <button type="button" onClick={() => unstable_retry()} className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-[14px] font-medium text-background">
                Try again
              </button>
            </div>
          }
        />
      </body>
    </html>
  );
}
