"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { FormSelect } from "@/components/shared/form-select";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

const SOURCES = [
  { label: "Nithra", value: "Nithra" },
  { label: "Indeed", value: "Indeed" },
  { label: "LinkedIn", value: "LinkedIn" },
  { label: "Referral", value: "Referral" },
  { label: "Walk-in", value: "Walk-in" },
  { label: "Company Website", value: "Company Website" },
  { label: "Consultancy", value: "Consultancy" },
  { label: "Social Media", value: "Social Media" },
  { label: "Other", value: "Other" }
];

export default function NewCandidate() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "", mobile: "", whatsapp: "", email: "", city: "", state: "",
    department: "", position: "", experience: "", currentSalary: "", expectedSalary: "", noticePeriod: "",
    recruitmentSource: "",
    interviewDate: "", interviewer: "", interviewRound: "", interviewFeedback: "",
    status: "New Application"
  });

  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // Create Candidate
      const res = await fetch(`${API_URL}/hr`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      // Upload Resume if selected
      if (resumeFile && data.id) {
        const fileData = new FormData();
        fileData.append("file", resumeFile);
        await fetch(`${API_URL}/hr/${data.id}/upload/resume`, {
          method: "POST",
          body: fileData
        });
      }

      toast.success("Candidate added successfully!");
      router.push("/hr");
    } catch (err) {
      toast.error("Failed to add candidate");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between pr-[150px] min-h-[48px]">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => router.push("/hr")}>
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Add New Candidate</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the details for the new HR applicant.
            </p>
          </div>
        </div>
      </div>

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
              <Input name="city" value={formData.city} onChange={handleChange} placeholder="e.g. Bangalore" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">State</label>
              <Input name="state" value={formData.state} onChange={handleChange} placeholder="e.g. Karnataka" className="h-12 rounded-xl bg-muted/30" />
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

        {/* Recruitment & Interview */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Recruitment & Interview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recruitment Source</label>
              <FormSelect name="recruitmentSource" value={formData.recruitmentSource} onValueChange={(val: string) => setFormData(p => ({...p, recruitmentSource: val}))} placeholder="Select Source" options={SOURCES} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Interview Date</label>
              <Input name="interviewDate" type="date" value={formData.interviewDate} onChange={handleChange} className="h-12 rounded-xl bg-muted/30" />
            </div>
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
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Candidate Resume (PDF/Doc)</label>
              <Input type="file" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} className="h-12 rounded-xl bg-muted/30 pt-2.5 cursor-pointer" accept=".pdf,.doc,.docx" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 pb-20">
          <Button type="button" variant="outline" className="h-12 px-8 rounded-xl font-semibold border-border/60 hover:bg-muted" onClick={() => router.push("/hr")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving} className="h-12 px-8 rounded-xl font-semibold bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md hover:shadow-lg transition-all active:scale-95">
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5 mr-2" /> Save Candidate</>}
          </Button>
        </div>

      </form>
    </div>
  );
}