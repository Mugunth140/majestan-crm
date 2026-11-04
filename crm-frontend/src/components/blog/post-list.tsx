"use client";
import { isAdmin } from "@/lib/permissions";
import { DataTable } from "@/components/tables/data-table";
import { DateCell, IdCell, NameCell, StatusCell, formatTableDate, statusDot } from "@/components/tables/cells";
import { ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { postStatus, type BlogPost } from "@/lib/blog-api";

export const STATUS_TONE = { Published: "green", Scheduled: "blue", Draft: "amber" } as const;

export function BlogPostList({
  posts,
  loading,
  busy,
  total,
  page,
  now,
  onPage,
  onEdit,
  onOpen,
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
  /** Opens the article's page. */
  onOpen: (post: BlogPost) => void;
  onDelete: (posts: BlogPost[]) => void;
}) {
  const fields: ViewField<BlogPost>[] = [
    { id: "status", label: "Status", get: (p) => postStatus(p, now), order: ["Published", "Scheduled", "Draft"], dot: (v) => statusDot(v, STATUS_TONE[v as keyof typeof STATUS_TONE]) },
    { id: "category", label: "Category", get: (p) => p.category },
  ];
  const views = useModuleView("blog", fields);
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
      accessorKey: "id",
      header: "ID",
      meta: { hideOnMobile: true },
      cell: ({ row }) => <IdCell>{row.original.id}</IdCell>,
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <span title={row.original.title}>
          <NameCell name={row.original.title} className="max-w-[320px]" />
        </span>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      meta: { hideOnMobile: true },
      cell: ({ row }) => (
        <span>{row.original.category || "—"}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = postStatus(row.original, now);
        return <StatusCell status={status} tone={STATUS_TONE[status]} />;
      },
    },
    {
      accessorKey: "published_at",
      header: "Published",
      meta: { hideOnMobile: true },
      cell: ({ row }) => <DateCell value={row.original.published_at} />,
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
        <span className="ml-auto">{views.picker}</span>
      </div>
      {views.switcher}
      <div className="w-full max-w-full min-w-0 md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col">
        {loading ? (
          <TableSkeleton columns={5} rows={10} flush />
        ) : (
          <ModuleViews
            state={views}
            data={posts}
            columns={columns}
            list={
              <DataTable
                key={page}
                columns={columns}
                data={posts}
                variant="list"
                pageSizeOptions={[30]}
                showToolbar
                showDeleteAction={isAdmin()}
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
            }
            getKey={(p) => p.id!}
            onOpen={onOpen}
            card={(p) => ({ title: p.title, avatar: false, id: p.id, href: `/blog/${p.id}`, subtitle: p.category || undefined, tag: formatTableDate(p.published_at) || undefined })}
            totalCount={total}
            noun="articles"
          />
        )}
      </div>
    </section>
  );
}
