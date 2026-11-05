"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Database, History, Info, Loader2, MessagesSquare } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/api-fetch";
import { sortContactLogs } from "@/lib/contact-log-utils";
import {
  AGENT_CATEGORIES, AGENT_STATUSES, AGENT_STATUS_TONES, COMMISSION_TYPES, PARTNER_TYPES, commissionKind, commissionText, partnerTypeLabel,
} from "@/lib/agent-form";
import { INDIAN_STATES, inboundErrorMessage } from "@/lib/inbound-form";
import { statusDot, statusPillClass } from "@/components/tables/cells";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileHeader } from "@/components/layout/mobile-header";
import { PageActions } from "@/components/layout/page-actions";
import { FieldRow, InlineSelect, InlineText, Section, type Option } from "@/components/record/inline-field";
import { Avatar, Feed, TabHeader } from "@/components/record/feed";
import { type Person } from "@/components/record/assignee-picker";
import { AssigneeButton, StatusMenu, type StatusOption } from "@/components/record/header-actions";
import { activityItems, type ActivityEntry } from "@/components/record/activity";
import { AGENT_ACTIVITY } from "@/components/agents/agent-activity";
import { AGENT_ENTITY, LeadConversation } from "@/components/record/conversation";
import { FollowUpComposer } from "@/components/record/follow-up-composer";
import { AttachmentsArt, EmptyState } from "@/components/record/empty-state";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type Tab = "activity" | "conversation" | "data";
type Agent = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Patch = Record<string, unknown>;

const YES_NO: Option[] = [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }];


const agentCode = (a: Agent) => `AG${String(a.id).padStart(5, "0")}`;
/** A picker shows the current value even when it's no longer one of the options. */
const withCurrent = (options: Option[], value?: string | null) =>
  !value || options.some((o) => o.value === value) ? options : [{ label: value, value }, ...options];

function PageSkeleton() {
  return (
    <div className="flex flex-col md:h-full md:flex-row lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden h-11 items-center gap-5 border-b px-5 md:flex">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-4 w-20" />)}
        </div>
        <div className="space-y-6 p-4 md:p-10">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full max-w-lg rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden w-[340px] shrink-0 border-l md:block xl:w-[360px]">
        <div className="flex items-center gap-3 border-b p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
        </div>
        <div className="space-y-3 p-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }: {
  active: boolean; onClick: () => void; icon: typeof Info; label: string; count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-colors md:h-11 md:rounded-none md:px-0.5",
        active
          ? "bg-[#017D58] text-white dark:bg-[#2FB585] dark:text-black md:bg-transparent md:text-foreground md:dark:bg-transparent md:dark:text-foreground"
          : "bg-foreground/[0.06] text-foreground/80 md:bg-transparent md:text-muted-foreground md:hover:text-foreground",
      )}
    >
      <Icon className="hidden h-4 w-4 md:block" />
      {label}
      {count ? (
        <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums", active ? "bg-white/20 md:bg-foreground/[0.08]" : "bg-foreground/[0.08]")}>{count}</span>
      ) : null}
      {active && <span aria-hidden className="absolute inset-x-0 -bottom-px hidden h-0.5 rounded-full bg-foreground md:block" />}
    </button>
  );
}

/** One group of fields on the Data tab, two columns wide on desktop. */
function DataCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="@container overflow-hidden rounded-xl border bg-card">
      <h3 className="flex h-11 items-center border-b px-4 text-[14px] font-semibold text-foreground">{title}</h3>
      <div className="grid gap-x-8 px-3 py-2 @xl:grid-cols-2 md:px-4">{children}</div>
    </section>
  );
}

function AgentDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("activity");
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [mailRefresh, setMailRefresh] = useState(0);
  const [cities, setCities] = useState<Option[]>([]);
  const [staff, setStaff] = useState<{ canAssign: boolean; people: Person[] }>({ canAssign: false, people: [] });
  // Editing or deleting someone's follow-up is for admins, as on the lead page.
  const [isAdmin] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("crm_user") || "{}");
      return ["Admin", "Super Admin"].includes(u?.role?.name || u?.role);
    } catch { return false; }
  });

  const loadAgent = useCallback(async (): Promise<Agent | null> => {
    try {
      const res = await apiFetch(`${API_URL}/agents/${id}`);
      const result = await res.json();
      if (res.ok && result?.data?.id) return result.data;
      toast.error("Agent not found");
      router.push("/agent-network");
    } catch {
      toast.error("Failed to load the agent");
    }
    return null;
  }, [id, router]);
  const loadActivity = useCallback(
    () => apiJson<{ data?: ActivityEntry[] }>(`${API_URL}/agents/${id}/activity`).then((r) => r.data ?? [], () => []),
    [id],
  );
  const refreshActivity = useCallback(() => { void loadActivity().then(setActivity); }, [loadActivity]);
  const fetchAgent = useCallback(() => loadAgent().then((data) => { if (data) setAgent(data); }), [loadAgent]);

  useEffect(() => {
    let live = true;
    loadAgent().then((data) => {
      if (!live) return;
      if (data) setAgent(data);
      setIsLoading(false);
    });
    loadActivity().then((entries) => { if (live) setActivity(entries); });
    return () => { live = false; };
  }, [loadAgent, loadActivity]);

  useEffect(() => {
    let live = true;
    apiFetch(`${API_URL}/master/cities`).then((r) => r.json()).then((d) => { if (live && d.success) setCities(d.data); }).catch(() => {});
    apiJson<{ canAssign?: boolean; data?: Person[] }>(`${API_URL}/agents/staff-list`)
      .then((r) => { if (live) setStaff({ canAssign: !!r.canAssign, people: r.data ?? [] }); })
      .catch(() => {});
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

  /** Saves some fields in place and takes just those back from the reply. */
  const save = async (patch: Patch) => {
    try {
      const res = await apiFetch(`${API_URL}/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) throw new Error(inboundErrorMessage(result) || "Couldn't save the change");
      const saved = result.data ?? {};
      setAgent((prev) => prev && {
        ...prev,
        ...Object.fromEntries(Object.keys(patch).map((k) => [k, k in saved ? saved[k] : patch[k]])),
        updated_at: saved.updated_at ?? prev.updated_at,
      });
      toast.success("Saved");
      refreshActivity();
      if ("status" in patch) setMailRefresh((n) => n + 1); // a status change can draft an email
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't save the change");
      throw reason;
    }
  };
  const saveText = (key: string) => (v: string) => save({ [key]: v.trim() === "" ? null : v.trim() });
  /** For fields the agent can't be without (name, mobile). */
  const saveRequired = (key: string, what: string) => async (v: string) => {
    if (!v.trim()) {
      toast.error(`The ${what} can't be empty.`);
      throw new Error("required");
    }
    return save({ [key]: v.trim() });
  };

  const followUps = useMemo(() => agent?.follow_ups ?? [], [agent]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API rows, as on the lead page
  const contactLogs: any[] = useMemo(() => sortContactLogs(agent?.contact_logs ?? []), [agent]);
  const activityFeed = useMemo(() => activityItems(activity ?? [], AGENT_ACTIVITY), [activity]);

  if (isLoading) return <PageSkeleton />;
  if (!agent) return null;

  const status: string = agent.status || "New";
  const statusOptions: Option[] = [...(AGENT_STATUSES.includes(status) ? [] : [status]), ...AGENT_STATUSES]
    .map((s) => ({ label: s, value: s, dot: statusDot(s, AGENT_STATUS_TONES[s]) }));
  const assignee: string | undefined = staff.people.find((p) => p.id === agent.assigned_staff_id)?.name ?? agent.assigned_staff?.name;
  const subtitle = [agent.company_name, partnerTypeLabel(agent.partner_type)].filter(Boolean).join(" · ") || agentCode(agent);
  const added = new Date(agent.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

  const statusMenu = (size: "h-7" | "h-8", align: "start" | "end" = "end") => (
    <StatusMenu status={status} options={statusOptions as StatusOption[]} pillClass={statusPillClass(status, AGENT_STATUS_TONES[status])}
      onChange={(v) => void save({ status: v }).catch(() => {})} size={size} align={align} />
  );
  const assign = (staffId: number | null) =>
    save({ assigned_staff_id: staffId }).then(() => setAgent((prev) => prev && { ...prev, assigned_staff: staff.people.find((p) => p.id === staffId) ?? null }));
  const assigneeButton = (variant: "header" | "field" | "phone") => (
    <AssigneeButton name={assignee} variant={variant} people={staff.people} value={agent.assigned_staff_id} onPick={staff.canAssign ? assign : undefined} />
  );
  const assigneeField = <FieldRow label="Assigned to">{assigneeButton("field")}</FieldRow>;
  const fixedCommission = commissionKind(agent.commission_type) === "fixed_amount";
  const commissionField = agent.commission_accepted ? (
    <InlineText label={fixedCommission ? "Amount (₹)" : "Percentage"} value={agent.commission_value}
      placeholder={fixedCommission ? "50000" : "2"} inWords={fixedCommission} onSave={saveText("commission_value")} />
  ) : null;

  const summary = (
    <Section title="Details">
      <InlineSelect label="Status" value={status} options={statusOptions} onSave={(v) => save({ status: v })} />
      <InlineSelect label="Partner type" value={agent.partner_type} options={withCurrent(PARTNER_TYPES, agent.partner_type)} onSave={(v) => save({ partner_type: v })} />
      {assigneeField}
      <InlineText label="Mobile" type="tel" value={agent.mobile_number} onSave={saveRequired("mobile_number", "mobile number")} />
      <InlineSelect searchable label="City" value={agent.city} options={withCurrent(cities, agent.city)} onSave={(v) => save({ city: v })} />
      {agent.commission_accepted && (
        <FieldRow label="Commission"><span className="px-2 text-[14px] text-foreground">{commissionText(agent.commission_type, agent.commission_value) || "—"}</span></FieldRow>
      )}
      <FieldRow label="Added"><span className="px-2 text-[14px] text-foreground">{added}</span></FieldRow>
    </Section>
  );

  const data: ReactNode = (
    <div className="pb-6">
      <TabHeader title="Data" />
      <div className="space-y-5 px-3 sm:px-10">
        <DataCard title="Partner">
          <InlineText label="Name" value={agent.name} onSave={saveRequired("name", "name")} />
          <InlineText label="Company" value={agent.company_name} onSave={saveText("company_name")} />
          <InlineSelect label="Partner type" value={agent.partner_type} options={withCurrent(PARTNER_TYPES, agent.partner_type)} onSave={(v) => save({ partner_type: v })} />
          <InlineSelect label="Category" value={agent.property_category} options={withCurrent(AGENT_CATEGORIES, agent.property_category)} onSave={(v) => save({ property_category: v })} />
          <InlineSelect label="Status" value={status} options={statusOptions} onSave={(v) => save({ status: v })} />
          {assigneeField}
          <FieldRow label="Added"><span className="px-2 text-[14px] text-foreground">{added}</span></FieldRow>
        </DataCard>

        <DataCard title="Contact">
          <InlineText label="Mobile" type="tel" value={agent.mobile_number} onSave={saveRequired("mobile_number", "mobile number")} />
          <InlineText label="WhatsApp" type="tel" value={agent.whatsapp_number} onSave={saveText("whatsapp_number")} />
          <InlineText label="Email" type="email" value={agent.email} onSave={saveText("email")} />
          <InlineSelect searchable label="City" value={agent.city} options={withCurrent(cities, agent.city)} onSave={(v) => save({ city: v })} />
          <InlineSelect searchable label="State" value={agent.state} options={withCurrent(INDIAN_STATES, agent.state)} onSave={(v) => save({ state: v })} />
        </DataCard>

        <DataCard title="Commission">
          <InlineSelect label="On commission" value={agent.commission_accepted ? "yes" : "no"} options={YES_NO} onSave={(v) => save({ commission_accepted: v === "yes" })} />
          {agent.commission_accepted && (
            <InlineSelect label="Paid as" value={agent.commission_type} options={withCurrent(COMMISSION_TYPES, agent.commission_type)} onSave={(v) => save({ commission_type: v })} />
          )}
          {commissionField}
          <InlineText label="Remarks" multiline value={agent.remarks} placeholder="For the team only" onSave={saveText("remarks")} />
        </DataCard>
      </div>
    </div>
  );

  const tabs: { key: Tab; label: string; icon: typeof Info; count?: number }[] = [
    { key: "activity", label: "Activity", icon: History },
    { key: "conversation", label: "Conversation", icon: MessagesSquare, count: followUps.length + contactLogs.length },
    { key: "data", label: "Data", icon: Database },
  ];

  return (
    <div className="flex flex-col md:h-full lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]">
      <MobileHeader title={agent.name} showBack />

      <PageActions>
        <div className="flex items-center gap-2">
          {statusMenu("h-8")}
          {assigneeButton("header")}
        </div>
      </PageActions>

      {/* ── Phone summary ── */}
      <div className="space-y-3 px-4 pb-4 pt-1 md:hidden">
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
          {statusMenu("h-7", "start")}
          <span className="truncate">{subtitle}</span>
        </div>
        {assigneeButton("phone")}
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
          <div role="tablist" aria-label="Agent sections"
            className="sticky top-[calc(env(safe-area-inset-top)+2.75rem)] z-20 flex shrink-0 gap-1.5 overflow-x-auto bg-background px-4 py-2 scrollbar-hide md:static md:gap-5 md:border-b md:px-5 md:py-0">
            {tabs.map((t) => (
              <TabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} icon={t.icon} label={t.label} count={t.count} />
            ))}
          </div>

          <div className={cn("md:min-h-0 md:flex-1", activeTab === "conversation" ? "md:flex md:flex-col" : "md:overflow-y-auto")}>
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
              <LeadConversation
                leadId={agent.id}
                leadName={agent.name}
                entity={AGENT_ENTITY}
                email={agent.email}
                mobile={agent.mobile_number}
                whatsapp={agent.whatsapp_number}
                followUps={followUps}
                contactLogs={contactLogs}
                composer={<FollowUpComposer api="agents" entityId={agent.id} noun="partner" followUps={followUps} onSaved={() => fetchAgent()} />}
                canEdit
                isAdmin={isAdmin}
                refreshKey={mailRefresh}
                onRefresh={() => fetchAgent()}
              />
            )}
            {activeTab === "data" && data}
          </div>
        </div>

        <aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto border-l md:flex xl:w-[360px]">
          <div className="flex items-center gap-3 border-b p-4">
            <Avatar name={agent.name} className="h-12 w-12 text-[15px]" />
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold leading-6 text-foreground" title={agent.name}>{agent.name}</p>
              <p className="truncate text-[13px] text-muted-foreground" title={subtitle}>{subtitle}</p>
            </div>
          </div>
          {summary}
          <p className="mt-auto hidden items-center gap-1.5 px-4 py-3 text-[12px] text-muted-foreground md:flex">
            Press <kbd className="rounded border px-1 font-mono text-[11px]">A</kbd> to switch between activity and conversation.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default function AgentViewPage() {
  return <AgentDetail />;
}
