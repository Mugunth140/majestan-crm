import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  flush?: boolean;
}

function CellSkeleton({ colIndex, rowIndex }: { colIndex: number; rowIndex: number }) {
  const alt = (rowIndex + colIndex) % 2 === 0;
  switch (colIndex % 7) {
    case 0:
      return <Skeleton className="h-4 w-4 mx-auto rounded" />;
    case 1:
      return <Skeleton className={cn("h-4 mx-auto", alt ? "w-8" : "w-10")} />;
    case 2:
      return (
        <div className="flex items-center gap-2 min-w-0">
          <Skeleton className="h-7 w-7 rounded-full shrink-0" />
          <div className="min-w-0 space-y-1.5 flex-1">
            <Skeleton className={cn("h-4", alt ? "w-32" : "w-24")} />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      );
    case 3:
      return <Skeleton className={cn("h-6 mx-auto rounded-full", alt ? "w-16" : "w-20")} />;
    case 4:
      return <Skeleton className={cn("h-5 mx-auto rounded-md", alt ? "w-24" : "w-28")} />;
    case 5:
      return <Skeleton className={cn("h-4 mx-auto", alt ? "w-28" : "w-20")} />;
    default:
      return <Skeleton className={cn("h-4 mx-auto", alt ? "w-12" : "w-16")} />;
  }
}

export function TableSkeleton({ columns = 11, rows = 10, flush = false }: TableSkeletonProps) {
  return (
    <div className={cn(
      "w-full md:flex-1 md:h-full md:min-h-0 min-h-[480px] flex flex-col overflow-hidden",
      flush ? "" : "rounded-md border bg-card"
    )}>
      <div className="overflow-hidden md:flex-1 md:min-h-0 w-full">
        <Table>
          <TableHeader className="bg-muted/40 border-b">
            <TableRow className="hover:bg-transparent border-none">
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead
                  key={i}
                  className="h-11 border-r border-border/60 last:border-r-0 px-4 text-center"
                >
                  <Skeleton className={cn("h-4 mx-auto", i % 3 === 0 ? "w-10" : i % 3 === 1 ? "w-16" : "w-24")} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <TableRow
                key={rowIndex}
                className="border-b border-border/60"
              >
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <TableCell
                    key={colIndex}
                    className="py-3 px-4 border-r border-border/60 last:border-r-0 text-center"
                  >
                    <CellSkeleton colIndex={colIndex} rowIndex={rowIndex} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className={cn(
        "flex items-center justify-between px-2 pt-4 md:px-0",
        flush ? "px-6 border-t border-border/40 pb-4" : ""
      )}>
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}
