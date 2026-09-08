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
                  <Skeleton className="h-4 w-full max-w-[100px] mx-auto" />
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
                    <Skeleton className="h-5 w-full mx-auto rounded-md" />
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
