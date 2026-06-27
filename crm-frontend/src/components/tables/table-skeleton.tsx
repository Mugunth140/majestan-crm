import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
}

export function TableSkeleton({ columns = 6, rows = 5 }: TableSkeletonProps) {
  return (
    <div className="rounded-md border bg-card w-full">
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
  );
}
