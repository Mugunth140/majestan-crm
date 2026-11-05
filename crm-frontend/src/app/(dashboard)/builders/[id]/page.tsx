"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, ExternalLink, Loader2, Upload } from "lucide-react";
import { FieldRow, InlineText, Section } from "@/components/record/inline-field";
import { TabHeader } from "@/components/record/feed";
import { HEADER_BUTTON, StatusMenu } from "@/components/record/header-actions";
import { DataCard, Fact, RecordPage, RecordSkeleton, RecordSummary } from "@/components/record/record-page";
import { formatTableDate, statusDot, statusPillClass } from "@/components/tables/cells";
import { buildersApi, type BuilderRecord } from "@/lib/builders-api";
import { propertiesApi } from "@/lib/properties-api";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["Active", "Inactive"].map((s) => ({ value: s, dot: statusDot(s) }));
const count = (n?: number | null) => (n == null ? null : n.toLocaleString("en-IN"));
type Patch = Partial<Omit<BuilderRecord, "id">>;

/** The builder's logo with a button that uploads a new one. */
function LogoField({ src, onSave }: { src?: string; onSave: (key: string) => Promise<unknown> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return void toast.error("File size must be under 5MB");
    setBusy(true);
    try {
      const res = await propertiesApi.uploadImages([file]);
      const key = res?.data?.[0]?.imageKey;
      if (!res?.success || !key) throw new Error("Failed to upload logo image");
      await onSave(key);
    } catch (reason) {
      toast.error(reason instanceof Error && reason.message ? reason.message : "Failed to upload logo image");
    } finally {
      setBusy(false);
    }
  };
  return (
    <FieldRow label="Logo">
      <div className="flex items-center gap-3 px-2 py-1">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN logo
          <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-md border bg-muted object-contain p-0.5" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-foreground/[0.06] text-muted-foreground"><Building2 className="h-4 w-4" /></span>
        )}
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.05] disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy ? "Uploading…" : src ? "Replace" : "Upload"}
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; void upload(file); }} />
      </div>
    </FieldRow>
  );
}

export default function BuilderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [builder, setBuilder] = useState<BuilderRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  /** Saves one change; a failure shows why and rethrows so the field goes back. */
  const save = async (patch: Patch) => {
    try {
      const result = await buildersApi.update(Number(id), patch);
      if (result && result.success === false) throw new Error(result.message);
      const saved = (result?.data ?? null) as BuilderRecord | null;
      setBuilder((prev) => prev && (saved?.id ? { ...prev, ...saved } : { ...prev, ...patch }));
    } catch (reason) {
      toast.error(reason instanceof Error && reason.message ? reason.message : "Couldn't save the change");
      throw reason;
    }
  };
  const saveText = (key: "phone" | "email" | "website" | "description") => (v: string) =>
    // The site API skips nulls on validation, so an emptied field clears.
    save({ [key]: v.trim() === "" ? null : v.trim() } as Patch);
  const saveCount = (key: "experienceYears" | "completedProjects" | "ongoingProjects") => async (v: string) => {
    const n = v.trim() === "" ? (key === "experienceYears" ? null : 0) : Number(v);
    if (n != null && (!Number.isInteger(n) || n < 0)) {
      toast.error("Enter a whole number, 0 or more");
      throw new Error("invalid");
    }
    await save({ [key]: n } as Patch);
  };
  const saveName = async (v: string) => {
    if (!v.trim()) {
      toast.error("Builder name is required");
      throw new Error("required");
    }
    await save({ name: v.trim() });
  };

  const changeStatus = async (next: string) => {
    try {
      await save({ isActive: next === "Active" });
      toast.success(`Marked ${next.toLowerCase()}`);
    } catch { /* save already said why */ }
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
          </>
        }
        phone={
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
            {statusMenu("h-7", "start")}
            {builder.phone && <span>{builder.phone}</span>}
          </div>
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
              <InlineText label="Name" value={builder.name} onSave={saveName} />
              <InlineText label="Website" type="url" value={builder.website} placeholder="https://example.com" onSave={saveText("website")} />
              <LogoField src={builder.logoUrl} onSave={(logoUrl) => save({ logoUrl })} />
              <Fact label="Slug">{builder.slug}</Fact>
              <Fact label="Updated">{formatTableDate(builder.updatedAt)}</Fact>
            </DataCard>
            <DataCard title="Contact">
              <InlineText label="Phone" type="tel" value={builder.phone} placeholder="+91 98765 43210" onSave={saveText("phone")} />
              <InlineText label="Email" type="email" value={builder.email} placeholder="contact@builder.com" onSave={saveText("email")} />
            </DataCard>
            <DataCard title="Track record">
              <InlineText label="Experience (yrs)" type="number" value={builder.experienceYears} placeholder="e.g. 15" onSave={saveCount("experienceYears")} />
              <InlineText label="Completed" type="number" value={builder.completedProjects} placeholder="e.g. 24" onSave={saveCount("completedProjects")} />
              <InlineText label="Ongoing" type="number" value={builder.ongoingProjects} placeholder="e.g. 3" onSave={saveCount("ongoingProjects")} />
            </DataCard>
            <DataCard title="About" columns={false}>
              <InlineText label="Description" multiline value={builder.description} placeholder="Company background, history, philosophy…" onSave={saveText("description")} />
            </DataCard>
          </div>
        </div>
      </RecordPage>

    </>
  );
}
