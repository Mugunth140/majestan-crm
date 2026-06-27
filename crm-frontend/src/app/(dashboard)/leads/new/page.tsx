"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLeadsStore } from "@/stores/leadsStore";
import { FormSelect } from "@/components/shared/form-select";

const PURCHASE_TYPES = [
  { label: "Rental", value: "rental" },
  { label: "Construction", value: "construction" },
  { label: "Liasioning", value: "liasioning" },
  { label: "Property Management", value: "property_management" },
  { label: "Sale", value: "sale" },
  { label: "Buy", value: "buy" },
];

const PROPERTY_TYPES = [
  { label: "Apartment", value: "apartment" },
  { label: "Villa", value: "villa" },
  { label: "Showrooms", value: "showrooms" },
  { label: "Office Space", value: "office_space" },
  { label: "Ware House", value: "ware_house" },
  { label: "Industrial Plot", value: "industrial_plot" },
  { label: "Commercial Sites", value: "commercial_sites" },
  { label: "Commercial Buildings", value: "commercial_buildings" },
  { label: "Individual House", value: "individual_house" },
  { label: "Farm Land", value: "farm_land" },
];

const PURPOSES = [
  { label: "New Follow Up", value: "new_follow_up" },
  { label: "Site Visit", value: "site_visit" },
  { label: "Office Visit", value: "office_visit" },
  { label: "Payment Negotiation", value: "payment_negotiation" },
  { label: "Payment Follow Up", value: "payment_follow_up" },
  { label: "Booking Confirmation", value: "booking_confirmation" },
  { label: "Client Reference", value: "client_reference" },
  { label: "Rsv", value: "rsv" },
  { label: "No Need", value: "no_need" },
];

const PROPERTY_CATEGORIES = [
  { label: "Residential", value: "residential" },
  { label: "Commercial", value: "commercial" },
  { label: "Industrial", value: "industrial" },
  { label: "Agricultural", value: "agricultural" },
];

const FUNDERS = [
  { label: "Self Funded", value: "self" },
  { label: "Bank Loan", value: "bank" },
];

