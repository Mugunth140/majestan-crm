"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, MessageCircle, Phone, Smartphone } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect, SearchableFormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { PriceInput } from "@/components/shared/price-input";
import {
  FieldRow, FOCUS_BUTTON, FOCUS_FIELD, FocusField, FocusModal, FocusSection, ToggleCard, fieldName, stepStatus,
} from "@/components/shared/focus-modal";
import {
  AGENT_CATEGORIES, AGENT_STEPS, COMMISSION_TYPES, EMPTY_AGENT, PARTNER_TYPES, agentPayload, checkAgent,
  type AgentForm, type AgentStep,
} from "@/lib/agent-form";
import { INDIAN_STATES, inboundErrorMessage } from "@/lib/inbound-form";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const SELECT = cn(FOCUS_FIELD, "h-9! rounded-md! border-border! text-[14px]!");
const INPUT = cn(FOCUS_FIELD, "h-9");
const AREA = cn(FOCUS_FIELD, "min-h-16 resize-y py-2");

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];
const CONTACTED_VIA = [
  { label: "Call", value: "call", icon: Phone },
  { label: "WhatsApp", value: "whatsapp", icon: MessageCircle },
  { label: "SMS", value: "sms", icon: Smartphone },
  { label: "Email", value: "email", icon: Mail },
];

/**
 * Adding an agent (a channel partner): who they are, how to reach them, the
 * commission agreed and, optionally, the first conversation with them.
 */
