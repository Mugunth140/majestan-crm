"use client";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { blogApi, type BlogPost } from "@/lib/blog-api";
import { BlogNoAccess, useBlogAccess } from "@/components/blog/access";
import { MobileHeader } from "@/components/layout/mobile-header";
import { PageActions } from "@/components/layout/page-actions";
import { headerPrimaryClass } from "@/components/layout/list-page";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BlogPostList } from "@/components/blog/post-list";
import { Plus } from "lucide-react";
import { BlogForm } from "./_components/BlogForm";
import "./blog.css";

export default function BlogPage() {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [posts, setPosts] = useState<BlogPost[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistedState("blog:pageSize", 20);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const allowed = useBlogAccess();
  /** The article open in the form: "new", one being edited, or none. */
  const [editing, setEditing] = useState<BlogPost | "new" | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<BlogPost[]>([]);
  const load = async (p: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await blogApi.list(p, pageSize);
      setPosts(data.items);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    if (!allowed) return;
    blogApi
      .list(page, pageSize)
      .then((data) => {
        if (active) {
          setPosts(data.items);
          setTotal(data.total);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError((e as Error).message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [page, pageSize, allowed]);
  const edit = async (id?: number) => {
    if (!id) return setEditing("new");
    setBusy(true);
    try {
      setEditing(await blogApi.get(id));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const removeSelected = async () => {
    setBusy(true);
    try {
      const results = await Promise.allSettled(deleteTargets.map((item) => blogApi.remove(item)));
      const removed = results.filter((result) => result.status === "fulfilled").length;
      const failed = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      setDeleteTargets([]);
      if (removed) toast.success(`${removed === 1 ? "Article" : `${removed} articles`} deleted.`);
      if (failed.length)
        toast.error(failed[0].reason?.message || "Some articles could not be deleted. Refresh the table and try again.");
      const nextPage = Math.min(page, Math.max(1, Math.ceil((total - removed) / pageSize)));
      if (nextPage !== page) setPage(nextPage);
      else await load(page);
    } finally {
      setBusy(false);
    }
  };
  if (!allowed) return <BlogNoAccess />;
  return (
    <div className="blog-admin w-full flex flex-col gap-6 px-4 pt-4 pb-24 md:h-full md:gap-4 lg:p-0">
      <MobileHeader title="Blog" />
      <PageActions>
        <button type="button" className={headerPrimaryClass} onClick={() => edit()} disabled={busy}>
          <Plus className="size-4" />
          Create article
        </button>
      </PageActions>
      <header className="flex items-center gap-2 md:hidden">
        <Button className="h-11 flex-1 rounded-xl px-5 bg-[#0052FF] text-white shadow-md hover:bg-[#0052FF]/90" onClick={() => edit()} disabled={busy}>
          <Plus size={18} />
          Create article
        </Button>
      </header>
      {error && (
        <div role="alert" className="rounded-xl border border-red-400 p-4 mb-4">
          {error}
          <Button variant="outline" className="ml-4 rounded-xl" onClick={() => load(page)}>
            Retry
          </Button>
        </div>
      )}
      <BlogPostList
        posts={posts}
        loading={loading}
        busy={busy}
        total={total}
        page={page}
        now={now}
        onPage={setPage}
        pageSize={pageSize}
        onPageSize={(size) => { setPageSize(size); setPage(1); }}
        onEdit={edit}
        onOpen={(p) => router.push(`/blog/${p.id}`)}
        onDelete={setDeleteTargets}
      />
      {editing && (
        <BlogForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            const wasNew = editing === "new";
            setEditing(null);
            if (wasNew && next.id) router.push(`/blog/${next.id}`);
            else void load(page);
          }}
        />
      )}
      {deleteTargets.length > 0 && (
        <Dialog open onOpenChange={(open) => { if (!open && !busy) setDeleteTargets([]); }}>
          <DialogContent showCloseButton={false} className="p-8 max-w-md">
            <DialogTitle className="text-xl font-semibold">
              {`Delete ${deleteTargets.length === 1 ? "this article" : `${deleteTargets.length} articles`}?`}
            </DialogTitle>
            <DialogDescription className="mt-3 text-muted-foreground">
              This permanently removes the selected articles from the website.
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" autoFocus disabled={busy} className="h-10 rounded-xl px-4" onClick={() => setDeleteTargets([])}>
                Cancel
              </Button>
              <Button variant="destructive" className="h-10 rounded-xl px-4" disabled={busy} onClick={removeSelected}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
