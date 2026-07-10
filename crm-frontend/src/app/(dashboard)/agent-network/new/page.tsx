"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { FormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const PARTNER_TYPES = [
  { label: "Individual Broker", value: "individual_broker" },
  { label: "Real Estate Company", value: "real_estate_company" },
  { label: "Referral Partner", value: "referral_partner" },
  { label: "Builder", value: "builder" },
];

const PROPERTY_CATEGORIES = [
  { label: "Residential", value: "residential" },
  { label: "Commercial", value: "commercial" },
  { label: "Industrial", value: "industrial" },
  { label: "Agricultural", value: "agricultural" },
];

const COMMISSION_TYPES = [
  { label: "Percentage", value: "percentage" },
  { label: "Fixed Amount", value: "fixed_amount" },
];

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const CONTACTED_VIA = [
  { label: "Call", value: "call" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "SMS", value: "sms" },
  { label: "Email", value: "email" },
];

function AgentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [cities, setCities] = useState<{ label: string; value: string }[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  
  const [agentData, setAgentData] = useState<any>(null);
  const [isLoadingAgent, setIsLoadingAgent] = useState(!!editId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [commissionAccepted, setCommissionAccepted] = useState("false");
  const [followUpDateObj, setFollowUpDateObj] = useState<Date | undefined>(undefined);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        setIsFetchingData(true);
        const res = await fetch(API_URL + "/master/cities");
        const cityData = await res.json();
        if (cityData.success) setCities(cityData.data);
      } catch {
        toast.error("Failed to load cities.");
      } finally {
        setIsFetchingData(false);
      }
    };
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (editId) {
      fetch(API_URL + "/agents/" + editId)
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            setAgentData(result.data);
            setCommissionAccepted(result.data.commission_accepted ? "true" : "false");
          } else {
            toast.error("Agent not found");
            router.push("/agent-network");
          }
        })
        .catch(() => {
          toast.error("Failed to load agent data");
        })
        .finally(() => setIsLoadingAgent(false));
    }
  }, [editId, router]);

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      let userId: number | undefined;
      try {
        const stored = localStorage.getItem("crm_user");
        if (stored) userId = JSON.parse(stored).id;
      } catch {}

      const payload = {
        userId,
        name: formData.get("name") as string,
        company_name: formData.get("company_name") as string,
        mobile: formData.get("mobile") as string,
        whatsapp: formData.get("whatsapp") as string,
        email: formData.get("email") as string,
        city: formData.get("city") as string,
        state: formData.get("state") as string,
        partner_type: formData.get("partner_type") as string,
        property_category: formData.get("property_category") as string,
        commission_accepted: commissionAccepted === "true",
        commission_type: formData.get("commission_type") as string,
        commission_value: formData.get("commission_value") as string,
        remarks: formData.get("remarks") as string,
        contactedVia: formData.get("contactedVia") as string,
        followUpDate: followUpDateObj ? format(followUpDateObj, "yyyy-MM-dd") : null,
        followUpTime: followUpDateObj ? format(followUpDateObj, "HH:mm") : null,
        priority: formData.get("priority") as string,
        notes: formData.get("notes") as string,
      };

      const method = editId ? "PUT" : "POST";
      const endpoint = API_URL + (editId ? "/agents/" + editId : "/agents");

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to save agent");
      }

      toast.success(editId ? "Agent updated successfully!" : "Agent created successfully!");
      router.push("/agent-network");
    } catch (err: any) {
      toast.error(err.message || "Failed to save agent.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const skeletonField = (
    <div className="h-12 rounded-xl bg-muted/50 animate-pulse flex items-center px-4">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );

  if (isLoadingAgent) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
          <p className="text-muted-foreground font-medium">Loading Agent Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between pr-[150px] min-h-[48px]">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => router.push("/agent-network")}>
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{editId ? "Edit Agent" : "Add New Agent"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {editId ? "Update the details for this channel partner." : "Enter the details for the new channel partner."}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleAddSubmit} className="space-y-6">
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Partner Name *</label>
              <Input name="name" defaultValue={agentData?.name || ""} placeholder="John Doe" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Company Name</label>
              <Input name="company_name" defaultValue={agentData?.company_name || ""} placeholder="Real Estate Co." className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number *</label>
              <Input name="mobile" defaultValue={agentData?.mobile_number || ""} placeholder="+91 98765 43210" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Whatsapp Number</label>
              <Input name="whatsapp" defaultValue={agentData?.whatsapp_number || ""} placeholder="+91 98765 43210" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Id</label>
              <Input name="email" defaultValue={agentData?.email || ""} type="email" placeholder="john@example.com" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">City</label>
              {isFetchingData ? skeletonField : <FormSelect name="city" defaultValue={agentData?.city || null} placeholder="Select City" options={cities} required />}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">State</label>
              <Input name="state" defaultValue={agentData?.state || ""} placeholder="e.g. Karnataka" className="h-12 rounded-xl bg-muted/30" />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Business Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2 lg:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Partner Type</label>
              <FormSelect name="partner_type" defaultValue={agentData?.partner_type || null} placeholder="Select Partner Type" options={PARTNER_TYPES} required />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Category</label>
              <FormSelect name="property_category" defaultValue={agentData?.property_category || null} placeholder="Select Property Category" options={PROPERTY_CATEGORIES} />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Commission Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2 lg:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Commission Accepted</label>
              <FormSelect name="_commission_accepted" value={commissionAccepted} onValueChange={(v) => setCommissionAccepted(v || "false")} placeholder="Select..." options={[{label: "Yes", value: "true"}, {label: "No", value: "false"}]} required />
            </div>
            
            {commissionAccepted === "true" && (
              <>
                <div className="space-y-2 lg:col-span-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Commission Type</label>
                  <FormSelect name="commission_type" defaultValue={agentData?.commission_type || null} placeholder="Select Type" options={COMMISSION_TYPES} />
                </div>
                <div className="space-y-2 lg:col-span-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Commission % / Amount</label>
                  <Input name="commission_value" defaultValue={agentData?.commission_value || ""} placeholder="e.g. 2% or 50000" className="h-12 rounded-xl bg-muted/30" />
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Remarks</label>
              <Textarea name="remarks" defaultValue={agentData?.remarks || ""} placeholder="Enter remarks..." className="bg-muted/30 rounded-xl resize-none text-[15px] p-4" rows={3} />
            </div>
          </div>
        </div>

        {!editId && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <div className="flex items-center justify-between border-b pb-4 mb-6">
              <h3 className="text-lg font-bold text-foreground">Log Initial Follow Up</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contacted Via</label>
                <FormSelect name="contactedVia" placeholder="Select Method" options={CONTACTED_VIA} />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Next Follow-Up</label>
                <DateTimePicker
                  value={followUpDateObj}
                  onChange={(d) => setFollowUpDateObj(d)}
                  placeholder="Pick date & time"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority Level</label>
                <FormSelect name="priority" placeholder="Select Priority" options={PRIORITIES} />
              </div>
              <div className="space-y-2 md:col-span-2 lg:col-span-4">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Follow Up Notes</label>
                <Textarea name="notes" placeholder="Enter follow up notes..." className="bg-muted/30 rounded-xl resize-none text-[15px] p-4" rows={3} />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="ghost" className="h-12 px-8 rounded-xl font-medium text-[15px]" onClick={() => router.push("/agent-network")} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="h-12 px-10 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-lg font-semibold flex items-center gap-2 text-[15px] active:scale-[0.97]">
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (editId ? <Save size={18} /> : <CheckCircle2 size={18} />)}
            {isSubmitting ? "Saving..." : (editId ? "Update Agent" : "Create Agent")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewAgentPage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" /></div>}>
      <AgentForm />
    </Suspense>
  );
}