export function NewAgentModal({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The new agent's id, or the existing one's when the mobile was already in the network. */
  onCreated?: (id: number | null) => void;
}) {
  const [form, setForm] = useState<AgentForm>(EMPTY_AGENT);
  const [active, setActive] = useState<AgentStep>("partner");
  const [visited, setVisited] = useState<Set<AgentStep>>(() => new Set(["partner"]));
  const [showErrors, setShowErrors] = useState<Set<AgentStep>>(() => new Set());
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [cities, setCities] = useState<{ label: string; value: string }[] | null>(null);
  // The partner who already has a mobile, found when leaving the Contact step.
  const [taken, setTaken] = useState<{ mobile: string; name: string; existingStaff: string } | null>(null);
  const [checking, setChecking] = useState(false);

  // Fresh form each time it opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(EMPTY_AGENT);
      setActive("partner");
      setVisited(new Set(["partner"]));
      setShowErrors(new Set());
      setTouched(new Set());
      setTaken(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    let live = true;
    apiFetch(`${API_URL}/master/cities`)
      .then((r) => r.json())
      .then((d) => { if (live) setCities(d.success ? d.data : []); })
      .catch(() => { if (live) { setCities([]); toast.error("Couldn't load cities."); } });
    return () => { live = false; };
  }, [open]);

  const set = <K extends keyof AgentForm>(key: K, value: AgentForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const mobileTaken = taken && taken.mobile === form.mobile.trim()
    ? `${taken.name} already has this number (with ${taken.existingStaff}). Use a different number.`
    : null;
  const valid = (step: AgentStep) => Object.keys(checkAgent(step, form)).length === 0 && !(step === "contact" && mobileTaken);
  const allErrors = checkAgent(active, form);
  const errors = showErrors.has(active) ? allErrors : Object.fromEntries(Object.entries(allErrors).filter(([k]) => touched.has(k)));
  const ready = valid(active);
  const index = AGENT_STEPS.findIndex((s) => s.key === active);
  const last = index === AGENT_STEPS.length - 1;

  const steps = useMemo(
    () => AGENT_STEPS.map((s, i) => ({ ...s, status: stepStatus(i, index, visited.has(s.key) && Object.keys(checkAgent(s.key, form)).length === 0 && !(s.key === "contact" && mobileTaken)) })),
    [index, visited, form, mobileTaken],
  );
  const CONTACT = AGENT_STEPS.findIndex((s) => s.key === "contact");

  /** False, and the Contact step shown with the reason, when another partner already has this mobile. */
  const mobileFree = async () => {
    const mobile = form.mobile.trim();
    setChecking(true);
    try {
      const res = await apiFetch(`${API_URL}/agents/mobile-check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile }) });
      const result = await res.json().catch(() => null);
      if (result?.success && result.data) {
        setTaken({ mobile, name: result.data.name, existingStaff: result.data.existingStaff });
        flag("contact");
        go("contact");
        return false;
      }
    } catch { /* the save still refuses to make a second partner with this mobile */ }
    finally { setChecking(false); }
    return true;
  };

  const go = (key: AgentStep) => {
    setActive(key);
    setVisited((v) => new Set(v).add(key));
  };
  const flag = (key: AgentStep) => setShowErrors((s) => new Set(s).add(key));
  const jump = (key: AgentStep) => {
    const target = AGENT_STEPS.findIndex((s) => s.key === key);
    const blocked = AGENT_STEPS.slice(0, target).find((s) => !valid(s.key));
    if (blocked && target > index) {
      flag(blocked.key);
      go(blocked.key);
      return;
    }
    if (index <= CONTACT && target > CONTACT) return void mobileFree().then((free) => { if (free) go(key); });
    go(key);
  };
  const next = async () => {
    if (!valid(active)) return flag(active);
    if (active === "contact" && !(await mobileFree())) return;
    if (!last) go(AGENT_STEPS[index + 1].key);
    else void submit();
  };

  const submit = async () => {
    const invalid = AGENT_STEPS.find((s) => !valid(s.key));
    if (invalid) {
      flag(invalid.key);
      go(invalid.key);
      return;
    }
    if (!(await mobileFree())) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentPayload(form)),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) throw new Error(inboundErrorMessage(result) || "Couldn't save the agent");
      const id: number | null = result.data?.id ?? null;
      if (result.isExistingAgent) {
        toast.info(`${result.data?.name ?? "This partner"} is already in the network (with ${result.existingStaff ?? "nobody"}).`, {
          description: form.contactedVia ? "Your follow-up was added to them." : undefined,
        });
      } else {
        toast.success("Agent added.");
      }
      onOpenChange(false);
      onCreated?.(id);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't save the agent");
    } finally {
      setSubmitting(false);
    }
  };

  const loading = <div className={cn(INPUT, "flex items-center border")}><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;

  let body: React.ReactNode;
  if (active === "partner") {
    body = (
      <FocusSection title="Partner" description="Who they are and what they deal in.">
        <FieldRow>
          <FocusField required name="name" label="Name" htmlFor="na-name" error={errors.name}>
            <Input id="na-name" autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ravi Kumar" className={INPUT} />
          </FocusField>
          <FocusField name="company_name" label="Company" htmlFor="na-company" optional>
            <Input id="na-company" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Kumar Realty" className={INPUT} />
          </FocusField>
        </FieldRow>
        <FieldRow>
          <FocusField required name="partner_type" label="Partner type" error={errors.partner_type}>
            <FormSelect name="partner_type" placeholder="Select" className={SELECT} value={form.partner_type || null} options={PARTNER_TYPES} onValueChange={(v) => set("partner_type", v)} />
          </FocusField>
          <FocusField label="Property category" optional>
            <FormSelect name="property_category" placeholder="Select" className={SELECT} value={form.property_category || null} options={AGENT_CATEGORIES} onValueChange={(v) => set("property_category", v)} />
          </FocusField>
        </FieldRow>
      </FocusSection>
    );
  } else if (active === "contact") {
    body = (
      <FocusSection title="Contact" description="How to reach them. The mobile number identifies the partner, so it can't repeat.">
        <FieldRow>
          <FocusField required name="mobile" label="Mobile" htmlFor="na-mobile" error={errors.mobile ?? (showErrors.has("contact") ? mobileTaken : null)}>
            <Input id="na-mobile" type="tel" inputMode="tel" autoFocus value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="+91 98765 43210" className={INPUT} />
          </FocusField>
          <FocusField name="whatsapp" label="WhatsApp" htmlFor="na-whatsapp" optional error={errors.whatsapp}
            hint={form.mobile.trim() && !form.whatsapp ? <button type="button" onClick={() => set("whatsapp", form.mobile)} className="font-medium text-foreground hover:underline">Same as mobile</button> : undefined}>
            <Input id="na-whatsapp" type="tel" inputMode="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} className={INPUT} />
          </FocusField>
        </FieldRow>
        <FocusField name="email" label="Email" htmlFor="na-email" optional error={errors.email}>
          <Input id="na-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="ravi@kumarrealty.in" className={INPUT} />
        </FocusField>
        <FieldRow>
          <FocusField required name="city" label="City" error={errors.city}>
            {cities === null ? loading : (
              <SearchableFormSelect name="city" placeholder="Select" searchPlaceholder="Search cities…" className={SELECT} value={form.city || null} options={cities} onValueChange={(v) => set("city", v)} />
            )}
          </FocusField>
          <FocusField label="State" optional>
            <SearchableFormSelect name="state" placeholder="Select" searchPlaceholder="Search states…" className={SELECT} value={form.state || null} options={INDIAN_STATES} onValueChange={(v) => set("state", v)} />
          </FocusField>
        </FieldRow>
      </FocusSection>
    );
  } else if (active === "commission") {
    body = (
      <FocusSection title="Commission" description="What we pay them for a closed deal.">
        <ToggleCard checked={form.commission_accepted} onCheckedChange={(v) => set("commission_accepted", v)} title="They work on commission" description="Agreed terms go on partner emails.">
          <FieldRow>
            <FocusField required name="commission_type" label="Paid as" error={errors.commission_type}>
              <FormSelect name="commission_type" placeholder="Select" className={SELECT} value={form.commission_type || null} options={COMMISSION_TYPES} onValueChange={(v) => set("commission_type", v)} />
            </FocusField>
            <FocusField required name="commission_value" label={form.commission_type === "fixed_amount" ? "Amount (₹)" : "Percentage"} htmlFor="na-commission" error={errors.commission_value}>
              {form.commission_type === "fixed_amount" ? (
                <PriceInput id="na-commission" value={form.commission_value} onChange={(v) => set("commission_value", v)} placeholder="50000" className={INPUT} />
              ) : (
                <Input id="na-commission" inputMode="decimal" value={form.commission_value} onChange={(e) => set("commission_value", e.target.value)} placeholder="2" className={INPUT} />
              )}
            </FocusField>
          </FieldRow>
        </ToggleCard>
        <FocusField label="Remarks" htmlFor="na-remarks" optional hint="For the team only; never shown to the partner.">
          <Textarea id="na-remarks" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Strong in OMR rentals, prefers WhatsApp" className={AREA} />
        </FocusField>
      </FocusSection>
    );
  } else {
    body = (
      <FocusSection title="First follow-up" description="If you've already spoken to them, log it now. You can skip this.">
        <FocusField name="contactedVia" label="Contacted via" error={errors.contactedVia}>
          <div role="radiogroup" aria-label="Contacted via" className="flex flex-wrap gap-1.5">
            {CONTACTED_VIA.map(({ label, value, icon: Icon }) => {
              const on = form.contactedVia === value;
              return (
                <button key={value} type="button" role="radio" aria-checked={on} onClick={() => set("contactedVia", on ? "" : value)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] transition-colors",
                    on ? "border-foreground bg-foreground text-background" : "bg-muted/40 text-foreground/80 hover:bg-muted dark:bg-white/[0.04]",
                  )}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              );
            })}
          </div>
        </FocusField>
        <FieldRow>
          <FocusField label="Next follow-up" optional>
            <DateTimePicker value={form.next ? new Date(form.next) : undefined} onChange={(d) => set("next", d ? d.toISOString() : "")} placeholder="Pick date & time" className={cn(FOCUS_FIELD, "h-9 w-full justify-start border")} />
          </FocusField>
          <FocusField label="Priority" optional>
            <FormSelect name="priority" placeholder="Select" className={SELECT} value={form.priority || null} options={PRIORITIES} onValueChange={(v) => set("priority", v)} />
          </FocusField>
        </FieldRow>
        <FocusField label="Notes" htmlFor="na-notes" optional>
          <Textarea id="na-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="What was discussed?" className={AREA} />
        </FocusField>
      </FocusSection>
    );
  }

  return (
    <FocusModal
      open={open}
      onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}
      title="New agent"
      steps={steps}
      active={active}
      onStepChange={(k) => jump(k as AgentStep)}
      footer={
        <>
          <button type="button" className={FOCUS_BUTTON.secondary} onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</button>
          {index > 0 && (
            <button type="button" className={FOCUS_BUTTON.secondary} onClick={() => go(AGENT_STEPS[index - 1].key)} disabled={submitting}>Back</button>
          )}
          <button
            type="button"
            aria-disabled={!ready}
            title={ready ? undefined : "Fill in the fields marked * first"}
            className={cn(last ? FOCUS_BUTTON.primary : FOCUS_BUTTON.secondary, !ready && "cursor-not-allowed opacity-50")}
            onClick={() => void next()}
            disabled={submitting || checking}
          >
            {(submitting || checking) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {last ? (submitting ? "Saving…" : "Add agent") : "Continue"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => { e.preventDefault(); if (!checking) void next(); }}
        onBlur={(e) => {
          if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return;
          const name = fieldName(e.target);
          if (name && !touched.has(name)) setTouched((t) => new Set(t).add(name));
        }}
      >
        {body}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </FocusModal>
  );
}
