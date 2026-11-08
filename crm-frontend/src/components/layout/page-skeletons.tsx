import { cn } from "@/lib/utils";

// Placeholders shaped like the page being opened, so the layout doesn't jump
// when the real content arrives. Widths vary per row to read as text, not bars.

function Bone({ className }: { className?: string }) {
  return <div className={cn("skeleton-bone rounded-md bg-muted", className)} />;
}

const ROW_WIDTHS = ["w-28", "w-36", "w-24", "w-32", "w-20", "w-40", "w-28", "w-24"];

/** List page: toolbar, header row, rows. Matches ListFrame/ListToolbar/DataTable list. */
export function ListPageSkeleton({ rows = 12, columns = 7 }: { rows?: number; columns?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col md:min-h-0 md:flex-1 lg:-mx-6 lg:-mb-8 lg:-mt-6">
      <div className="flex items-center gap-2 px-4 pb-2 pt-3 md:px-5">
        <Bone className="h-8 w-56" />
        <div className="ml-auto flex gap-2">
          <Bone className="hidden h-8 w-64 md:block" />
          <Bone className="h-8 w-20" />
        </div>
      </div>
      <div className="px-4 pt-3 md:px-5">
        <div className="flex h-8 items-center gap-6 rounded-md bg-muted/70 px-3">
          {Array.from({ length: columns }, (_, c) => (
            <Bone key={c} className={cn("h-2.5 bg-foreground/10", c === 0 ? "w-4" : "w-16")} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex h-11 items-center gap-6 border-b border-border/60 px-3" style={{ opacity: 1 - r * 0.06 }}>
            <Bone className="size-4 rounded" />
            <Bone className="size-6 rounded-full" />
            {Array.from({ length: columns - 2 }, (_, c) => (
              <Bone key={c} className={cn("h-3", ROW_WIDTHS[(r + c) % ROW_WIDTHS.length], c > 2 && "hidden md:block")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Record page: title block, a side panel and stacked sections. */
export function DetailPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-5 px-4 pt-4 md:px-0 md:pt-0">
      <div className="flex items-center gap-3">
        <Bone className="size-12 rounded-full" />
        <div className="space-y-2">
          <Bone className="h-5 w-48" />
          <Bone className="h-3 w-32" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 rounded-xl border p-5">
              <Bone className="h-4 w-36" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }, (_, j) => (
                  <div key={j} className="space-y-1.5">
                    <Bone className="h-2.5 w-16" />
                    <Bone className={cn("h-3.5", ROW_WIDTHS[(i + j) % ROW_WIDTHS.length])} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-xl border p-5">
          <Bone className="h-4 w-28" />
          {Array.from({ length: 5 }, (_, j) => (
            <div key={j} className="flex items-center gap-3">
              <Bone className="size-7 rounded-full" />
              <Bone className={cn("h-3", ROW_WIDTHS[j])} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
