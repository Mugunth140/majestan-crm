"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, PenLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormSelect } from "@/components/shared/form-select";
import { FOCUS_BUTTON, FOCUS_FIELD, FieldRow, FocusField, FocusModal } from "@/components/shared/focus-modal";
import { FOCUS_INPUT, FOCUS_SELECT, StepFooter, StepSection, useFocusSteps } from "@/components/shared/focus-steps";
import { BlogImageUpload } from "@/components/blog/image-upload";
import { RichEditor } from "@/components/blog/rich-editor";
import { useLeaveGuard } from "@/hooks/use-leave-guard";
import { blogApi, emptyPost, savedMessage, type BlogPost } from "@/lib/blog-api";
import { cn } from "@/lib/utils";
import "../blog.css";

const BLOG_STEPS = [
  { key: "article", label: "Article" },
  { key: "body", label: "Body" },
  { key: "cover", label: "Cover image" },
] as const;
type BlogStep = (typeof BLOG_STEPS)[number]["key"];

const CATEGORIES = [
  "Property insights",
  "Buying guides",
  "Selling guides",
  "Renting guides",
  "Neighbourhood guides",
  "Market updates",
  "Investment",
  "Commercial property",
];

/**
 * Write or edit an article in the full-screen form. Unsaved edits are guarded:
 * closing asks first, and so does leaving the page.
 */
export function BlogForm({ initial, onClose, onSaved }: {
  /** The post to edit, or none for a new one. */
  initial?: BlogPost | null;
  onClose: () => void;
  onSaved: (post: BlogPost) => void;
}) {
  const [post, setPost] = useState<BlogPost>(() => initial ?? emptyPost());
  const [saved] = useState(() => JSON.stringify(initial ?? emptyPost()));
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(post) !== saved;
  const { pendingLeave, cancelLeave, confirmLeave } = useLeaveGuard(() => dirty && !busy);

  const create = !post.id;
  const nav = useFocusSteps<BlogStep>(BLOG_STEPS, {
    create,
    problem: (key) => (key === "article" && !post.title.trim() ? "Article title is required." : null),
  });

  const set = <K extends keyof BlogPost>(key: K, value: BlogPost[K]) => setPost((prev) => ({ ...prev, [key]: value }));
  const close = () => (dirty ? setDiscard(true) : onClose());

  const save = async () => {
    if (!post.title.trim()) {
      toast.error("Article title is required.");
      nav.go("article");
      return;
    }
    setBusy(true);
    try {
      const next = await blogApi.save(post);
      toast.success(savedMessage(next));
      onSaved(next);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const categories = Array.from(new Set([...CATEGORIES, post.category].filter(Boolean))).map((value) => ({ label: value, value }));
  const saveLabel = post.status === "draft" ? "Save draft" : "Save and publish";

  return (
    <FocusModal
        open
        onOpenChange={(o) => { if (!o && !busy) close(); }}
        title={create ? "New article" : "Edit article"}
        steps={nav.steps}
        active={nav.step}
        onStepChange={(k) => nav.jump(k as BlogStep)}
        footer={<StepFooter nav={nav} create={create} saving={busy} onCancel={close} onSave={() => void save()} createLabel={saveLabel} saveLabel={saveLabel} />}
      >
        <form
          className="blog-admin"
          onSubmit={(e) => {
            e.preventDefault();
            if (create && !nav.last) nav.next();
            else void save();
          }}
        >
          <StepSection title="Article" description="The author and publication date are added automatically." hidden={nav.step !== "article"}>
            <FocusField label="Article title" htmlFor="blog-title" required>
              <Input id="blog-title" maxLength={255} value={post.title} onChange={(e) => set("title", e.target.value)} autoFocus className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Description" htmlFor="blog-excerpt" hint="A short summary shown below the article title and on blog cards.">
              <Textarea id="blog-excerpt" rows={3} maxLength={500} value={post.excerpt} onChange={(e) => set("excerpt", e.target.value)} className={cn(FOCUS_FIELD, "resize-y py-2")} />
            </FocusField>
            <FieldRow>
              <FocusField label="Category" htmlFor="blog-category">
                <FormSelect id="blog-category" name="post-category" placeholder="Choose a category" value={post.category} options={categories}
                  onValueChange={(value) => set("category", value)} className={FOCUS_SELECT} />
              </FocusField>
              <FocusField label="Status" htmlFor="blog-status">
                <FormSelect id="blog-status" name="post-status" placeholder="Select status" value={post.status}
                  options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]}
                  onValueChange={(value) => set("status", value as BlogPost["status"])} className={FOCUS_SELECT} />
              </FocusField>
            </FieldRow>
          </StepSection>

          <section className={cn(nav.step !== "body" && "hidden")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-medium tracking-[-0.01em] text-foreground">Body</h2>
                <p className="mt-1 text-[14px] text-muted-foreground">The article as it reads on the website.</p>
              </div>
              <button type="button" className={FOCUS_BUTTON.secondary} onClick={() => setPreview(!preview)}>
                {preview ? <PenLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {preview ? "Continue editing" : "Preview article"}
              </button>
            </div>
            <div className="mt-6">
              <RichEditor
                key={`${preview ? "preview" : "edit"}-${post.id || "new"}-${post.revision || 0}`}
                readOnly={preview}
                content={post.content}
                onChange={(html) => set("content", html)}
              />
            </div>
          </section>

          <StepSection title="Cover image" description="Shown at the top of the article and on blog cards." hidden={nav.step !== "cover"}>
            <BlogImageUpload onUploaded={(url) => set("cover_image", url)} />
            <FocusField label="Image URL" htmlFor="blog-cover">
              <Input id="blog-cover" type="url" maxLength={2048} value={post.cover_image} onChange={(e) => set("cover_image", e.target.value)} className={FOCUS_INPUT} />
            </FocusField>
            {post.cover_image && (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded cover preview
              <img src={post.cover_image} alt={post.cover_alt || "Cover preview"} className="max-h-56 max-w-full rounded-lg border object-contain" />
            )}
            <FocusField label="Image description (alt text)" htmlFor="blog-alt">
              <Input id="blog-alt" maxLength={255} value={post.cover_alt} onChange={(e) => set("cover_alt", e.target.value)} className={FOCUS_INPUT} />
            </FocusField>
          </StepSection>
        </form>
        {/* Inside the modal so its focus trap lets the confirmation take focus. */}
        {(discard || pendingLeave) && (
          <Dialog open onOpenChange={(open) => { if (!open) { setDiscard(false); cancelLeave(); } }}>
            <DialogContent showCloseButton={false} className="max-w-md p-6">
              <DialogTitle className="text-lg font-semibold">Discard unsaved changes?</DialogTitle>
              <DialogDescription className="mt-2 text-muted-foreground">Your latest edits have not been saved.</DialogDescription>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" autoFocus onClick={() => { setDiscard(false); cancelLeave(); }}>Keep editing</Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (discard) {
                      setDiscard(false);
                      onClose();
                    } else confirmLeave();
                  }}
                >
                  Discard changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </FocusModal>
  );
}
