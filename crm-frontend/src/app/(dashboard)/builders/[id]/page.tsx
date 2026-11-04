"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Edit, ExternalLink } from "lucide-react";
import { Section } from "@/components/record/inline-field";
import { TabHeader } from "@/components/record/feed";
import { HEADER_BUTTON, StatusMenu } from "@/components/record/header-actions";
import { DataCard, Fact, PHONE_EDIT, RecordPage, RecordSkeleton, RecordSummary } from "@/components/record/record-page";
import { formatTableDate, statusDot, statusPillClass } from "@/components/tables/cells";
import { buildersApi, type BuilderRecord } from "@/lib/builders-api";
import { cn } from "@/lib/utils";
import { BuilderForm } from "../_components/BuilderForm";

const STATUS_OPTIONS = ["Active", "Inactive"].map((s) => ({ value: s, dot: statusDot(s) }));
const count = (n?: number | null) => (n == null ? null : n.toLocaleString("en-IN"));
const link = (href?: string | null, label?: string | null) =>
  href ? <a href={href} target="_blank" rel="noreferrer" className="min-w-0 truncate text-[#0052FF] hover:underline dark:text-[#6F9BFF]">{label ?? href}</a> : null;

export default function BuilderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [builder, setBuilder] = useState<BuilderRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(
    () => buildersApi.getOne(Number(id)).then((result) => {
      if (result && result.success !== false) return (result.data ?? result) as BuilderRecord;
      toast.error("Builder not found.");
      router.push("/builders");
      return null;
    }, () => {
      toast.error("Failed to load builder.");
      router.push("/builders");
      return null;
    }),
    [id, router],
  );

  useEffect(() => {
    let live = true;
    load().then((data) => {
      if (!live) return;
      if (data) setBuilder(data);
      setIsLoading(false);
    });
    return () => { live = false; };
  }, [load]);

  const changeStatus = async (next: string) => {
    const isActive = next === "Active";
    try {
      const result = await buildersApi.update(Number(id), { isActive });
      if (result && result.success === false) throw new Error(result.message);
      setBuilder((prev) => prev && { ...prev, isActive });
      toast.success(`Marked ${next.toLowerCase()}`);
    } catch (reason) {
      toast.error(reason instanceof Error && reason.message ? reason.message : "Couldn't change the status");
    }
  };

  if (isLoading) return <RecordSkeleton title="Builder" />;
  if (!builder) return null;

  const status = builder.isActive ? "Active" : "Inactive";
  const statusMenu = (size: "h-7" | "h-8", align: "start" | "end" = "end") => (
    <StatusMenu status={status} options={STATUS_OPTIONS} pillClass={statusPillClass(status)} size={size} align={align}
      onChange={(v) => void changeStatus(v)} />
  );
  const site = builder.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <>
      <RecordPage
        title={builder.name}
        tabs={[{ key: "overview", label: "Overview", icon: Building2 }]}
        active="overview"
        onTab={() => {}}
        actions={
          <>
            {statusMenu("h-8")}
            {builder.website && (
              <a href={builder.website} target="_blank" rel="noreferrer" className={HEADER_BUTTON}>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /> Website
              </a>
            )}
            <button type="button" onClick={() => setEditing(true)} className={HEADER_BUTTON}>
              <Edit className="h-3.5 w-3.5 text-muted-foreground" /> Edit
            </button>
          </>
        }
        phone={
          <>
            <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
              {statusMenu("h-7", "start")}
              {builder.phone && <span>{builder.phone}</span>}
            </div>
            <button type="button" onClick={() => setEditing(true)} className={PHONE_EDIT}>
              <Edit className="h-4 w-4 text-muted-foreground" /> Edit builder
            </button>
          </>
        }
        aside={
          <>
            <RecordSummary image={builder.logoUrl} icon={Building2} title={builder.name} subtitle={site || builder.email} imageClass="h-12 w-12 object-contain p-1" />
            <Section title="Details">
              <Fact label="Status">
                <span className="inline-flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", statusDot(status))} />{status}</span>
              </Fact>
              <Fact label="Phone">{builder.phone}</Fact>
              <Fact label="Email">{builder.email}</Fact>
              <Fact label="Experience">{builder.experienceYears != null ? `${builder.experienceYears} years` : null}</Fact>
              <Fact label="Completed">{count(builder.completedProjects)}</Fact>
              <Fact label="Ongoing">{count(builder.ongoingProjects)}</Fact>
              <Fact label="Added">{formatTableDate(builder.createdAt)}</Fact>
            </Section>
          </>
        }
      >
        <div className="pb-6">
          <TabHeader title="Overview" />
          <div className="space-y-5 px-3 sm:px-10">
            <DataCard title="Company">
              <Fact label="Name">{builder.name}</Fact>
              <Fact label="Website">{link(builder.website, site)}</Fact>
              <Fact label="Slug">{builder.slug}</Fact>
              <Fact label="Updated">{formatTableDate(builder.updatedAt)}</Fact>
            </DataCard>
            <DataCard title="Contact">
              <Fact label="Phone">{builder.phone ? <a href={`tel:${builder.phone}`} className="hover:underline">{builder.phone}</a> : null}</Fact>
              <Fact label="Email">{builder.email ? link(`mailto:${builder.email}`, builder.email) : null}</Fact>
            </DataCard>
            <DataCard title="Track record">
              <Fact label="Experience">{builder.experienceYears != null ? `${builder.experienceYears} years` : null}</Fact>
              <Fact label="Completed">{count(builder.completedProjects)}</Fact>
              <Fact label="Ongoing">{count(builder.ongoingProjects)}</Fact>
            </DataCard>
            <DataCard title="About" columns={false}>
              {builder.description ? (
                <p className="whitespace-pre-line px-2 py-2 text-[14px] leading-6 text-foreground">{builder.description}</p>
              ) : (
                <p className="px-2 py-2 text-[14px] text-muted-foreground">No description yet.</p>
              )}
            </DataCard>
          </div>
        </div>
      </RecordPage>

      {editing && (
        <BuilderForm
          mode="edit"
          initial={builder}
          onClose={() => setEditing(false)}
          onSuccess={() => {
            setEditing(false);
            void load().then((data) => { if (data) setBuilder(data); });
          }}
        />
      )}
    </>
  );
}
