"use client";

import { CompletenessRing } from "@/components/record/score-ring";
import { candidateScoreFields } from "@/lib/record-score";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Database, Download, FileText, History, Loader2, MessagesSquare, Upload } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/api-fetch";
import { sortContactLogs } from "@/lib/contact-log-utils";
import { HR_STATUS_TONES } from "@/lib/hr-status";
import { HR_DEPARTMENTS, HR_STATUSES, hrSourceOptions, loadHrStates } from "@/lib/hr-candidate-options";
import { loadHrMasters, type HrSource } from "@/lib/hr-import";
import { INTERVIEW_MODE_OPTIONS, toTimeInput } from "@/lib/hr-interview";
import { downloadHrDocument, isHrDocumentAvailable, HR_DOCUMENT_ACCEPT } from "@/lib/hr-documents";
import { toHrFollowUpPayload } from "@/lib/hr-follow-up";
import { isAdmin as isAdminUser } from "@/lib/permissions";
import { statusDot, statusPillClass } from "@/components/tables/cells";
import { FieldRow, InlineSelect, InlineText, Section, type Option } from "@/components/record/inline-field";
import { Feed, TabHeader } from "@/components/record/feed";
import { type Person } from "@/components/record/assignee-picker";
import { AssigneeButton, StatusMenu, type StatusOption } from "@/components/record/header-actions";
import { activityItems, type ActivityEntry } from "@/components/record/activity";
import { HR_ACTIVITY, HR_DOCUMENT_LABELS } from "@/components/hr/hr-activity";
import { HR_ENTITY, LeadConversation } from "@/components/record/conversation";
import { FollowUpComposer } from "@/components/record/follow-up-composer";
import { AttachmentsArt, EmptyState } from "@/components/record/empty-state";
import { DataCard, RecordPage, RecordSkeleton, type RecordTab } from "@/components/record/record-page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type Tab = "activity" | "conversation" | "data" | "documents";
type Candidate = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Patch = Record<string, unknown>;

/** Joined candidates also hand in their ID and certificates. */
const JOINING_DOCUMENTS = ["aadhaar", "pan", "educationCert", "experienceCert", "photo"] as const;
const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

const candidateCode = (c: Candidate) => "HRC" + String(c.id).padStart(4, "0");
/** A picker shows the current value even when it's no longer one of the options. */
const withCurrent = (options: Option[], value?: string | null) =>
  !value || options.some((o) => o.value === value) ? options : [{ label: value, value }, ...options];
const errorText = (result: { message?: string | string[] } | null) =>
  Array.isArray(result?.message) ? result.message.join(", ") : result?.message;

function DocumentRow({ label, reference, accept, uploading, disabled, onUpload, onDownload }: {
  label: string;
  reference?: string | null;
  accept: string;
  uploading: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
  onDownload: () => void;
}) {
  const uploaded = isHrDocumentAvailable(reference);
  return (
    <div className="flex min-h-14 items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", uploaded ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-foreground/[0.06] text-muted-foreground")}>
        {uploaded ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-foreground">{label}</p>
        <p className="text-[13px] text-muted-foreground">{uploaded ? "Uploaded" : "Not uploaded yet"}</p>
      </div>
      {uploaded ? (
        <Button variant="outline" size="sm" onClick={onDownload}><Download className="h-3.5 w-3.5" /> Download</Button>
      ) : (
        <label className={cn("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted", disabled && "pointer-events-none opacity-50")}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : "Upload"}
          <input type="file" accept={accept} className="hidden" disabled={disabled}
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) onUpload(file); }} />
        </label>
      )}
    </div>
  );
}

