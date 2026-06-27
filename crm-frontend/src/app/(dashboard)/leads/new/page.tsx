"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormSelect } from "@/components/shared/form-select";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
  { label: "RSV", value: "rsv" },
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

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const RNR_OPTIONS = [
  { label: "RNR 1", value: "rnr1" },
  { label: "RNR 2", value: "rnr2" },
  { label: "RNR 3", value: "rnr3" },
];

// Projects are not live in the website yet — hardcoded list
const PROJECTS = [
  { label: "Majestan Prestige", value: "majestan_prestige" },
  { label: "Majestan Heights", value: "majestan_heights" },
  { label: "Majestan Residency", value: "majestan_residency" },
  { label: "Majestan Enclave", value: "majestan_enclave" },
  { label: "Majestan Grand", value: "majestan_grand" },
];

export default function NewLeadPage() {
  const router = useRouter();

  const [cities, setCities] = useState<{ label: string; value: string }[]>([]);
  const [sources, setSources] = useState<{ label: string; value: string }[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);

  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [otherSourceText, setOtherSourceText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        setIsFetchingData(true);
        const [cityRes, sourceRes] = await Promise.all([
          fetch(API_URL + "/master/cities"),
          fetch(API_URL + "/master/lead-sources"),
        ]);

        const cityData = await cityRes.json();
        const sourceData = await sourceRes.json();

        if (cityData.success) setCities(cityData.data);
        if (sourceData.success) {
          setSources([...sourceData.data, { label: "Others", value: "others" }]);
        }
      } catch {
        toast.error("Failed to load master data.");
      } finally {
        setIsFetchingData(false);
      }
    };
    fetchMasterData();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      let sourceValue = formData.get("source") as string;

      // If "Others" selected, register new source in DB first
      if (sourceValue === "others" && otherSourceText.trim()) {
        const res = await fetch(API_URL + "/master/lead-sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: otherSourceText.trim() }),
        });
        const result = await res.json();
        if (result.success) sourceValue = result.data.value;
      }

      const payload = {
        name: formData.get("name") as string,
        mobile: formData.get("mobile") as string,
        email: formData.get("email") as string,
        whatsapp: formData.get("whatsapp") as string,
        city: formData.get("city") as string,
        address: formData.get("address") as string,
        source: sourceValue,
        project: formData.get("project") as string,
        purchaseType: formData.get("purchaseType") as string,
        propertyType: formData.get("propertyType") as string,
        funder: formData.get("funder") as string,
        propertyCategory: formData.get("propertyCategory") as string,
        followUpDate: formData.get("followUpDate") as string,
        followUpTime: formData.get("followUpTime") as string,
        purpose: formData.get("purpose") as string,
        priority: formData.get("priority") as string,
        rnr: formData.get("rnr") as string,
        notes: formData.get("notes") as string,
      };

      const res = await fetch(API_URL + "/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to create lead");
      }

      toast.success("Lead created successfully!");
      router.push("/leads");
    } catch (err: any) {
      toast.error(err.message || "Failed to create lead.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const skeletonField = (
    <div className="h-12 rounded-xl bg-muted/50 animate-pulse flex items-center px-4">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={() => router.push("/leads")}
          >
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
              <Input name="mobile" placeholder="+91 98765 43210" required className="h-12 rounded-xl bg-muted/30" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Whatsapp Number</label>
              <Input name="whatsapp" placeholder="+91 98765 43210" className="h-12 rounded-xl bg-muted/30" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Id</label>
              <Input name="email" type="email" placeholder="john@example.com" className="h-12 rounded-xl bg-muted/30" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">City</label>
              {isFetchingData ? skeletonField : (
                <FormSelect name="city" placeholder="Select City" options={cities} required />
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lead Source</label>
              {isFetchingData ? skeletonField : (
                <FormSelect
                  name="source"
                  placeholder="Select Lead Source"
                  options={sources}
                  required
                  value={selectedSource}
                  onValueChange={(v) => setSelectedSource(v)}
                />
              )}
            </div>

            {/* Conditional text input when "Others" is selected */}
            {selectedSource === "others" && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Specify Source</label>
                <Input
                  placeholder="Enter source name"
                  required
                  className="h-12 rounded-xl bg-muted/30"
                  value={otherSourceText}
                  onChange={(e) => setOtherSourceText(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project List</label>
              <FormSelect name="project" placeholder="Select Project" options={PROJECTS} />
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address</label>
              <Textarea
                name="address"
                placeholder="Enter complete address"
                className="bg-muted/30 rounded-xl resize-none text-[15px] p-4"
                rows={3}
              />
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
              <label htmlFor="unqualified" className="text-sm font-semibold text-muted-foreground cursor-pointer select-none">
                Mark as Unqualified
              </label>
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

            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority Level</label>
              <FormSelect name="priority" placeholder="Select Priority" options={PRIORITIES} />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">RNR Status</label>
              <FormSelect name="rnr" placeholder="Select RNR Status" options={RNR_OPTIONS} />
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Follow Up Notes</label>
              <Textarea
                name="notes"
                placeholder="Enter follow up notes..."
                className="bg-muted/30 rounded-xl resize-none text-[15px] p-4"
                rows={3}
              />
            </div>

          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="ghost"
            className="h-12 px-8 rounded-xl font-medium text-[15px]"
            onClick={() => router.push("/leads")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 px-10 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-lg font-semibold flex items-center gap-2 text-[15px] active:scale-[0.97]"
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            {isSubmitting ? "Creating..." : "Create Lead"}
          </Button>
        </div>

      </form>
    </div>
  );
}