export default function NewLeadPage() {
  const router = useRouter();
  const { leads, addLead } = useLeadsStore();

  const [cities, setCities] = useState<{label: string, value: string}[]>([]);
  const [sources, setSources] = useState<{label: string, value: string}[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);

  // Wire up to backend (mocked for now as per instructions)
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        setIsFetchingData(true);
        // Simulate API call to Majestan database
        // const cityRes = await fetch('/api/v1/master/cities');
        // const sourceRes = await fetch('/api/v1/master/sources');
        
        await new Promise(resolve => setTimeout(resolve, 600)); // Network delay simulation
        
        setCities([
          { label: "New York", value: "new_york" },
          { label: "Los Angeles", value: "los_angeles" },
          { label: "Chicago", value: "chicago" }
        ]);
        
        setSources([
          { label: "Direct Walk-in", value: "walk_in" },
          { label: "Website", value: "website" },
          { label: "Referral", value: "referral" },
          { label: "Social Media", value: "social" }
        ]);
      } catch (error) {
        toast.error("Failed to load master data.");
      } finally {
        setIsFetchingData(false);
      }
    };
    fetchMasterData();
  }, []);

  const handleAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newLead = {
      sno: leads.length + 1,
      id: "L" + (10000 + leads.length + 1),
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      name: formData.get("name") as string,
      mobile: formData.get("mobile") as string,
      propertyType: formData.get("propertyType") as string,
      staff: "Current User",
      source: formData.get("source") as string,
      status: "NEW",
      notes: formData.get("notes") as string,
    };

    addLead(newLead);
    toast.success("Lead created successfully!");
    router.push("/leads");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => router.push("/leads")}>
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Add New Lead</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter the details for the new prospect.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleAddSubmit} className="space-y-6">
        
        {/* Section 1: Customer Information */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Customer Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer Name</label>
              <Input name="name" placeholder="John Doe" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number</label>
              <Input name="mobile" placeholder="+1 234 567 890" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Whatsapp Number</label>
              <Input name="whatsapp" placeholder="+1 234 567 890" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Id</label>
              <Input name="email" type="email" placeholder="john@example.com" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">City</label>
              {isFetchingData ? (
                <div className="h-12 rounded-xl bg-muted/50 animate-pulse flex items-center px-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : (
                <FormSelect name="city" placeholder="Select City" options={cities} required />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lead Source</label>
              {isFetchingData ? (
                <div className="h-12 rounded-xl bg-muted/50 animate-pulse flex items-center px-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : (
                <FormSelect name="source" placeholder="Select Lead Source" options={sources} required />
              )}
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address</label>
              <Textarea name="address" placeholder="Enter complete address" className="bg-muted/30 rounded-xl resize-none text-[15px] p-4" rows={3} />
            </div>
          </div>
        </div>

        {/* Section 2: Requirement Information */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Requirement Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purchase / Service Type</label>
              <FormSelect name="purchaseType" placeholder="Select Purchase Type" options={PURCHASE_TYPES} required />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Funder</label>
              <FormSelect name="funder" placeholder="Select Funder" options={FUNDERS} required />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Type</label>
              <FormSelect name="propertyType" placeholder="Select Property Type" options={PROPERTY_TYPES} required />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Category</label>
              <FormSelect name="propertyCategory" placeholder="Select Property Category" options={PROPERTY_CATEGORIES} required />
            </div>
          </div>
        </div>

        {/* Section 3: New Follow Up */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4 mb-6">
            <h3 className="text-lg font-bold text-foreground">New Follow Up</h3>
            <div className="flex items-center gap-3 bg-muted/40 px-4 py-2 rounded-full border border-border/50 transition-colors hover:bg-muted/60">
              <label htmlFor="unqualified" className="text-sm font-semibold text-muted-foreground cursor-pointer select-none">Mark as Unqualified</label>
              <Switch id="unqualified" name="unqualified" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Follow Up Date</label>
              <Input name="followUpDate" type="date" className="h-12 rounded-xl bg-muted/30 text-[15px]" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Follow Up Time</label>
              <Input name="followUpTime" type="time" className="h-12 rounded-xl bg-muted/30 text-[15px]" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purpose</label>
              <FormSelect name="purpose" placeholder="Select Purpose" options={PURPOSES} />
            </div>
            
            <div className="space-y-2 md:col-span-2 lg:col-span-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Follow Up Notes</label>
              <Textarea name="notes" placeholder="Enter follow up notes..." className="bg-muted/30 rounded-xl resize-none text-[15px] p-4" rows={3} />
            </div>
            
            {/* Elegant Priority & RNR Toggles */}
            <div className="space-y-4 md:col-span-2 lg:col-span-4 mt-2">
              <div className="flex flex-col lg:flex-row gap-6 lg:gap-12">
                
                <div className="flex-1 space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority Level</label>
                  <RadioGroup defaultValue="medium" name="priority" className="flex flex-wrap items-center gap-3">
                    {["Low", "Medium", "High", "Urgent"].map((prio) => (
                      <div key={prio} className="relative">
                        <RadioGroupItem value={prio.toLowerCase()} id={"prio-" + prio} className="peer sr-only" />
                        <label 
                          htmlFor={"prio-" + prio} 
                          className="flex items-center justify-center px-6 py-2.5 rounded-full border bg-background text-sm font-semibold cursor-pointer transition-all peer-data-[state=checked]:border-[#0052FF] peer-data-[state=checked]:bg-[#0052FF]/10 peer-data-[state=checked]:text-[#0052FF] hover:bg-muted"
                        >
                          {prio}
                        </label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex-1 space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">RNR Status</label>
                  <RadioGroup defaultValue="rnr1" name="rnr" className="flex flex-wrap items-center gap-3">
                    {["RNR 1", "RNR 2", "RNR 3"].map((rnr) => (
                      <div key={rnr} className="relative">
                        <RadioGroupItem value={rnr.toLowerCase().replace(' ', '')} id={"rnr-" + rnr} className="peer sr-only" />
                        <label 
                          htmlFor={"rnr-" + rnr} 
                          className="flex items-center justify-center px-6 py-2.5 rounded-full border bg-background text-sm font-semibold cursor-pointer transition-all peer-data-[state=checked]:border-[#0052FF] peer-data-[state=checked]:bg-[#0052FF]/10 peer-data-[state=checked]:text-[#0052FF] hover:bg-muted"
                        >
                          {rnr}
                        </label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="ghost" className="h-12 px-8 rounded-xl font-medium text-[15px]" onClick={() => router.push("/leads")}>
            Cancel
          </Button>
          <Button type="submit" className="h-12 px-10 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-lg font-semibold flex items-center gap-2 text-[15px]">
            <CheckCircle2 size={18} /> Create Lead
          </Button>
        </div>
      </form>
    </div>
  );
}
