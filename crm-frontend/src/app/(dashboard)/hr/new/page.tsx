"use client";

import { loadHrMasters, type HrMasters } from "@/lib/hr-import";
import { loadHrStates, hrSourceOptions } from "@/lib/hr-candidate-options";
import { apiFetch } from "@/lib/api-fetch";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { FormSelect } from "@/components/shared/form-select";
import { MobileHeader } from "@/components/layout/mobile-header";
import { INTERVIEW_MODE_OPTIONS, toTimeInput } from "@/lib/hr-interview";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const DEPARTMENTS = [
  { label: "Sales", value: "Sales" },
  { label: "Telecalling", value: "Telecalling" },
  { label: "Sourcing", value: "Sourcing" },
  { label: "Channel Partner", value: "Channel Partner" },
  { label: "Digital Marketing", value: "Digital Marketing" },
  { label: "HR", value: "HR" },
  { label: "Admin", value: "Admin" },
  { label: "Accounts", value: "Accounts" }
];


function HrCandidateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!!editId);
  
  const [formData, setFormData] = useState({
    name: "", mobile: "", whatsapp: "", email: "", city: "", state: "", assignedStaffId: "", hrSourceId: "",
    department: "", position: "", experience: "", currentSalary: "", expectedSalary: "", noticePeriod: "",
    recruitmentSource: "",
    interviewDate: "", interviewTime: "", interviewMode: "", interviewLocation: "", interviewLink: "",
    interviewer: "", interviewRound: "", interviewFeedback: "",
    status: "New Application"
  });

  const [masters, setMasters] = useState<HrMasters>({ sources: [], staff: [] });
  const [states, setStates] = useState<string[]>([]);
  const [canAssign, setCanAssign] = useState(false);
  const [currentAssigneeName, setCurrentAssigneeName] = useState("");
  useEffect(() => {
    try { const user = JSON.parse(localStorage.getItem("crm_user") || "{}"); setCanAssign(["Super Admin", "Admin", "Manager", "Team Lead"].includes(user.role?.name || user.role)); } catch {}
  }, []);
  const [isLoadingMasters, setIsLoadingMasters] = useState(true);
  const [masterError, setMasterError] = useState("");
  const fetchMasters = useCallback(async () => {
    setIsLoadingMasters(true); setMasterError("");
    try { const [data, states] = await Promise.all([loadHrMasters(), loadHrStates()]); setMasters(data); setStates(states); }
    catch { setMasterError("Could not load HR sources, staff and states. Please retry."); }
    finally { setIsLoadingMasters(false); }
  }, []);
  useEffect(() => { void fetchMasters(); }, [fetchMasters]);
  const stateOptions = [...new Set([...states, formData.state].filter(Boolean))].sort().map(state => ({ label: state, value: state }));
  const staffOptions = [{ label: "Unassigned", value: "unassigned" }, ...masters.staff.map(staff => ({ label: `#${staff.id} ${staff.name}`, value: String(staff.id) }))];
  if (formData.assignedStaffId && !masters.staff.some(staff => String(staff.id) === formData.assignedStaffId)) staffOptions.push({ label: currentAssigneeName || `#${formData.assignedStaffId}`, value: formData.assignedStaffId });
  const sourceOptions = hrSourceOptions(masters.sources, formData);

  const [resumeFile, setResumeFile] = useState<File | null>(null);

  useEffect(() => {
    if (editId) {
      apiFetch(`${API_URL}/hr/${editId}`)
        .then(res => res.json())
        .then(data => {
          if (data) {
            setCurrentAssigneeName(data.assignedStaff?.name || "");
            setFormData({
              name: data.name || "", mobile: data.mobile || "", whatsapp: data.whatsapp || "", email: data.email || "", city: data.city || "", state: data.state || "",
              assignedStaffId: data.assignedStaffId != null ? String(data.assignedStaffId) : "", hrSourceId: data.hrSourceId != null ? String(data.hrSourceId) : "",
              department: data.department || "", position: data.position || "", experience: data.experience || "", currentSalary: data.currentSalary || "", expectedSalary: data.expectedSalary || "", noticePeriod: data.noticePeriod || "",
              recruitmentSource: data.recruitmentSource || "",
              interviewDate: data.interviewDate || "", interviewTime: toTimeInput(data.interviewTime), interviewMode: data.interviewMode || "",
              interviewLocation: data.interviewLocation || "", interviewLink: data.interviewLink || "", interviewer: data.interviewer || "", interviewRound: data.interviewRound || "", interviewFeedback: data.interviewFeedback || "",
              status: data.status || "New Application"
            });
          }
        })
        .catch(() => toast.error("Failed to load candidate details"))
        .finally(() => setIsLoading(false));
    }
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const url = editId ? `${API_URL}/hr/${editId}` : `${API_URL}/hr`;
      const method = editId ? "PATCH" : "POST";

      const payload = {
        ...formData,
        cityId: null,
        hrSourceId: /^\d+$/.test(sourceOptions.value) ? Number(sourceOptions.value) : null,
        assignedStaffId: formData.assignedStaffId ? Number(formData.assignedStaffId) : null,
      };
      if (!payload.interviewDate) {
        (payload as Record<string, unknown>).interviewDate = null;
      }

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        const errorMsg = Array.isArray(data.message) ? data.message.join(", ") : data.message;
        throw new Error(errorMsg || `Failed to ${editId ? 'update' : 'add'} candidate`);
      }

      const candidateId = editId || data.id;

      // Upload Resume if selected
      if (resumeFile && candidateId) {
        const fileData = new FormData();
        fileData.append("file", resumeFile);
        const uploadRes = await apiFetch(`${API_URL}/hr/${candidateId}/upload/resume`, {
          method: "POST",
          body: fileData
        });
        if (!uploadRes.ok) {
          throw new Error("Candidate saved, but resume upload failed");
        }
      }

      toast.success(`Candidate ${editId ? 'updated' : 'added'} successfully!`);
      router.push("/hr");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${editId ? 'update' : 'add'} candidate`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2.5 md:px-0 mt-2 md:mt-0 mb-20 md:mb-0">
      <MobileHeader title={editId ? "Edit Candidate" : "Add Candidate"} showBack />
      <div className="hidden md:flex items-center justify-between pr-[150px] min-h-[48px]">
        <div className="flex items-center gap-4">
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => router.push("/hr")}>
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{editId ? "Edit Candidate" : "Add New Candidate"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {editId ? "Update the details for this candidate." : "Enter the details for the new HR applicant."}
            </p>
          </div>
        </div>
      </div>

      {masterError && <div role="alert" className="text-sm text-destructive flex items-center gap-3">
        {masterError}<Button type="button" variant="outline" onClick={fetchMasters}>Retry</Button>
      </div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Basic Information */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Candidate Name</label>
              <Input name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number</label>
              <Input name="mobile" value={formData.mobile} onChange={handleChange} placeholder="+91 98765 43210" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">WhatsApp Number</label>
              <Input name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="+91 98765 43210" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
              <Input name="email" value={formData.email} onChange={handleChange} type="email" placeholder="john@example.com" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">City</label>
              <Input name="city" value={formData.city} onChange={handleChange} placeholder="Enter City" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">State</label>
              <FormSelect name="state" value={formData.state}
                onValueChange={(value: string) => setFormData(previous => ({ ...previous, state: value }))} placeholder={isLoadingMasters ? "Loading states..." : "Select State"}
                options={stateOptions} disabled={isLoadingMasters || !!masterError} />
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Job Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Department</label>
              <FormSelect name="department" value={formData.department} onValueChange={(val: string) => setFormData(p => ({...p, department: val}))} placeholder="Select Department" options={DEPARTMENTS} required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Position Applied</label>
              <Input name="position" value={formData.position} onChange={handleChange} placeholder="e.g. Sales Executive" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Experience</label>
              <Input name="experience" value={formData.experience} onChange={handleChange} placeholder="e.g. 2 Years" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Salary</label>
              <Input name="currentSalary" value={formData.currentSalary} onChange={handleChange} placeholder="e.g. 3 LPA" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expected Salary</label>
              <Input name="expectedSalary" value={formData.expectedSalary} onChange={handleChange} placeholder="e.g. 4 LPA" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notice Period</label>
              <Input name="noticePeriod" value={formData.noticePeriod} onChange={handleChange} placeholder="e.g. 30 Days" className="h-12 rounded-xl bg-muted/30" />
            </div>
          </div>
        </div>

        {canAssign && <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assigned staff</label>
            <FormSelect name="assignedStaffId" value={formData.assignedStaffId || "unassigned"}
              onValueChange={(value: string) => setFormData(previous => ({ ...previous, assignedStaffId: value === "unassigned" ? "" : value }))}
              placeholder="Select HR staff" options={staffOptions} disabled={isLoadingMasters || !!masterError} />
          </div>
        </div>}

        {/* Recruitment & Interview */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Recruitment & Interview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">HR Source</label>
              <FormSelect name="hrSourceId" value={sourceOptions.value} onValueChange={(value: string) => {
                const source = masters.sources.find(item => String(item.id) === value);
                if (source) setFormData(previous => ({ ...previous, hrSourceId: value, recruitmentSource: source.name }));
              }} placeholder={isLoadingMasters ? "Loading sources..." : "Select Source"} options={sourceOptions.options}
                disabled={isLoadingMasters || !!masterError} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Interview Date</label>
              <Input name="interviewDate" type="date" value={formData.interviewDate ? formData.interviewDate.split('T')[0] : ""} onChange={handleChange} className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Interview Time (IST)</label>
              <Input name="interviewTime" type="time" value={formData.interviewTime} onChange={handleChange} className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Interview Mode</label>
              <FormSelect name="interviewMode" value={formData.interviewMode} onValueChange={(value: string) => setFormData(p => ({ ...p, interviewMode: value || "" }))}
                placeholder="Select mode" options={INTERVIEW_MODE_OPTIONS} />
            </div>
            {formData.interviewMode === "in_person" && (
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Interview Venue</label>
                <Input name="interviewLocation" value={formData.interviewLocation} onChange={handleChange} maxLength={500} placeholder="e.g. Majestan Realty, 47/1 Aandal Street, Coimbatore" className="h-12 rounded-xl bg-muted/30" />
              </div>
            )}
            {formData.interviewMode === "video" && (
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Meeting Link</label>
                <Input name="interviewLink" type="url" value={formData.interviewLink} onChange={handleChange} maxLength={1000} placeholder="https://meet.google.com/..." className="h-12 rounded-xl bg-muted/30" />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Interviewer Name</label>
              <Input name="interviewer" value={formData.interviewer} onChange={handleChange} placeholder="e.g. Jane Smith" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Interview Round</label>
              <Input name="interviewRound" value={formData.interviewRound} onChange={handleChange} placeholder="e.g. Round 1 / Final" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Interview Feedback</label>
              <Input name="interviewFeedback" value={formData.interviewFeedback} onChange={handleChange} placeholder="Enter feedback notes..." className="h-12 rounded-xl bg-muted/30" />
            </div>
          </div>
        </div>

        {/* Document Section */}
        {!editId && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Candidate Resume (PDF/Doc)</label>
                <Input type="file" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} className="h-12 rounded-xl bg-muted/30 pt-2.5 cursor-pointer" accept=".pdf,.doc,.docx" />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-4 pt-4 pb-20">
          <Button type="button" variant="outline" className="h-12 px-8 rounded-xl font-semibold border-border/60 hover:bg-muted" onClick={() => router.push("/hr")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving} className="h-12 px-8 rounded-xl font-semibold bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md hover:shadow-lg transition-all active:scale-95">
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5 mr-2" /> {editId ? "Update Candidate" : "Save Candidate"}</>}
          </Button>
        </div>

      </form>
    </div>
  );
}

export default function NewCandidatePage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" /></div>}>
      <HrCandidateForm />
    </Suspense>
  );
}
