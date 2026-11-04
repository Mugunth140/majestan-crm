"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { FOCUS_BUTTON, FOCUS_FIELD, FieldRow, FocusField, FocusModal } from "@/components/shared/focus-modal";
import { FOCUS_INPUT, FOCUS_SELECT, StepFooter, StepSection, useFocusSteps } from "@/components/shared/focus-steps";
import { apiFetch } from "@/lib/api-fetch";
import { HR_DEPARTMENTS, hrSourceOptions, loadHrStates } from "@/lib/hr-candidate-options";
import { loadHrMasters, type HrMasters } from "@/lib/hr-import";
import { INTERVIEW_MODE_OPTIONS } from "@/lib/hr-interview";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const CANDIDATE_STEPS = [
  { key: "candidate", label: "Candidate" },
  { key: "job", label: "Job" },
  { key: "recruitment", label: "Recruitment" },
  { key: "interview", label: "Interview" },
] as const;
type CandidateStep = (typeof CANDIDATE_STEPS)[number]["key"];

const EMPTY = {
  name: "", mobile: "", whatsapp: "", email: "", city: "", state: "", assignedStaffId: "", hrSourceId: "",
  department: "", position: "", experience: "", currentSalary: "", expectedSalary: "", noticePeriod: "",
  recruitmentSource: "",
  interviewDate: "", interviewTime: "", interviewMode: "", interviewLocation: "", interviewLink: "",
  interviewer: "", interviewRound: "", interviewFeedback: "",
  status: "New Application",
};
type Form = typeof EMPTY;

