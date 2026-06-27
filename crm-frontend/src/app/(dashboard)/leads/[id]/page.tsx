"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, User, Phone, MapPin, Building2, Calendar, FileText, Briefcase, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUS_STYLES: Record<string, string> = {
  "INCOMING":        "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "NEW":             "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "OPPORTUNITY":     "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
  "SITE VISIT DONE": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  "RSV DONE":        "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400",
  "RSV SCHEDULE":    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  "PROSPECTIVE":     "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/30 dark:text-lime-400",
  "DROPPED":         "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  "BOOKED":          "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  "SV SCHEDULE":     "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  "REJECT":          "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
};

const formatTime12hr = (timeString: string) => {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":");
  if (!hours || !minutes) return timeString;
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${minutes} ${ampm}`;
};

export default function LeadViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    fetch(API_URL + "/leads/" + id)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setLead(result.data);
        } else {
          toast.error("Lead not found");
          router.push("/leads");
        }
      })
      .catch(() => {
        toast.error("Failed to load lead details");
      })
      .finally(() => setIsLoading(false));
  }, [id, router]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
          <p className="text-muted-foreground font-medium">Loading Lead Details...</p>
        </div>
      </div>
    );
  }

  if (!lead) return null;

  const inquiry = lead.inquiries?.[0];
  const followUp = lead.follow_ups?.[0];
  const statusName = lead.status?.name || "INCOMING";
  const badgeCls = STATUS_STYLES[statusName] ?? "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between pr-35 min-h-12">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => router.push("/leads")}>
            <ArrowLeft className="h-5 w-6/29/2026 at 13:23:005 text-muted-foreground" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{lead.name}</h1>
              <Badge className={"font-medium px-3 py-1 shadow-sm border " + badgeCls}>{statusName}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Lead ID: L{String(lead.id).padStart(5, '0')} • Created on {new Date(lead.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Button onClick={() => router.push("/leads/new?edit=" + lead.id)} className="rounded-lg px-6 bg-[#024be9] text-white hover:bg-[#0040CC] shadow-md">
          Edit Lead
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Info & Requirements */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" /> Customer Information
            </h3>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Mobile</p>
                <p className="text-[15px] font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" /> {lead.mobile_number || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">WhatsApp</p>
                <p className="text-[15px] font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-600" /> {lead.whatsapp_number || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Email</p>
                <p className="text-[15px] font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" /> {lead.email || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">City</p>
                <p className="text-[15px] font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" /> {lead.city || "—"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Address</p>
                <p className="text-[15px] font-medium">{lead.address || "—"}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" /> Requirement Details
            </h3>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Project / Property</p>
                <p className="text-[15px] font-medium capitalize">{inquiry?.project_list?.replace(/_/g, ' ') || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Purchase / Service Type</p>
                <p className="text-[15px] font-medium capitalize">{inquiry?.purchase_type?.replace(/_/g, ' ') || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Property Type</p>
                <p className="text-[15px] font-medium capitalize">{inquiry?.property_type?.replace(/_/g, ' ') || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Property Category</p>
                <p className="text-[15px] font-medium capitalize">{inquiry?.property_category?.replace(/_/g, ' ') || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Funder</p>
                <p className="text-[15px] font-medium capitalize">{inquiry?.funder?.replace(/_/g, ' ') || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Status & Follow Up */}
        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-muted-foreground" /> Lead Assignment
            </h3>
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Assigned Staff</p>
                <p className="text-[15px] font-medium">{lead.assigned_staff?.name || "Unassigned"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Lead Source</p>
                <Badge variant="outline" className="text-sm font-medium">{lead.lead_source || "Unknown"}</Badge>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" /> Follow Up Status
            </h3>
            {followUp ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Next Follow Up</p>
                  <p className="text-[15px] font-medium text-[#0052FF]">
                    {followUp.follow_up_date ? new Date(followUp.follow_up_date).toLocaleDateString() : "—"} 
                    {followUp.follow_up_time ? ` at ${formatTime12hr(followUp.follow_up_time)}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Purpose</p>
                  <p className="text-[15px] font-medium capitalize">{followUp.purpose?.replace(/_/g, ' ') || "—"}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Priority</p>
                    <Badge variant="secondary" className="capitalize">{followUp.priority || "—"}</Badge>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">RNR Status</p>
                    <Badge variant="outline" className="uppercase">{followUp.rnr || "—"}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Notes
                  </p>
                  <div className="bg-muted/30 p-3 rounded-lg text-sm text-foreground/90 whitespace-pre-wrap">
                    {followUp.notes || <span className="italic text-muted-foreground">No notes recorded.</span>}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No follow up scheduled yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
