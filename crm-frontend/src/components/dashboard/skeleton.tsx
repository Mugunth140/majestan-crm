import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the dashboard: header, tabs, KPI tiles, then a chart row. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="mx-auto w-full max-w-screen-2xl space-y-8 px-4 pt-4 lg:px-0 lg:pt-0">
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-80 rounded-xl lg:col-span-8" />
        <Skeleton className="h-80 rounded-xl lg:col-span-4" />
      </div>
    </div>
  );
}
