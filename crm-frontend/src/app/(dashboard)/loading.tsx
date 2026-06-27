import { Skeleton } from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/tables/table-skeleton"

export default function DashboardLoading() {
  return (
    <div className="flex flex-col space-y-6 w-full animate-in fade-in duration-300 p-8">
      {/* Page Header Mock */}
      <div className="flex items-center justify-between pr-[150px]">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="flex gap-1.5 rounded-full border bg-card px-2 py-1.5 shadow-sm">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm pt-4">
        {/* Mock Tabs */}
        <div className="flex gap-8 border-b px-6 pb-0">
          <Skeleton className="h-6 w-24 mb-4" />
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-6 w-40 mb-4" />
        </div>

        {/* Reusable Data Table Skeleton */}
        <div className="p-6">
          <TableSkeleton columns={8} rows={6} />
        </div>
      </div>
    </div>
  )
}
