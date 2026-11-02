"use client";
import { DataTable } from "@/components/tables/data-table";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { BlogPost } from "@/lib/blog-api";
export function BlogPostList({
  posts,
  loading,
  busy,
  total,
  page,
  now,
  onPage,
  onEdit,
  onDelete,
}: {
  posts: BlogPost[];
  loading: boolean;
  busy: boolean;
  total: number;
  page: number;
  now: number;
  onPage: (page: number) => void;
  onEdit: (id?: number) => void;
  onDelete: (posts: BlogPost[]) => void;
}) {
  const columns: ColumnDef<BlogPost>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div
          className="flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${row.original.title}`}
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { fixedWidth: 48 },
    },
    {
      accessorKey: "title",
      header: "Article title",
      cell: ({ row }) => (
        <span
          className="font-semibold text-foreground text-sm truncate max-w-[280px] block"
          title={row.original.title}
        >
          {row.original.title}
        </span>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      meta: { hideOnMobile: true },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.category || "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const status =
          row.original.status === "draft"
            ? "Draft"
            : new Date(row.original.published_at!).getTime() > now
              ? "Scheduled"
              : "Published";
        return (
          <Badge
            variant="outline"
            className={
              status === "Published"
                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400"
                : status === "Scheduled"
                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
                  : "bg-muted/50 text-muted-foreground"
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "published_at",
      header: "Publication date",
      meta: { hideOnMobile: true },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {row.original.published_at
            ? new Date(row.original.published_at).toLocaleDateString("en-GB")
            : "—"}
        </span>
      ),
    },
  ];
  return (
    <section
      className="flex flex-col md:min-h-0 md:flex-1 lg:-mx-6 lg:-mb-8 lg:-mt-6"
      aria-label="Blog articles"
    >
      <div className="flex items-center gap-2 px-4 pb-1 pt-3 md:px-5">
        <span className="text-[13px] font-medium text-foreground">All articles</span>
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {total} {total === 1 ? "article" : "articles"}
        </span>
      </div>
      <div className="w-full max-w-full min-w-0 md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col">
        {loading ? (
          <TableSkeleton columns={5} rows={10} flush />
        ) : (
          <DataTable
            key={page}
            columns={columns}
            data={posts}
            variant="list"
            pageSizeOptions={[30]}
            showToolbar
            showDeleteAction
            onDeleteSelected={onDelete}
            renderToolbarActions={(selected, clear) =>
              selected.length === 1 ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    onEdit(selected[0].id);
                    clear();
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              ) : null
            }
            manualPagination
            pageCount={Math.max(1, Math.ceil(total / 30))}
            totalCount={total}
            pagination={{ pageIndex: page - 1, pageSize: 30 }}
            onPaginationChange={(updater) => {
              const next =
                typeof updater === "function"
                  ? updater({ pageIndex: page - 1, pageSize: 30 })
                  : updater;
              onPage(next.pageIndex + 1);
            }}
            persistKey={false}
          />
        )}
      </div>
    </section>
  );
}