export default function HrDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("activity");
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [mailRefresh, setMailRefresh] = useState(0);
  const [sources, setSources] = useState<HrSource[]>([]);
  const [states, setStates] = useState<Option[]>([]);
  // HR staff to assign to, loaded when the picker first opens.
  const [staff, setStaff] = useState<Person[] | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [role] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("crm_user") || "{}");
      return (u?.role?.name || u?.role || "") as string;
    } catch { return ""; }
  });
  const canAssign = ["Super Admin", "Admin", "Manager", "Team Lead"].includes(role);
  // Editing or deleting someone's follow-up is for admins, as on the lead page.
  const isAdmin = isAdminUser({ role });

  const loadCandidate = useCallback(async (): Promise<Candidate | null> => {
    try {
      const data = await apiJson<Candidate>(`${API_URL}/hr/${id}`);
      if (data?.id) return data;
      toast.error("Candidate not found");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Failed to load the candidate");
    }
    router.push("/hr");
    return null;
  }, [id, router]);
  const loadActivity = useCallback(
    () => apiJson<{ data?: ActivityEntry[] }>(`${API_URL}/hr/${id}/activity`).then((r) => r.data ?? [], () => []),
    [id],
  );
  const refreshActivity = useCallback(() => { void loadActivity().then(setActivity); }, [loadActivity]);
  const fetchCandidate = useCallback(() => loadCandidate().then((data) => { if (data) setCandidate(data); }), [loadCandidate]);

  useEffect(() => {
    let live = true;
    loadCandidate().then((data) => {
      if (!live) return;
      if (data) setCandidate(data);
      setIsLoading(false);
    });
    loadActivity().then((entries) => { if (live) setActivity(entries); });
    return () => { live = false; };
  }, [loadCandidate, loadActivity]);

  useEffect(() => {
    let live = true;
    loadHrMasters().then((m) => { if (live) setSources(m.sources); }, () => {});
    loadHrStates().then((s) => { if (live) setStates(s.map((v) => ({ label: v, value: v }))); }, () => {});
    return () => { live = false; };
  }, []);

  // A switches between Activity and Conversation, as on the lead page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (e.key.toLowerCase() === "a" && !e.metaKey && !e.ctrlKey && !e.altKey && el?.tagName !== "INPUT" && el?.tagName !== "TEXTAREA" && !el?.isContentEditable) {
        e.preventDefault();
        setActiveTab((prev) => (prev === "conversation" ? "activity" : "conversation"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const loadStaff = () => {
    if (staff) return;
    loadHrMasters()
      .then((m) => setStaff(m.staff.map((p) => ({ id: p.id, name: p.name, hint: p.department?.name }))))
      .catch(() => { setStaff([]); toast.error("Could not load HR staff."); });
  };

  /** Saves some fields in place; the reply is the whole candidate. */
  const save = async (patch: Patch) => {
    try {
      const res = await apiFetch(`${API_URL}/hr/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.id) throw new Error(errorText(result) || "Couldn't save the change");
      setCandidate(result);
      toast.success("Saved");
      refreshActivity();
      // A status change or a moved interview can draft an email.
      if (Object.keys(patch).some((k) => k === "status" || k.startsWith("interview"))) setMailRefresh((n) => n + 1);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't save the change");
      throw reason;
    }
  };
  const saveText = (key: string) => (v: string) => save({ [key]: v.trim() === "" ? null : v.trim() });
  /** For fields a candidate can't be without (name, mobile, position). */
  const saveRequired = (key: string, what: string) => async (v: string) => {
    if (!v.trim()) {
      toast.error(`The ${what} can't be empty.`);
      throw new Error("required");
    }
    return save({ [key]: v.trim() });
  };

  const assign = async (staffId: number | null) => {
    try {
      await apiJson(`${API_URL}/hr/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateIds: [Number(id)], assignedStaffId: staffId }) });
      toast.success("Candidate assignment updated.");
      await fetchCandidate();
      refreshActivity();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Assignment failed");
      throw reason;
    }
  };

  const upload = async (docType: string, file: File) => {
    if (uploadingDoc) return;
    if (file.size > 10 * 1024 * 1024) return void toast.error("Document must be 10 MB or smaller.");
    const form = new FormData();
    form.append("file", file);
    setUploadingDoc(docType);
    try {
      const result = await apiJson<{ success?: boolean; message?: string }>(`${API_URL}/hr/${id}/upload/${docType}`, { method: "POST", body: form });
      if (result?.success === false) throw new Error(result.message || "Upload failed.");
      toast.success("Document uploaded.");
      await fetchCandidate();
      refreshActivity();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not upload document.");
    } finally {
      setUploadingDoc(null);
    }
  };
  const download = async (docType: string, reference: string) => {
    try {
      if (reference.startsWith("hr-private://")) await downloadHrDocument(API_URL, id, docType);
      else if (isHrDocumentAvailable(reference)) window.open(reference, "_blank", "noopener,noreferrer");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not download document.");
    }
  };

  const followUps = useMemo(() => candidate?.follow_ups ?? [], [candidate]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API rows, as on the lead page
  const contactLogs: any[] = useMemo(() => sortContactLogs(candidate?.contact_logs ?? []), [candidate]);
  const activityFeed = useMemo(() => activityItems(activity ?? [], HR_ACTIVITY), [activity]);

  if (isLoading) return <RecordSkeleton title="Candidate" />;
  if (!candidate) return null;

  const c = candidate;
  const status: string = c.status || "New Application";
  const statusOptions: Option[] = [...(HR_STATUSES.includes(status) ? [] : [status]), ...HR_STATUSES]
    .map((s) => ({ label: s, value: s, dot: statusDot(s, HR_STATUS_TONES[s]) }));
  const source = hrSourceOptions(sources, { hrSourceId: c.hrSourceId != null ? String(c.hrSourceId) : "", recruitmentSource: c.recruitmentSource || "" });
  const subtitle = [c.position, c.department].filter(Boolean).join(" · ") || candidateCode(c);
  const added = new Date(c.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const documentTypes = ["resume", ...(status === "Joined" ? JOINING_DOCUMENTS : [])];

  const statusMenu = (size: "h-7" | "h-8", align: "start" | "end" = "end") => (
    <StatusMenu status={status} options={statusOptions as StatusOption[]} pillClass={statusPillClass(status, HR_STATUS_TONES[status])}
      onChange={(v) => void save({ status: v }).catch(() => {})} size={size} align={align} />
  );
  const assigneeButton = (variant: "header" | "field" | "phone") => (
    <AssigneeButton name={c.assignedStaff?.name} variant={variant} people={staff ?? []} value={c.assignedStaff?.id ?? c.assignedStaffId}
      onPick={canAssign ? assign : undefined} loading={staff === null} onOpen={loadStaff} />
  );
  const sourceField = (
    <InlineSelect label="HR source" value={source.value} options={source.options}
      onSave={(v) => (/^\d+$/.test(v) ? save({ hrSourceId: Number(v) }) : undefined)} />
  );
  const fact = (label: string, value: ReactNode) => (
    <FieldRow label={label}><span className="px-2 text-[14px] text-foreground">{value}</span></FieldRow>
  );

  const summary = (
    <Section title="Details">
      <InlineSelect label="Status" value={status} options={statusOptions} onSave={(v) => save({ status: v })} />
      <FieldRow label="Assigned to">{assigneeButton("field")}</FieldRow>
      <InlineText label="Mobile" type="tel" value={c.mobile} onSave={saveRequired("mobile", "mobile number")} />
      <InlineText label="Email" type="email" value={c.email} onSave={saveText("email")} />
      <InlineText label="Position" value={c.position} onSave={saveRequired("position", "position")} />
      {sourceField}
      {fact("Added", added)}
    </Section>
  );

  const data: ReactNode = (
    <div className="pb-6">
      <TabHeader title="Data" />
      <div className="space-y-5 px-3 sm:px-10">
        <DataCard title="Candidate">
          <InlineText label="Name" value={c.name} onSave={saveRequired("name", "name")} />
          <InlineText label="Mobile" type="tel" value={c.mobile} onSave={saveRequired("mobile", "mobile number")} />
          <InlineText label="WhatsApp" type="tel" value={c.whatsapp} onSave={saveText("whatsapp")} />
          <InlineText label="Email" type="email" value={c.email} onSave={saveText("email")} />
          <InlineText label="City" value={c.city} onSave={saveText("city")} />
          <InlineSelect searchable label="State" value={c.state} options={withCurrent(states, c.state)} onSave={(v) => save({ state: v })} />
        </DataCard>

        <DataCard title="Job">
          <InlineSelect label="Department" value={c.department} options={withCurrent(HR_DEPARTMENTS, c.department)} onSave={(v) => save({ department: v })} />
          <InlineText label="Position" value={c.position} onSave={saveRequired("position", "position")} />
          <InlineText label="Experience" value={c.experience} placeholder="e.g. 2 years" onSave={saveText("experience")} />
          <InlineText label="Notice period" value={c.noticePeriod} placeholder="e.g. 30 days" onSave={saveText("noticePeriod")} />
          <InlineText label="Current CTC" value={c.currentSalary} placeholder="e.g. 3 LPA" onSave={saveText("currentSalary")} />
          <InlineText label="Expected CTC" value={c.expectedSalary} placeholder="e.g. 4 LPA" onSave={saveText("expectedSalary")} />
        </DataCard>

        <DataCard title="Recruitment">
          <InlineSelect label="Status" value={status} options={statusOptions} onSave={(v) => save({ status: v })} />
          <FieldRow label="Assigned to">{assigneeButton("field")}</FieldRow>
          {sourceField}
          {fact("Added", added)}
        </DataCard>

        <DataCard title="Interview">
          <InlineText label="Date" type="date" value={c.interviewDate ? String(c.interviewDate).slice(0, 10) : ""} onSave={(v) => save({ interviewDate: v || null })} />
          <InlineText label="Time (IST)" type="time" value={toTimeInput(c.interviewTime)} onSave={(v) => save({ interviewTime: v || null })} />
          <InlineSelect label="Mode" value={c.interviewMode} options={INTERVIEW_MODE_OPTIONS} onSave={(v) => save({ interviewMode: v })} />
          {c.interviewMode === "in_person" && <InlineText label="Venue" value={c.interviewLocation} onSave={saveText("interviewLocation")} />}
          {c.interviewMode === "video" && <InlineText label="Meeting link" type="url" value={c.interviewLink} placeholder="https://meet.google.com/…" onSave={saveText("interviewLink")} />}
          <InlineText label="Interviewer" value={c.interviewer} onSave={saveText("interviewer")} />
          <InlineText label="Round" value={c.interviewRound} placeholder="e.g. Round 1 / Final" onSave={saveText("interviewRound")} />
          <InlineText label="Feedback" multiline value={c.interviewFeedback} placeholder="How did it go?" onSave={saveText("interviewFeedback")} />
        </DataCard>
      </div>
    </div>
  );

  const documents: ReactNode = (
    <div className="pb-6">
      <TabHeader title="Documents" />
      <div className="space-y-3 px-3 sm:px-10">
        <section className="overflow-hidden rounded-xl border bg-card">
          {documentTypes.map((type) => (
            <DocumentRow key={type} label={HR_DOCUMENT_LABELS[type]} reference={c[`${type}Url`]} accept={type === "photo" ? PHOTO_ACCEPT : HR_DOCUMENT_ACCEPT}
              uploading={uploadingDoc === type} disabled={uploadingDoc !== null}
              onUpload={(file) => void upload(type, file)} onDownload={() => void download(type, c[`${type}Url`])} />
          ))}
        </section>
        <p className="px-1 text-[13px] text-muted-foreground">
          PDF, JPEG, PNG or WebP, up to 10 MB. Passport photos must be images.
          {status !== "Joined" && " ID and certificates are asked for once the candidate has joined."}
        </p>
      </div>
    </div>
  );

  const uploadedCount = documentTypes.filter((t) => isHrDocumentAvailable(c[`${t}Url`])).length;
  const tabs: RecordTab<Tab>[] = [
    { key: "activity", label: "Activity", icon: History },
    { key: "conversation", label: "Conversation", icon: MessagesSquare, count: followUps.length + contactLogs.length },
    { key: "data", label: "Data", icon: Database },
    { key: "documents", label: "Documents", icon: FileText, count: uploadedCount },
  ];

  return (
    <RecordPage
      title={c.name}
      tabs={tabs}
      active={activeTab}
      onTab={setActiveTab}
      actions={<>{statusMenu("h-8")}{assigneeButton("header")}</>}
      phone={
        <>
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
            {statusMenu("h-7", "start")}
            <span className="truncate">{subtitle}</span>
          </div>
          {assigneeButton("phone")}
        </>
      }
      aside={
        <>
          <div className="flex items-center gap-3 border-b p-4">
            <CompletenessRing fields={candidateScoreFields(c)} />
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold leading-6 text-foreground" title={c.name}>{c.name}</p>
              <p className="truncate text-[13px] text-muted-foreground" title={subtitle}>{subtitle}</p>
            </div>
          </div>
          {summary}
          <p className="mt-auto hidden items-center gap-1.5 px-4 py-3 text-[12px] text-muted-foreground md:flex">
            Press <kbd className="rounded border px-1 font-mono text-[11px]">A</kbd> to switch between activity and conversation.
          </p>
        </>
      }
    >
      {activeTab === "activity" && (
        <div className="pb-4">
          <TabHeader title="Activity" />
          {activity === null ? (
            <p className="flex items-center gap-2 px-3 text-[13px] text-muted-foreground sm:px-10"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</p>
          ) : activityFeed.length ? (
            <Feed items={activityFeed} />
          ) : (
            <EmptyState art={<AttachmentsArt />} title="Nothing recorded yet" hint="Status changes, edits and assignments will show up here." />
          )}
        </div>
      )}
      {activeTab === "conversation" && (
        <div className="md:flex md:h-full md:flex-col">
          <LeadConversation
            leadId={c.id}
            leadName={c.name}
            entity={HR_ENTITY}
            email={c.email}
            mobile={c.mobile}
            whatsapp={c.whatsapp}
            followUps={followUps}
            contactLogs={contactLogs}
            composer={<FollowUpComposer api="hr" entityId={c.id} noun="candidate" followUps={followUps} toBody={toHrFollowUpPayload} onSaved={() => void fetchCandidate()} />}
            canEdit
            isAdmin={isAdmin}
            refreshKey={mailRefresh}
            onRefresh={() => void fetchCandidate()}
          />
        </div>
      )}
      {activeTab === "data" && data}
      {activeTab === "documents" && documents}
    </RecordPage>
  );
}