/** The new-candidate form. Existing candidates are edited on their page. */
export function CandidateForm({ onClose, onCreated }: {
  onClose: () => void;
  /** Called with the new candidate's id. */
  onCreated: (id: number) => void;
}) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [resume, setResume] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [masters, setMasters] = useState<HrMasters>({ sources: [], staff: [] });
  const [states, setStates] = useState<string[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [masterError, setMasterError] = useState("");
  const [canAssign] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("crm_user") || "{}");
      return ["Super Admin", "Admin", "Manager", "Team Lead"].includes(u.role?.name || u.role);
    } catch { return false; }
  });

  const fetchMasters = useCallback(() =>
    Promise.all([loadHrMasters(), loadHrStates()]).then(([data, list]) => {
      setMasters(data);
      setStates(list);
      setMasterError("");
    }, () => setMasterError("Could not load HR sources, staff and states.")).finally(() => setLoadingMasters(false)), []);
  useEffect(() => { void fetchMasters(); }, [fetchMasters]);
  const retryMasters = () => { setLoadingMasters(true); void fetchMasters(); };

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const text = (key: keyof Form) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value) });

  const stateOptions = states.map((s) => ({ label: s, value: s }));
  const staffOptions = [{ label: "Unassigned", value: "unassigned" }, ...masters.staff.map((s) => ({ label: s.name, value: String(s.id) }))];
  const sources = hrSourceOptions(masters.sources, form);

  /** What a step is missing, if anything. */
  const problemOf = (key: CandidateStep) => {
    if (key === "candidate") return !form.name.trim() ? "Candidate name is required" : !form.mobile.trim() ? "Mobile number is required" : null;
    if (key === "job") return !form.department ? "Pick a department" : !form.position.trim() ? "Position is required" : null;
    return null;
  };
  const nav = useFocusSteps<CandidateStep>(CANDIDATE_STEPS, { create: true, problem: problemOf });

  const save = async () => {
    const missing = CANDIDATE_STEPS.find((s) => problemOf(s.key));
    if (missing) {
      toast.error(problemOf(missing.key));
      return nav.go(missing.key);
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        cityId: null,
        hrSourceId: /^\d+$/.test(sources.value) ? Number(sources.value) : null,
        assignedStaffId: form.assignedStaffId ? Number(form.assignedStaffId) : null,
      };
      if (!form.interviewDate) payload.interviewDate = null;

      const res = await apiFetch(`${API_URL}/hr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((Array.isArray(data.message) ? data.message.join(", ") : data.message) || "Failed to add candidate");

      if (resume && data.id) {
        const file = new FormData();
        file.append("file", resume);
        const upload = await apiFetch(`${API_URL}/hr/${data.id}/upload/resume`, { method: "POST", body: file });
        if (!upload.ok) toast.error("Candidate added, but the resume didn't upload. Try again from the Documents tab.");
      }
      toast.success("Candidate added");
      onCreated(data.id);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Failed to add candidate");
    } finally {
      setSaving(false);
    }
  };
  return (
    <FocusModal
      open
      onOpenChange={(o) => { if (!o && !saving) onClose(); }}
      title="New candidate"
      steps={nav.steps}
      active={nav.step}
      onStepChange={(k) => nav.jump(k as CandidateStep)}
      footer={<StepFooter nav={nav} create saving={saving} onCancel={onClose} onSave={() => void save()} createLabel="Add candidate" />}
    >
      <form onSubmit={(e) => { e.preventDefault(); if (!nav.last) nav.next(); else void save(); }}>
        {masterError && (
          <div role="alert" className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[13px] text-red-600 dark:text-red-400">
            {masterError}
            <button type="button" onClick={retryMasters} className={FOCUS_BUTTON.secondary}>Retry</button>
          </div>
        )}

        <StepSection title="Candidate" description="Who applied and how to reach them." hidden={nav.step !== "candidate"}>
          <FieldRow>
            <FocusField label="Full name" htmlFor="hc-name" required>
              <Input id="hc-name" {...text("name")} placeholder="e.g. Nandini Rao" autoFocus className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Mobile number" htmlFor="hc-mobile" required>
              <Input id="hc-mobile" type="tel" {...text("mobile")} placeholder="+91 98765 43210" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FieldRow>
            <FocusField label="WhatsApp number" htmlFor="hc-whatsapp" optional>
              <Input id="hc-whatsapp" type="tel" {...text("whatsapp")} placeholder="+91 98765 43210" className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Email" htmlFor="hc-email" optional>
              <Input id="hc-email" type="email" {...text("email")} placeholder="name@example.com" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FieldRow>
            <FocusField label="City" htmlFor="hc-city" optional>
              <Input id="hc-city" {...text("city")} placeholder="e.g. Coimbatore" className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="State" htmlFor="hc-state" optional>
              <FormSelect id="hc-state" name="state" value={form.state} onValueChange={(v) => set("state", v || "")} options={stateOptions}
                placeholder={loadingMasters ? "Loading states…" : "Select state"} disabled={loadingMasters || !!masterError} className={FOCUS_SELECT} />
            </FocusField>
          </FieldRow>
        </StepSection>

        <StepSection title="Job" description="The role they applied for and what they expect." hidden={nav.step !== "job"}>
          <FieldRow>
            <FocusField label="Department" htmlFor="hc-department" required>
              <FormSelect id="hc-department" name="department" value={form.department} onValueChange={(v) => set("department", v || "")}
                options={HR_DEPARTMENTS} placeholder="Select department" className={FOCUS_SELECT} />
            </FocusField>
            <FocusField label="Position applied" htmlFor="hc-position" required>
              <Input id="hc-position" {...text("position")} placeholder="e.g. Sales Executive" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FieldRow>
            <FocusField label="Experience" htmlFor="hc-experience" optional>
              <Input id="hc-experience" {...text("experience")} placeholder="e.g. 2 years" className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Notice period" htmlFor="hc-notice" optional>
              <Input id="hc-notice" {...text("noticePeriod")} placeholder="e.g. 30 days" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FieldRow>
            <FocusField label="Current CTC" htmlFor="hc-current" optional>
              <Input id="hc-current" {...text("currentSalary")} placeholder="e.g. 3 LPA" className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Expected CTC" htmlFor="hc-expected" optional>
              <Input id="hc-expected" {...text("expectedSalary")} placeholder="e.g. 4 LPA" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
        </StepSection>

        <StepSection title="Recruitment" description="Where the candidate came from and who follows up." hidden={nav.step !== "recruitment"}>
          <FieldRow>
            <FocusField label="HR source" htmlFor="hc-source" optional>
              <FormSelect id="hc-source" name="hrSourceId" value={sources.value} options={sources.options}
                onValueChange={(v) => {
                  const source = masters.sources.find((s) => String(s.id) === v);
                  if (source) setForm((f) => ({ ...f, hrSourceId: v, recruitmentSource: source.name }));
                }}
                placeholder={loadingMasters ? "Loading sources…" : "Select source"} disabled={loadingMasters || !!masterError} className={FOCUS_SELECT} />
            </FocusField>
            {canAssign && (
              <FocusField label="Assigned to" htmlFor="hc-staff" optional>
                <FormSelect id="hc-staff" name="assignedStaffId" value={form.assignedStaffId || "unassigned"} options={staffOptions}
                  onValueChange={(v) => set("assignedStaffId", v === "unassigned" ? "" : v || "")}
                  placeholder="Select HR staff" disabled={loadingMasters || !!masterError} className={FOCUS_SELECT} />
              </FocusField>
            )}
          </FieldRow>
          <FocusField label="Resume" optional hint="PDF or Word, up to 10 MB.">
            {resume ? (
              <div className="flex h-11 items-center gap-2.5 rounded-md border bg-muted/30 px-3 text-[14px]">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{resume.name}</span>
                <button type="button" onClick={() => setResume(null)} aria-label="Remove resume" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <label className={cn(FOCUS_BUTTON.secondary, "w-fit cursor-pointer")}>
                <FileText className="h-3.5 w-3.5" /> Choose file
                <input type="file" accept=".pdf,.doc,.docx" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file && file.size > 10 * 1024 * 1024) return void toast.error("Resume must be 10 MB or smaller.");
                    setResume(file ?? null);
                  }} />
              </label>
            )}
          </FocusField>
        </StepSection>

        <StepSection title="Interview" description="If an interview is already set. You can add it later on the candidate's page." hidden={nav.step !== "interview"}>
          <FieldRow cols={3}>
            <FocusField label="Date" htmlFor="hc-idate" optional>
              <Input id="hc-idate" type="date" {...text("interviewDate")} className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Time (IST)" htmlFor="hc-itime" optional>
              <Input id="hc-itime" type="time" {...text("interviewTime")} className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Mode" htmlFor="hc-imode" optional>
              <FormSelect id="hc-imode" name="interviewMode" value={form.interviewMode} onValueChange={(v) => set("interviewMode", v || "")}
                options={INTERVIEW_MODE_OPTIONS} placeholder="Select mode" className={FOCUS_SELECT} />
            </FocusField>
          </FieldRow>
          {form.interviewMode === "in_person" && (
            <FocusField label="Venue" htmlFor="hc-venue">
              <Input id="hc-venue" {...text("interviewLocation")} maxLength={500} placeholder="e.g. Majestan Realty, 47/1 Aandal Street, Coimbatore" className={FOCUS_INPUT} />
            </FocusField>
          )}
          {form.interviewMode === "video" && (
            <FocusField label="Meeting link" htmlFor="hc-link">
              <Input id="hc-link" type="url" {...text("interviewLink")} maxLength={1000} placeholder="https://meet.google.com/…" className={FOCUS_INPUT} />
            </FocusField>
          )}
          <FieldRow>
            <FocusField label="Interviewer" htmlFor="hc-interviewer" optional>
              <Input id="hc-interviewer" {...text("interviewer")} placeholder="e.g. Jane Smith" className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Round" htmlFor="hc-round" optional>
              <Input id="hc-round" {...text("interviewRound")} placeholder="e.g. Round 1 / Final" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FocusField label="Feedback" htmlFor="hc-feedback" optional>
            <Textarea id="hc-feedback" rows={3} {...text("interviewFeedback")} placeholder="Notes from the interview…" className={cn(FOCUS_FIELD, "resize-y py-2")} />
          </FocusField>
        </StepSection>
      </form>
    </FocusModal>
  );
}
