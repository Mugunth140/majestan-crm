"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit, ExternalLink, FileText, ImageIcon, Newspaper } from "lucide-react";
import { Section } from "@/components/record/inline-field";
import { TabHeader } from "@/components/record/feed";
import { AttachmentsArt, EmptyState } from "@/components/record/empty-state";
import { HEADER_BUTTON, StatusMenu } from "@/components/record/header-actions";
import { Fact, PHONE_EDIT, RecordPage, RecordSkeleton, RecordSummary } from "@/components/record/record-page";
import { formatTableDate, statusDot, statusPillClass } from "@/components/tables/cells";
import { BlogNoAccess, useBlogAccess } from "@/components/blog/access";
import { STATUS_TONE } from "@/components/blog/post-list";
import { RichEditor } from "@/components/blog/rich-editor";
import { blogApi, postStatus, savedMessage, type BlogPost } from "@/lib/blog-api";
import { cn } from "@/lib/utils";
import { BlogForm } from "../_components/BlogForm";
import "../blog.css";

const site = "https://www.majestanrealty.com";
type Tab = "article" | "cover";

const STATUS_OPTIONS = [
  { value: "Draft", dot: statusDot("Draft", STATUS_TONE.Draft) },
  { value: "Published", dot: statusDot("Published", STATUS_TONE.Published) },
];
const noop = () => {};

export default function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const allowed = useBlogAccess();
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("article");
  const [editing, setEditing] = useState(false);

  const load = useCallback(
    () => blogApi.get(Number(id)).then((data) => data ?? null, (reason) => {
      toast.error(reason instanceof Error && reason.message ? reason.message : "Failed to load the article.");
      router.push("/blog");
      return null;
    }),
    [id, router],
  );

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    load().then((data) => {
      if (!live) return;
      if (data) setPost(data);
      setIsLoading(false);
    });
    return () => { live = false; };
  }, [load, allowed]);

  const changeStatus = async (status: BlogPost["status"]) => {
    if (!post || status === post.status) return;
    try {
      const next = await blogApi.save({ ...post, status });
      setPost(next);
      toast.success(savedMessage(next));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!allowed) return <BlogNoAccess />;
  if (isLoading) return <RecordSkeleton title="Article" />;
  if (!post) return null;

  const label = postStatus(post, now);
  const tone = STATUS_TONE[label as keyof typeof STATUS_TONE];
  const live = post.status === "published" && label === "Published";
  const statusMenu = (size: "h-7" | "h-8", align: "start" | "end" = "end") => (
    <StatusMenu status={label} options={STATUS_OPTIONS} pillClass={statusPillClass(label, tone)} size={size} align={align}
      onChange={(v) => void changeStatus(v === "Draft" ? "draft" : "published")} />
  );
  const websiteButton = live ? (
    <a href={`${site}/blogs/${post.slug}`} target="_blank" rel="noreferrer" className={HEADER_BUTTON}>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /> View on website
    </a>
  ) : null;

  const article = (
    <div className="pb-6">
      <TabHeader title="Article" />
      <div className="space-y-5 px-3 sm:px-10">
        <div>
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.01em] text-foreground">{post.title}</h1>
          {post.excerpt && <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{post.excerpt}</p>}
        </div>
        {post.content ? (
          <RichEditor key={`${post.id}-${post.revision || 0}`} readOnly content={post.content} onChange={noop} />
        ) : (
          <p className="text-[14px] text-muted-foreground">This article has no body yet.</p>
        )}
      </div>
    </div>
  );

  const cover = (
    <div className="pb-6">
      <TabHeader title="Cover image" />
      <div className="space-y-3 px-3 sm:px-10">
        {post.cover_image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- uploaded cover */}
            <img src={post.cover_image} alt={post.cover_alt || ""} className="max-h-[420px] w-full rounded-lg border bg-muted object-contain" />
            <p className="text-[13px] text-muted-foreground">{post.cover_alt ? `Alt text: ${post.cover_alt}` : "No alt text."}</p>
          </>
        ) : (
          <EmptyState art={<AttachmentsArt />} title="No cover image" hint="Edit the article to add one." />
        )}
      </div>
    </div>
  );

  return (
    <div className="blog-admin md:h-full">
      <RecordPage
        title={post.title || "Article"}
        tabs={[
          { key: "article", label: "Article", icon: FileText },
          { key: "cover", label: "Cover image", icon: ImageIcon, count: post.cover_image ? 1 : 0 },
        ]}
        active={activeTab}
        onTab={setActiveTab}
        actions={
          <>
            {statusMenu("h-8")}
            {websiteButton}
            <button type="button" onClick={() => setEditing(true)} className={HEADER_BUTTON}>
              <Edit className="h-3.5 w-3.5 text-muted-foreground" /> Edit
            </button>
          </>
        }
        phone={
          <>
            <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
              {statusMenu("h-7", "start")}
              {post.category && <span>{post.category}</span>}
            </div>
            <button type="button" onClick={() => setEditing(true)} className={PHONE_EDIT}>
              <Edit className="h-4 w-4 text-muted-foreground" /> Edit article
            </button>
          </>
        }
        aside={
          <>
            <RecordSummary image={post.cover_image} icon={Newspaper} title={post.title || "Article"} subtitle={post.category} />
            <Section title="Details">
              <Fact label="Status">
                <span className="inline-flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", statusDot(label, tone))} />{label}</span>
              </Fact>
              <Fact label="Category">{post.category}</Fact>
              <Fact label="Author">{post.author_name}</Fact>
              <Fact label={label === "Scheduled" ? "Goes live" : "Published"}>{formatTableDate(post.published_at)}</Fact>
              <Fact label="Slug"><span className="truncate" title={post.slug}>{post.slug}</span></Fact>
              <Fact label="Website">
                {live ? <a href={`${site}/blogs/${post.slug}`} target="_blank" rel="noreferrer" className="truncate text-[#0052FF] hover:underline dark:text-[#6F9BFF]">Open article ↗</a> : null}
              </Fact>
            </Section>
          </>
        }
      >
        {activeTab === "article" ? article : cover}
      </RecordPage>

      {editing && (
        <BlogForm
          initial={post}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setEditing(false);
            setPost(next);
          }}
        />
      )}
    </div>
  );
}
