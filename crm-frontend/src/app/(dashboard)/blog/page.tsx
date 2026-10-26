"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { blogApi, emptyPost, type BlogPost } from "@/lib/blog-api";
import { can } from "@/lib/permissions";
import { BlogImageUpload } from "@/components/blog/image-upload";
import { RichEditor } from "@/components/blog/rich-editor";
import { useLeaveGuard } from "@/hooks/use-leave-guard";
import { MobileHeader } from "@/components/layout/mobile-header";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { BlogPostList } from "@/components/blog/post-list";
import { ArrowLeft, Plus, RefreshCw, Save } from "lucide-react";
import "./blog.css";
const site = "https://www.majestanrealty.com";
const subscribePermissions = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const blogPermission = () => can("blog.manage");
const serverPermission = () => false;
export default function BlogPage() {
  const [now] = useState(() => Date.now());
  const [posts, setPosts] = useState<BlogPost[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1);
  const [post, setPost] = useState<BlogPost | null>(null),
    [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const allowed = useSyncExternalStore(
    subscribePermissions,
    blogPermission,
    serverPermission,
  );
  const [preview, setPreview] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<BlogPost[]>([]);
  const dirty = !!post && JSON.stringify(post) !== saved;
  const { pendingLeave, cancelLeave, confirmLeave } = useLeaveGuard(
    () => dirty,
  );
  const load = async (p: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await blogApi.list(p);
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
      .list(page)
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
  }, [page, allowed]);
  const edit = async (id?: number) => {
    setBusy(true);
    setError("");
    try {
      const next = id ? await blogApi.get(id) : emptyPost();
      setPost(next);
      setSaved(JSON.stringify(next));
      setPreview(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const set = <K extends keyof BlogPost>(key: K, value: BlogPost[K]) =>
    setPost((prev) => (prev ? { ...prev, [key]: value } : prev));
  const save = async () => {
    if (!post) return;
    setBusy(true);
    setError("");
    try {
      const next = await blogApi.save(post);
      setPost(next);
      setSaved(JSON.stringify(next));
      toast.success(
        next.status === "draft"
          ? "Draft saved."
          : new Date(next.published_at!).getTime() > Date.now()
            ? "Post scheduled."
            : "Post published.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const back = () => {
    setPost(null);
    setSaved("");
    void load(page);
  };
  const [discard, setDiscard] = useState(false);
  const field = (
    key: keyof BlogPost,
    label: string,
    max: number,
    type = "text",
  ) => (
    <label className="blog-field grid gap-2">
      {label}
      <Input
        className="blog-input h-12 rounded-xl bg-muted/30 px-4 shadow-sm"
        type={type}
        maxLength={max}
        value={String(post?.[key] ?? "")}
        onChange={(e) => set(key, e.target.value as never)}
      />
    </label>
  );
  if (!allowed)
    return (
      <div className="p-8">
        <h1 className="text-3xl font-semibold">Blog</h1>
        <p className="mt-4">
          Ask an administrator to grant blog.manage permission to manage
          articles.
        </p>
      </div>
    );
  return (
    <div
      className={`blog-admin w-full flex flex-col gap-6 px-4 pt-4 pb-24 lg:p-0 ${post ? "" : "md:h-full"}`}
    >
      <MobileHeader
        title={post ? (post.id ? "Edit article" : "New article") : "Blog"}
      />
      <header className="flex flex-wrap items-center justify-between gap-4 md:pr-[150px] min-h-12">
        <div className="flex items-center gap-4">
          {post && (
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl shrink-0"
              aria-label="Back to articles"
              title="Back to articles"
              onClick={() => (dirty ? setDiscard(true) : back())}
              disabled={busy}
            >
              <ArrowLeft size={18} />
            </Button>
          )}
          <div className="hidden md:block">
            <h1 className="text-[28px] font-bold tracking-tight">
              {post ? (post.id ? "Edit article" : "New article") : "Blog"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage website articles and drafts.
            </p>
          </div>
        </div>
        {!post && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full border-border/60"
              onClick={() => load(page)}
              disabled={loading}
              aria-label="Refresh articles"
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              className="h-11 rounded-full px-5 bg-[#0052FF] text-white shadow-md hover:bg-[#0052FF]/90"
              onClick={() => edit()}
              disabled={busy}
            >
              <Plus size={18} />
              Create article
            </Button>
          </div>
        )}
      </header>
      {!post && error && (
        <div role="alert" className="rounded-xl border border-red-400 p-4 mb-4">
          {error}
          {!post && (
            <Button
              variant="outline"
              className="ml-4 rounded-xl"
              onClick={() => load(page)}
            >
              Retry
            </Button>
          )}
        </div>
      )}
      {!post ? (
        <BlogPostList
          posts={posts}
          loading={loading}
          busy={busy}
          total={total}
          page={page}
          now={now}
          onPage={setPage}
          onEdit={edit}
          onDelete={setDeleteTargets}
        />
      ) : (
        <>
          <section className="bg-card border rounded-2xl p-4 md:p-8 space-y-6">
            <label className="blog-field grid gap-2">
              Article title
              <Input
                className="blog-input h-12 rounded-xl bg-muted/30 px-4"
                maxLength={255}
                value={post.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </label>
            <label className="blog-field grid gap-2">
              Description
              <Textarea
                className="blog-input min-h-24 rounded-xl bg-muted/30 p-4"
                aria-label="Description"
                maxLength={500}
                value={post.excerpt}
                onChange={(e) => set("excerpt", e.target.value)}
              />
              <span className="text-xs font-normal text-muted-foreground">
                A short summary shown below the article title and on blog cards.
              </span>
            </label>
            <div
              className="grid grid-cols-1 md:grid-cols-2 items-start gap-6"
              data-blog-publishing-row
            >
              <label className="blog-field grid gap-2">
                Category
                <FormSelect
                  name="post-category"
                  placeholder="Choose a category"
                  value={post.category}
                  options={Array.from(
                    new Set(
                      [
                        "Property insights",
                        "Buying guides",
                        "Selling guides",
                        "Renting guides",
                        "Neighbourhood guides",
                        "Market updates",
                        "Investment",
                        "Commercial property",
                        post.category,
                      ].filter(Boolean),
                    ),
                  ).map((value) => ({ label: value, value }))}
                  onValueChange={(value) => set("category", value)}
                />
              </label>
              <label className="blog-field grid gap-2">
                Status
                <FormSelect
                  name="post-status"
                  placeholder="Select status"
                  value={post.status}
                  options={[
                    { value: "draft", label: "Draft" },
                    { value: "published", label: "Published" },
                  ]}
                  onValueChange={(value) =>
                    set("status", value as BlogPost["status"])
                  }
                />
                <span className="text-xs font-normal text-muted-foreground">
                  The author and publication date are added automatically.
                </span>
              </label>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Article body</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreview(!preview)}
                >
                  {preview ? "Continue editing" : "Preview article"}
                </Button>
              </div>
              <RichEditor
                key={`${preview ? "preview" : "edit"}-${post.id || "new"}-${post.revision || 0}`}
                readOnly={preview}
                content={post.content}
                onChange={(html) => set("content", html)}
              />
            </div>
            <div className="h-px bg-border" />
            <h2 className="text-base font-semibold">Cover image</h2>
            <BlogImageUpload onUploaded={(url) => set("cover_image", url)} />
            {field("cover_image", "Image URL", 2048, "url")}
            {post.cover_image && (
              <img
                src={post.cover_image}
                alt={post.cover_alt || "Cover preview"}
                className="max-h-48 max-w-full rounded-xl object-contain"
              />
            )}
            {field("cover_alt", "Image description (alt text)", 255)}
            <div className="h-px bg-border" />
            <div className="flex flex-wrap justify-between items-center gap-3">
              {post.id && post.status === "published" && (
                <a
                  className="text-sm underline text-[#0052FF]"
                  href={`${site}/blogs/${post.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open website article ↗
                </a>
              )}
            </div>
          </section>
          <div className="flex justify-end pt-2">
            <Button
              onClick={save}
              disabled={busy}
              className="h-12 px-8 rounded-xl bg-[#0052FF] text-white hover:bg-[#0052FF]/90"
            >
              <Save size={16} />
              {busy
                ? "Saving…"
                : post.status === "draft"
                  ? "Save draft"
                  : "Save and publish"}
            </Button>
          </div>
        </>
      )}
      {(pendingLeave || discard || deleteTargets.length > 0) && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) {
              cancelLeave();
              setDiscard(false);
              setDeleteTargets([]);
            }
          }}
        >
          <DialogContent showCloseButton={false} className="p-8 max-w-md">
            <DialogTitle className="text-xl font-semibold">
              {deleteTargets.length
                ? `Delete ${deleteTargets.length === 1 ? "this article" : `${deleteTargets.length} articles`}?`
                : "Discard unsaved changes?"}
            </DialogTitle>
            <DialogDescription className="mt-3 text-muted-foreground">
              {deleteTargets.length
                ? "This permanently removes the selected articles from the website."
                : "Your latest edits have not been saved."}
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                autoFocus
                disabled={busy}
                className="h-10 rounded-xl px-4"
                onClick={() => {
                  cancelLeave();
                  setDiscard(false);
                  setDeleteTargets([]);
                }}
              >
                Cancel
              </Button>
              <Button
                variant={deleteTargets.length ? "destructive" : "default"}
                className={
                  deleteTargets.length
                    ? "h-10 rounded-xl px-4"
                    : "h-11 rounded-full px-5 bg-[#0052FF] text-white border-transparent shadow-md hover:bg-[#0052FF]/90"
                }
                disabled={busy}
                onClick={async () => {
                  if (deleteTargets.length) {
                    setBusy(true);
                    try {
                      const results = await Promise.allSettled(
                        deleteTargets.map((item) => blogApi.remove(item)),
                      );
                      const removed = results.filter(
                        (result) => result.status === "fulfilled",
                      ).length;
                      const failed = results.filter(
                        (result): result is PromiseRejectedResult =>
                          result.status === "rejected",
                      );
                      setDeleteTargets([]);
                      if (removed)
                        toast.success(
                          `${removed === 1 ? "Article" : `${removed} articles`} deleted.`,
                        );
                      if (failed.length)
                        toast.error(
                          failed[0].reason?.message ||
                            "Some articles could not be deleted. Refresh the table and try again.",
                        );
                      const nextPage = Math.min(
                        page,
                        Math.max(1, Math.ceil((total - removed) / 30)),
                      );
                      if (nextPage !== page) setPage(nextPage);
                      else await load(page);
                    } finally {
                      setBusy(false);
                    }
                  } else if (discard) {
                    setDiscard(false);
                    back();
                  } else confirmLeave();
                }}
              >
                {deleteTargets.length ? "Delete" : "Discard changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
