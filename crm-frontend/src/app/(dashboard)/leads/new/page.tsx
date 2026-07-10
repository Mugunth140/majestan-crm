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

const PURCHASE_TYPES = [
  { label: "Rental", value: "rental" },
  { label: "Construction", value: "construction" },
  { label: "Liasioning", value: "liasioning" },
  { label: "Property Management", value: "property_management" },
  { label: "Sale", value: "sale" },
  { label: "Buy", value: "buy" },
];

const PROPERTY_CATEGORIES = [
  { label: "Residential", value: "residential" },
  { label: "Commercial", value: "commercial" },
  { label: "Industrial", value: "industrial" },
  { label: "Agricultural", value: "agricultural" },
  { label: "Institutional", value: "institutional" },
];

const PROPERTY_TYPES_MAP: Record<string, { label: string; value: string }[]> = {
  residential: [
    { label: "Apartment", value: "apartment" },
    { label: "Villa", value: "villa" },
    { label: "Independent House", value: "independent_house" },
    { label: "Plot", value: "plot" },
    { label: "Farm House", value: "farm_house" },
    { label: "Builder Floor", value: "builder_floor" },
  ],
  commercial: [
    { label: "Office", value: "office" },
    { label: "Shop", value: "shop" },
    { label: "Showroom", value: "showroom" },
    { label: "Commercial Building", value: "commercial_building" },
    { label: "Warehouse", value: "warehouse" },
    { label: "Hotel", value: "hotel" },
    { label: "Restaurant", value: "restaurant" },
    { label: "Commercial Land", value: "commercial_land" },
  ],
  industrial: [
    { label: "Factory", value: "factory" },
    { label: "Industrial Shed", value: "industrial_shed" },
    { label: "Industrial Land", value: "industrial_land" },
    { label: "Warehouse", value: "warehouse" },
    { label: "Manufacturing Unit", value: "manufacturing_unit" },
  ],
  agricultural: [
    { label: "Agricultural Land", value: "agricultural_land" },
    { label: "Farm Land", value: "farm_land" },
    { label: "Coconut Farm", value: "coconut_farm" },
    { label: "Plantation", value: "plantation" },
    { label: "Orchard", value: "orchard" },
  ],
  institutional: [
    { label: "School", value: "school" },
    { label: "College", value: "college" },
    { label: "Hospital", value: "hospital" },
    { label: "Clinic", value: "clinic" },
    { label: "Training Centre", value: "training_centre" },
  ],
};

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



const PROJECTS = [
  { label: "Majestan Prestige", value: "majestan_prestige" },
  { label: "Majestan Heights", value: "majestan_heights" },
  { label: "Majestan Residency", value: "majestan_residency" },
  { label: "Majestan Enclave", value: "majestan_enclave" },
  { label: "Majestan Grand", value: "majestan_grand" },
];

function parseIndianCurrency(input: string): number {
  if (!input) return 0;
  const cleanInput = input.toString().toLowerCase().replace(/,/g, '').trim();
  let multiplier = 1;
  let numericStr = cleanInput;

  if (cleanInput.endsWith('cr') || cleanInput.endsWith('crore') || cleanInput.endsWith('crores')) {
    multiplier = 10000000;
    numericStr = cleanInput.replace(/cr(ore)?s?$/, '');
  } else if (cleanInput.endsWith('l') || cleanInput.endsWith('lac') || cleanInput.endsWith('lakh') || cleanInput.endsWith('lakhs')) {
    multiplier = 100000;
    numericStr = cleanInput.replace(/l(akh)?s?|lacs?$/, '');
  } else if (cleanInput.endsWith('k') || cleanInput.endsWith('thousand') || cleanInput.endsWith('thousands')) {
    multiplier = 1000;
    numericStr = cleanInput.replace(/k|thousands?$/, '');
  }

  const val = parseFloat(numericStr);
  return isNaN(val) ? 0 : val * multiplier;
}

function formatIndianCurrencyWords(num: number): string {
  if (!num || isNaN(num) || num === 0) return "";
  
  const cr = Math.floor(num / 10000000);
  const lk = Math.floor((num % 10000000) / 100000);
  const th = Math.floor((num % 100000) / 1000);
  const rem = Math.floor(num % 1000);

  const parts = [];
  if (cr > 0) parts.push(`${cr} Crore${cr > 1 ? 's' : ''}`);
  if (lk > 0) parts.push(`${lk} Lakh${lk > 1 ? 's' : ''}`);
  if (th > 0) parts.push(`${th} Thousand`);
  if (rem > 0) parts.push(`${rem}`);

  return "₹ " + parts.join(' ');
}

function LeadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [cities, setCities] = useState<{ label: string; value: string }[]>([]);
  const [sources, setSources] = useState<{ label: string; value: string }[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  
  const [leadData, setLeadData] = useState<any>(null);
  const [isLoadingLead, setIsLoadingLead] = useState(!!editId);

  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<any>({});
  const [otherSourceText, setOtherSourceText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [followUpDateObj, setFollowUpDateObj] = useState<Date | undefined>(undefined);

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

  useEffect(() => {
    if (editId) {
      fetch(API_URL + "/leads/" + editId)
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            setLeadData(result.data);
            setSelectedSource(result.data.lead_source);
            if (result.data.inquiries?.[0]) {
              setSelectedCategory(result.data.inquiries[0].property_category || null);
              setSelectedType(result.data.inquiries[0].property_type || null);
              setPreferences(result.data.inquiries[0].preferences || {});
            }
          } else {
            toast.error("Lead not found");
            router.push("/leads");
          }
        })
        .catch(() => {
          toast.error("Failed to load lead data");
        })
        .finally(() => setIsLoadingLead(false));
    }
  }, [editId, router]);

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      let sourceValue = formData.get("source") as string;

      if (sourceValue === "others" && otherSourceText.trim()) {
        const res = await fetch(API_URL + "/master/lead-sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: otherSourceText.trim() }),
        });
        const result = await res.json();
        if (result.success) sourceValue = result.data.value;
      }

      let userId: number | undefined;
      try {
        const stored = localStorage.getItem("crm_user");
        if (stored) userId = JSON.parse(stored).id;
      } catch {}

      const payloadPreferences = { ...preferences };
      if (payloadPreferences.minBudget) {
        payloadPreferences.minBudget = parseIndianCurrency(payloadPreferences.minBudget);
      }
      if (payloadPreferences.maxBudget) {
        payloadPreferences.maxBudget = parseIndianCurrency(payloadPreferences.maxBudget);
      }

      const payload = {
        userId,
        name: formData.get("name") as string,
        mobile: formData.get("mobile") as string,
        email: formData.get("email") as string,
        whatsapp: formData.get("whatsapp") as string,
        city: formData.get("city") as string,
        address: formData.get("address") as string,
        source: sourceValue,
        project: formData.get("project") as string,
        purchaseType: formData.get("purchaseType") as string,
        propertyType: selectedType || formData.get("propertyType") as string,
        funder: formData.get("funder") as string,
        propertyCategory: selectedCategory || formData.get("propertyCategory") as string,
        preferences: payloadPreferences,
        followUpDate: followUpDateObj ? format(followUpDateObj, "yyyy-MM-dd") : null,
        followUpTime: followUpDateObj ? format(followUpDateObj, "HH:mm") : null,
        priority: formData.get("priority") as string,
        notes: formData.get("notes") as string,
      };

      const method = editId ? "PUT" : "POST";
      const endpoint = API_URL + (editId ? "/leads/" + editId : "/leads");

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to save lead");
      }

      if (!editId && result.isExistingCustomer) {
        toast.success("Requirement added to existing customer", {
          description: "This mobile number belongs to an existing customer. The new requirement has been logged under their profile. Assigned staff: " + (result.existingStaff ?? "Unassigned"),
          duration: 6000,
        });
      } else {
        toast.success(editId ? "Lead updated successfully!" : "Lead created successfully!");
      }

      router.push("/leads");
    } catch (err: any) {
      toast.error(err.message || "Failed to save lead.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const skeletonField = (
    <div className="h-12 rounded-xl bg-muted/50 animate-pulse flex items-center px-4">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );

  if (isLoadingLead) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
          <p className="text-muted-foreground font-medium">Loading Lead Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between pr-[150px] min-h-[48px]">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => router.push("/leads")}>
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{editId ? "Edit Lead" : "Add New Lead"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {editId ? "Update the details for this prospect." : "Enter the details for the new prospect."}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleAddSubmit} className="space-y-6">
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Customer Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer Name</label>
              <Input name="name" defaultValue={leadData?.name || ""} placeholder="John Doe" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number</label>
              <Input name="mobile" defaultValue={leadData?.mobile_number || ""} placeholder="+91 98765 43210" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Whatsapp Number</label>
              <Input name="whatsapp" defaultValue={leadData?.whatsapp_number || ""} placeholder="+91 98765 43210" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Id</label>
              <Input name="email" defaultValue={leadData?.email || ""} type="email" placeholder="john@example.com" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">City</label>
              {isFetchingData ? skeletonField : <FormSelect name="city" defaultValue={leadData?.city || null} placeholder="Select City" options={cities} required />}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lead Source</label>
              {isFetchingData ? skeletonField : (
                <FormSelect
                  name="source"
                  placeholder="Select Lead Source"
                  options={sources}
                  required
                  defaultValue={leadData?.lead_source || null}
                  value={selectedSource}
                  onValueChange={(v) => setSelectedSource(v)}
                />
              )}
            </div>

            {selectedSource === "others" && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Specify Source</label>
                <Input placeholder="Enter source name" required className="h-12 rounded-xl bg-muted/30" value={otherSourceText} onChange={(e) => setOtherSourceText(e.target.value)} />
              </div>
            )}

            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address</label>
              <Textarea name="address" defaultValue={leadData?.address || ""} placeholder="Enter complete address" className="bg-muted/30 rounded-xl resize-none text-[15px] p-4" rows={3} />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Requirement Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purchase / Service Type</label>
              <FormSelect name="purchaseType" defaultValue={leadData?.inquiries?.[0]?.purchase_type || null} placeholder="Select Purchase Type" options={PURCHASE_TYPES} required />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Category</label>
              <FormSelect 
                name="propertyCategory" 
                defaultValue={leadData?.inquiries?.[0]?.property_category || null} 
                value={selectedCategory}
                onValueChange={(val) => {
                  setSelectedCategory(val);
                  setSelectedType(null);
                }}
                placeholder="Select Property Category" 
                options={PROPERTY_CATEGORIES} 
                required 
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Type</label>
              <FormSelect 
                name="propertyType" 
                defaultValue={leadData?.inquiries?.[0]?.property_type || null} 
                value={selectedType}
                onValueChange={setSelectedType}
                placeholder={selectedCategory ? "Select Property Type" : "Select Category First"} 
                options={selectedCategory ? PROPERTY_TYPES_MAP[selectedCategory] || [] : []} 
                disabled={!selectedCategory}
                required 
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Funding</label>
              <FormSelect name="funder" defaultValue={leadData?.inquiries?.[0]?.funder || null} placeholder="Select Funding" options={FUNDERS} required />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project List</label>
              <FormSelect name="project" defaultValue={leadData?.inquiries?.[0]?.project_list || null} placeholder="Select Project" options={PROJECTS} />
            </div>
          </div>
        </div>

          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Customer Preferences</h3>
            
            {!selectedCategory ? (
              <div className="text-center py-8 text-muted-foreground">
                Please select a Property Category above to define customer preferences.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Min Budget</label>
                  <Input type="text" placeholder="e.g. 2.5Cr or 50L" value={preferences?.minBudget || ""} onChange={e => setPreferences({...preferences, minBudget: e.target.value})} className="h-12 rounded-xl bg-muted/30" />
                  {preferences?.minBudget && parseIndianCurrency(preferences.minBudget) > 0 && (
                    <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 pl-1">
                      {formatIndianCurrencyWords(parseIndianCurrency(preferences.minBudget))}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Max Budget</label>
                  <Input type="text" placeholder="e.g. 3Cr or 75L" value={preferences?.maxBudget || ""} onChange={e => setPreferences({...preferences, maxBudget: e.target.value})} className="h-12 rounded-xl bg-muted/30" />
                  {preferences?.maxBudget && parseIndianCurrency(preferences.maxBudget) > 0 && (
                    <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 pl-1">
                      {formatIndianCurrencyWords(parseIndianCurrency(preferences.maxBudget))}
                    </p>
                  )}
                </div>

                {selectedCategory === "residential" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">BHK</label>
                      <FormSelect name="_bhk" placeholder="Select BHK" options={[{label: "1", value: "1"}, {label: "2", value: "2"}, {label: "3", value: "3"}, {label: "4+", value: "4"}]} value={preferences?.bhk || null} onValueChange={v => setPreferences({...preferences, bhk: v})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Furnishing</label>
                      <FormSelect name="_furnishing" placeholder="Select" options={[{label: "Furnished", value: "1"}, {label: "Unfurnished", value: "0"}]} value={preferences?.furnished || null} onValueChange={v => setPreferences({...preferences, furnished: v})} />
                    </div>
                  </>
                )}

                {['commercial', 'industrial', 'agricultural', 'institutional'].includes(selectedCategory) && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Min Area</label>
                      <Input type="number" placeholder="Min Area" value={preferences?.minArea || ""} onChange={e => setPreferences({...preferences, minArea: e.target.value})} className="h-12 rounded-xl bg-muted/30" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Max Area</label>
                      <Input type="number" placeholder="Max Area" value={preferences?.maxArea || ""} onChange={e => setPreferences({...preferences, maxArea: e.target.value})} className="h-12 rounded-xl bg-muted/30" />
                    </div>
                  </>
                )}

              </div>
            )}
          </div>

        {!editId && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <div className="flex items-center justify-between border-b pb-4 mb-6">
              <h3 className="text-lg font-bold text-foreground">New Follow Up</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          <Button type="button" variant="ghost" className="h-12 px-8 rounded-xl font-medium text-[15px]" onClick={() => router.push("/leads")} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="h-12 px-10 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-lg font-semibold flex items-center gap-2 text-[15px] active:scale-[0.97]">
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (editId ? <Save size={18} /> : <CheckCircle2 size={18} />)}
            {isSubmitting ? "Saving..." : (editId ? "Update Lead" : "Create Lead")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewLeadPage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" /></div>}>
      <LeadForm />
    </Suspense>
  );
}
