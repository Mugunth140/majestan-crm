"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, User, Phone, Mail, MapPin, Plus, FileText, Briefcase, Clock, Calendar, RefreshCw, Save, History, Shield, Loader2, CheckCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const FollowUpPanel = dynamic(() => import("@/components/shared/follow-up-panel").then(mod => mod.FollowUpPanel), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUS_STYLES: Record<string, string> = {
  "New Application": "bg-gray-100 text-gray-800",
  "Resume Shortlisted": "bg-blue-100 text-blue-800",
  "Interview Scheduled": "bg-purple-100 text-purple-800",
  "Interview Completed": "bg-indigo-100 text-indigo-800",
  "Selected": "bg-emerald-100 text-emerald-800",
  "Offer Sent": "bg-teal-100 text-teal-800",
  "Joined": "bg-green-100 text-green-800",
  "Rejected": "bg-red-200 text-red-900",
  "Hold": "bg-yellow-100 text-yellow-800",
};

export default function HrDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [candidate, setCandidate] = useState<any>(null);
  
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [newFollowUp, setNewFollowUp] = useState<any>({});
  const [isSavingFu, setIsSavingFu] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Keyboard shortcut for history slider
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'a' && 
        document.activeElement?.tagName !== 'INPUT' && 
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setIsFollowUpOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchCandidate = async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/hr/${id}`);
      const data = await res.json();
      setCandidate(data);
      setSelectedStatus(data.status || "New Application");
    } catch (e) {
      toast.error("Failed to load candidate");
    }
  };

  const handleDirectStatusUpdate = async (newStatus: string) => {
    if (!newStatus || newStatus === candidate.status) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`${API_URL}/hr/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success("Status updated to " + newStatus);
        fetchCandidate();
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  useEffect(() => {
    fetchCandidate();
  }, [id]);

  const handleUpload = async (docType: string, e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData(); 
    formData.append("file", file);
    try {
      await fetch(`${API_URL}/hr/${id}/upload/${docType}`, { method: "POST", body: formData });
      toast.success("Document uploaded successfully");
      fetchCandidate();
    } catch (err) {
      toast.error("Failed to upload document");
    }
  };

  const handleSaveFollowUp = async () => {
    setIsSavingFu(true);
    try {
      const res = await fetch(`${API_URL}/hr/${id}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFollowUp),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Follow-up logged successfully");
        setNewFollowUp({});
        fetchCandidate();
      } else {
        toast.error("Failed to log follow-up");
      }
    } catch (err) {
      toast.error("Failed to log follow-up");
    } finally {
      setIsSavingFu(false);
    }
  };

  if (!candidate) return <div className="p-8 text-muted-foreground">Loading candidate details...</div>;

  const badgeCls = STATUS_STYLES[selectedStatus || candidate.status] ?? "bg-gray-100 text-gray-800 border-gray-200";
  const formattedId = "HRC" + String(candidate.id).padStart(4, "0");
  const followUps = candidate.follow_ups || [];

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Header ── */}
      <div className="flex items-center justify-between pr-[150px] min-h-[48px] mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => router.push("/hr")}>
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{candidate.name}</h1>
            <Badge className={`font-medium px-2.5 py-0.5 shadow-sm border ${badgeCls}`}>{selectedStatus || candidate.status}</Badge>
            <span className="text-sm font-semibold text-muted-foreground ml-2">{formattedId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={fetchCandidate} title="Refresh">
            <RefreshCw size={14} className="text-muted-foreground" />
          </Button>
          
          <Button onClick={() => router.push(`/hr/new?edit=${candidate.id}`)} className="rounded-full px-8 py-5 bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md">
            Edit Candidate
          </Button>
        </div>
      </div>

            {/* ── Main Layout ── */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-6 pr-2 space-y-6">
        
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            
            {/* Candidate Information */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Candidate Information
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Mobile</p>
                  <p className="text-[14px] font-medium text-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {candidate.mobile || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">WhatsApp</p>
                  <p className="text-[14px] font-medium text-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-emerald-600" /> {candidate.whatsapp || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Email</p>
                  <p className="text-[14px] font-medium text-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {candidate.email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">City & State</p>
                  <p className="text-[14px] font-medium text-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {[candidate.city, candidate.state].filter(Boolean).join(", ") || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Source</p>
                  <p className="text-[14px] font-medium text-foreground">{candidate.recruitmentSource || "—"}</p>
                </div>
              </div>
            </div>

            {/* Log New Follow Up */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <Plus className="h-4 w-4 text-[#0052FF]" /> Log New Follow Up
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Next Follow-Up</label>
                  <DateTimePicker 
                    value={newFollowUp.nextFollowUpDate ? new Date(`${newFollowUp.nextFollowUpDate}T${newFollowUp.nextFollowUpTime || '00:00'}`) : undefined}
                    onChange={(date) => {
                      if (!date) return setNewFollowUp((p: any) => ({ ...p, nextFollowUpDate: "", nextFollowUpTime: "" }));
                      setNewFollowUp((p: any) => ({
                        ...p,
                        nextFollowUpDate: format(date, "yyyy-MM-dd"),
                        nextFollowUpTime: format(date, "HH:mm"),
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority Level</label>
                  <FormSelect name="priority" placeholder="Select Priority" options={[{label: "Low", value: "low"}, {label: "Medium", value: "medium"}, {label: "High", value: "high"}]} value={newFollowUp.priority} onValueChange={(v) => setNewFollowUp((p: any) => ({...p, priority: v}))} />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Follow Up Notes</label>
                  <Textarea name="notes" placeholder="Enter follow up notes..." value={newFollowUp.notes || ""} onChange={(e) => setNewFollowUp((p: any) => ({...p, notes: e.target.value}))} className="bg-muted/30 rounded-xl resize-none text-[15px] p-4" rows={3} />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button disabled={isSavingFu || !newFollowUp.notes} onClick={handleSaveFollowUp} className="rounded-xl px-6 bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md">
                  {isSavingFu ? "Saving..." : "Save Follow Up"}
                </Button>
              </div>
            </div>


            {/* ── Row 3: Documents ── */}


        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" /> Documents
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-4 border rounded-xl bg-muted/10 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-blue-500" /> Resume / CV</p>
              {candidate.resumeUrl ? (
                 <div className="flex gap-2"><Button variant="outline" size="sm" className="w-full text-xs" onClick={() => window.open(candidate.resumeUrl, "_blank")}>View File</Button></div>
              ) : (
                <Input type="file" onChange={(e) => handleUpload('resume', e)} className="text-xs cursor-pointer" />
              )}
            </div>
            
            {candidate.status === 'Joined' && (
              <>
                <div className="p-4 border rounded-xl bg-muted/10 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-blue-500" /> Aadhaar Card</p>
                  {candidate.aadhaarUrl ? (
                     <div className="flex gap-2"><Button variant="outline" size="sm" className="w-full text-xs" onClick={() => window.open(candidate.aadhaarUrl, "_blank")}>View File</Button></div>
                  ) : (
                    <Input type="file" onChange={(e) => handleUpload('aadhaar', e)} className="text-xs cursor-pointer" />
                  )}
                </div>
                <div className="p-4 border rounded-xl bg-muted/10 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-blue-500" /> PAN Card</p>
                  {candidate.panUrl ? (
                     <div className="flex gap-2"><Button variant="outline" size="sm" className="w-full text-xs" onClick={() => window.open(candidate.panUrl, "_blank")}>View File</Button></div>
                  ) : (
                    <Input type="file" onChange={(e) => handleUpload('pan', e)} className="text-xs cursor-pointer" />
                  )}
                </div>
                <div className="p-4 border rounded-xl bg-muted/10 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-blue-500" /> Educational Certs</p>
                  {candidate.educationCertUrl ? (
                     <div className="flex gap-2"><Button variant="outline" size="sm" className="w-full text-xs" onClick={() => window.open(candidate.educationCertUrl, "_blank")}>View File</Button></div>
                  ) : (
                    <Input type="file" onChange={(e) => handleUpload('educationCert', e)} className="text-xs cursor-pointer" />
                  )}
                </div>
                <div className="p-4 border rounded-xl bg-muted/10 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-blue-500" /> Experience Cert</p>
                  {candidate.experienceCertUrl ? (
                     <div className="flex gap-2"><Button variant="outline" size="sm" className="w-full text-xs" onClick={() => window.open(candidate.experienceCertUrl, "_blank")}>View File</Button></div>
                  ) : (
                    <Input type="file" onChange={(e) => handleUpload('experienceCert', e)} className="text-xs cursor-pointer" />
                  )}
                </div>
                <div className="p-4 border rounded-xl bg-muted/10 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-blue-500" /> Passport Photo</p>
                  {candidate.photoUrl ? (
                     <div className="flex gap-2"><Button variant="outline" size="sm" className="w-full text-xs" onClick={() => window.open(candidate.photoUrl, "_blank")}>View File</Button></div>
                  ) : (
                    <Input type="file" onChange={(e) => handleUpload('photo', e)} className="text-xs cursor-pointer" />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
          </div>

                    {/* Right Column */}
          <div className="xl:col-span-1 flex flex-col gap-6">
            
            {/* Actions & Status */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" /> Actions & Status
              </h3>
              
              <div className="flex flex-col gap-4">
                 <div>
                    <div className="flex items-center justify-between mb-2">
                       <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Status</p>
                       {isUpdatingStatus && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </div>
                    <div className="flex gap-2">
                       <div className="flex-1">
                         <FormSelect 
                           name="hrStatus" 
                           options={Object.keys(STATUS_STYLES).map(s => ({label: s, value: s}))}
                           value={selectedStatus}
                           onValueChange={(v) => {
                             setSelectedStatus(v || "");
                             handleDirectStatusUpdate(v || "");
                           }}
                           placeholder="Select Status"
                         />
                       </div>
                       <Button 
                          variant="outline" 
                          onClick={() => {
                            setSelectedStatus("Rejected");
                            handleDirectStatusUpdate("Rejected");
                          }}
                          disabled={isUpdatingStatus || selectedStatus === "Rejected"}
                          className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 h-11 px-6 rounded-xl font-bold transition-all"
                       >
                          Reject
                       </Button>
                    </div>
                 </div>

                 <div className="pt-2">
                   <Button 
                     onClick={() => setIsFollowUpOpen(true)} 
                     className="w-full h-11 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 font-semibold shadow-sm border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between px-4 transition-all"
                   >
                     <span className="flex items-center">
                       <History className="mr-2 h-4 w-4" /> View Follow-up History
                     </span>
                     <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-blue-200 dark:border-blue-800 bg-background/50 px-1.5 font-mono text-[10px] font-medium text-blue-700 dark:text-blue-400 opacity-100">
                       A
                     </kbd>
                   </Button>
                 </div>
              </div>
            </div>

            {/* Job Details */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" /> Job Details
              </h3>
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Department</p>
                  <p className="text-[14px] font-medium">{candidate.department || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Position</p>
                  <p className="text-[14px] font-medium">{candidate.position || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Experience</p>
                  <p className="text-[14px] font-medium">{candidate.experience || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Current CTC</p>
                  <p className="text-[14px] font-medium">{candidate.currentSalary || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Expected CTC</p>
                  <p className="text-[14px] font-medium">{candidate.expectedSalary || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Notice</p>
                  <p className="text-[14px] font-medium">{candidate.noticePeriod || "—"}</p>
                </div>
              </div>
            </div>

            {/* Interview Details */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" /> Interview Details
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Date & Round</p>
                  <p className="text-[14px] font-medium">{candidate.interviewDate ? new Date(candidate.interviewDate).toLocaleDateString() : "—"} ({candidate.interviewRound || "No Round"})</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Interviewer</p>
                  <p className="text-[14px] font-medium">{candidate.interviewer || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Feedback</p>
                  <p className="text-[14px] font-medium bg-muted/30 p-3 rounded-lg mt-1 border">{candidate.interviewFeedback || "No feedback yet."}</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        </div>

      <Sheet open={isFollowUpOpen} onOpenChange={setIsFollowUpOpen}>
        <SheetContent side="right" className="w-[450px] !max-w-[450px] p-0 flex flex-col border-l">
          <div className="p-6 border-b shrink-0 bg-blue-50 dark:bg-blue-900/20">
            <h2 className="text-lg font-bold text-[#0052FF] dark:text-blue-400">Follow Up Timeline</h2>
            <p className="text-sm text-muted-foreground mt-1">Review the history for {candidate.name}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <FollowUpPanel
              entityId={candidate.id}
              entityType="hr"
              followUps={followUps}
              onRefresh={fetchCandidate}
            />
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
