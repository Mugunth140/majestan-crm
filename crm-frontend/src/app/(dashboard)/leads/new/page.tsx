"use client";

import { apiFetch } from "@/lib/api-fetch";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Loader2, Save, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { 
  PURCHASE_TYPES, PURCHASE_TIMELINES, QUALIFICATION_PURPOSES, 
  PROPERTY_CATEGORIES, PROPERTY_TYPES_MAP, FUNDERS, PROJECTS 
} from "@/lib/lead-constants";
import { MobileHeader } from "@/components/layout/mobile-header";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
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

  const [cities, setCities] = useState<{ id: number; city_name: string }[]>([]);
  const [sources, setSources] = useState<{ label: string; value: string }[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  
  const [subLocations, setSubLocations] = useState<{ id: number; locality_name: string }[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [selectedSubLocations, setSelectedSubLocations] = useState<string[]>([]);
  
  const [leadData, setLeadData] = useState<any>(null);
  const [isLoadingLead, setIsLoadingLead] = useState(!!editId);

  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<any>({});
  const [otherSourceText, setOtherSourceText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReferral, setIsReferral] = useState(false);
  
  const [followUpDateObj, setFollowUpDateObj] = useState<Date | undefined>(undefined);

  // User state for routing modal
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isFetchingStaff, setIsFetchingStaff] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("crm_user");
        if (stored) setCurrentUser(JSON.parse(stored));
      } catch {}
    }
  }, []);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        setIsFetchingData(true);
        const [cityRes, sourceRes] = await Promise.all([
          apiFetch(API_URL + "/leads/cities"),
          apiFetch(API_URL + "/master/lead-sources"),
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
    if (selectedCityId) {
      apiFetch(API_URL + "/leads/sublocations?city_id=" + selectedCityId)
        .then(res => res.json())
        .then(data => {
          if (data.success) setSubLocations(data.data);
        })
        .catch(() => toast.error("Failed to load sub-locations."));
    } else {
      setSubLocations([]);
    }
  }, [selectedCityId]);

  useEffect(() => {
    if (editId) {
      apiFetch(API_URL + "/leads/" + editId)
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            setLeadData(result.data);
            setIsReferral(!!result.data.is_referral);
            setSelectedSource(result.data.lead_source);
            if (result.data.inquiries?.[0]) {
              const inq = result.data.inquiries[0];
              setSelectedCategory(inq.property_category || null);
              setSelectedType(inq.property_type || null);
              setPreferences(inq.preferences || {});
              if (inq.city_id) setSelectedCityId(inq.city_id);
              if (inq.sub_locations) setSelectedSubLocations(inq.sub_locations);
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

    if (followUpDateObj) {
      const diffTime = Math.abs(followUpDateObj.getTime() - new Date().getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 45) {
        toast.error("Follow-up date cannot be more than 45 days in the future.");
        return;
      }
    }
    
    // If we're creating a NEW lead, intercept submission to show Assignment Modal
    if (!editId) {
      setPendingFormData(new FormData(e.currentTarget));
      setIsAssignModalOpen(true);
      
      // If user is Admin/TL, fetch staff list for the dropdown
      if (currentUser?.role?.name !== "Staff") {
        setIsFetchingStaff(true);
        try {
          // If Admin/Manager, pass 'all', else pass TL's department
          const isCrossDept = currentUser?.role?.name === "Admin" || currentUser?.role?.name === "Manager";
          const deptQuery = isCrossDept ? "all" : (currentUser?.department?.name || "");
          const res = await apiFetch(`${API_URL}/lead-routing/staff-list?department=${encodeURIComponent(deptQuery.toLowerCase())}`);
          const data = await res.json();
          if (data.success) {
            setStaffList(data.data);
          }
        } catch {
          toast.error("Failed to load staff list");
        } finally {
          setIsFetchingStaff(false);
        }
      }
      return;
    }
    
    // If editing, proceed directly
    await executeSubmission(new FormData(e.currentTarget), undefined);
  };

  const executeSubmission = async (formData: FormData, finalAssigneeId?: number | null) => {
    setIsSubmitting(true);

    try {
      let sourceValue = formData.get("source") as string;

      if (sourceValue === "others" && otherSourceText.trim()) {
        const res = await apiFetch(API_URL + "/master/lead-sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: otherSourceText.trim() }),
        });
        const result = await res.json();
        if (result.success) sourceValue = result.data.value;
      }

      // Determine the assigned user based on modal choice or edit state
      let assignedUserId = finalAssigneeId;
      if (editId) {
         // Keep existing logic for edit - typically we don't change assignment on edit unless specified
         // But payload currently sends current user. If editing, we shouldn't send userId at all actually,
         // but let's preserve the existing behavior for editId:
         assignedUserId = undefined; 
      }

      const payloadPreferences = { ...preferences };
      if (payloadPreferences.minBudget) {
        payloadPreferences.minBudget = parseIndianCurrency(payloadPreferences.minBudget);
      }
      if (payloadPreferences.maxBudget) {
        payloadPreferences.maxBudget = parseIndianCurrency(payloadPreferences.maxBudget);
      }

      const payload = {
        userId: assignedUserId,
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
        cityId: selectedCityId,
        subLocations: selectedSubLocations.length > 0 ? selectedSubLocations : null,
        purchaseTimeline: formData.get("purchaseTimeline") as string,
        qualificationPurpose: formData.get("qualificationPurpose") as string,
        decisionMaker: formData.get("decisionMaker") as string,
        followUpDate: followUpDateObj ? format(followUpDateObj, "yyyy-MM-dd") : null,
        followUpTime: followUpDateObj ? format(followUpDateObj, "HH:mm") : null,
        priority: formData.get("priority") as string,
        notes: formData.get("notes") as string,
        commission: formData.get("commission") ? parseFloat(formData.get("commission") as string) : null,
        commissionRemarks: formData.get("commission_remarks") as string,
        isReferral: isReferral,
        referredByName: formData.get("referredByName") as string,
        referredByContact: formData.get("referredByContact") as string,
      };

      const method = editId ? "PUT" : "POST";
      const endpoint = API_URL + (editId ? "/leads/" + editId : "/leads");

      const res = await apiFetch(endpoint, {
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

      if (assignedUserId === null && !editId) {
        router.push("/lead-routing");
      } else {
        router.push("/leads");
      }
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
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2.5 md:px-0 mt-2 md:mt-0 mb-20 md:mb-0">
      <MobileHeader title={editId ? "Edit Lead" : "Add Lead"} showBack />
      <div className="hidden md:flex items-center justify-between pr-[150px] min-h-[48px]">
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
              {isFetchingData ? skeletonField : (
                <FormSelect 
                  name="city" 
                  defaultValue={leadData?.city || null} 
                  placeholder="Select City" 
                  options={cities.map(c => ({ label: c.city_name, value: c.city_name }))} 
                  required 
                />
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

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Commission (%)</label>
              <Input type="number" step="0.1" name="commission" defaultValue={leadData?.commission || ""} placeholder="e.g. 1.5" className="h-12 rounded-xl bg-muted/30" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Commission Remarks</label>
              <Textarea
                name="commission_remarks"
                defaultValue={leadData?.commission_remarks || ""}
                placeholder="e.g. Negotiable upon closing, split with co-broker..."
                className="bg-muted/30 rounded-xl resize-none text-[15px] p-4"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Referral</label>
              <FormSelect
                name="isReferral"
                placeholder="Select"
                options={[{label: "Yes", value: "yes"}, {label: "No", value: "no"}]}
                value={isReferral ? "yes" : "no"}
                onValueChange={(v) => setIsReferral(v === "yes")}
              />
            </div>
            <div className="space-y-2"></div> {/* Spacer to keep grid aligned */}

            {isReferral && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Referred Person Name</label>
                  <Input name="referredByName" defaultValue={leadData?.referred_by_name || ""} placeholder="Name" required className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Number</label>
                  <Input name="referredByContact" defaultValue={leadData?.referred_by_contact || ""} placeholder="Contact Number" required className="h-12 rounded-xl bg-muted/30" />
                </div>
              </>
            )}
          </div>
        </div>

        {editId ? (
          <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-6 text-center shadow-sm">
            <h3 className="text-blue-900 dark:text-blue-400 font-semibold mb-2">Edit Customer Requirements</h3>
            <p className="text-blue-700/80 dark:text-blue-300/80 text-[14px]">
              To edit specific requirements, buyer qualifications, or preferences, please visit the lead's detailed view page.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/leads/${editId}`)}
              className="mt-4 border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/40 dark:bg-transparent"
            >
              Go to Detailed View
            </Button>
          </div>
        ) : (
          <>
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
              <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Buyer Qualification</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target City</label>
                  {isFetchingData ? skeletonField : (
                    <FormSelect
                      name="cityId"
                      placeholder="Select City"
                      options={cities.map((c) => ({ label: c.city_name, value: c.id.toString() }))}
                      value={selectedCityId?.toString() || ""}
                      onValueChange={(val) => {
                        setSelectedCityId(val ? Number(val) : null);
                        setSelectedSubLocations([]);
                      }}
                    />
                  )}
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sub Locations (Multiple)</label>
                  <div className="flex flex-wrap gap-2 p-3 min-h-[48px] rounded-xl bg-muted/30 border border-border/60 max-h-[150px] overflow-y-auto">
                    {!selectedCityId ? (
                      <span className="text-sm text-muted-foreground">Select a city first...</span>
                    ) : subLocations.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No sub-locations found.</span>
                    ) : (
                      subLocations.map((sub) => {
                        const isSelected = selectedSubLocations.includes(sub.locality_name);
                        return (
                          <button
                            type="button"
                            key={sub.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedSubLocations(selectedSubLocations.filter(loc => loc !== sub.locality_name));
                              } else {
                                setSelectedSubLocations([...selectedSubLocations, sub.locality_name]);
                              }
                            }}
                            className={`px-3 py-1 text-[13px] rounded-full border transition-colors ${
                              isSelected 
                                ? "bg-[#0052FF] text-white border-[#0052FF] shadow-sm" 
                                : "bg-background text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            {sub.locality_name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purchase Timeline</label>
                  <FormSelect
                    name="purchaseTimeline"
                    defaultValue={leadData?.inquiries?.[0]?.purchase_timeline || null}
                    placeholder="Select Timeline"
                    options={PURCHASE_TIMELINES}
                  />
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Qualification Purpose</label>
                  <FormSelect
                    name="qualificationPurpose"
                    defaultValue={leadData?.inquiries?.[0]?.qualification_purpose || null}
                    placeholder="Select Purpose"
                    options={QUALIFICATION_PURPOSES}
                  />
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Decision Maker</label>
                  <FormSelect
                    name="decisionMaker"
                    defaultValue={leadData?.inquiries?.[0]?.decision_maker || null}
                    placeholder="Select Decision Maker"
                    options={[
                      { label: "Self", value: "Self" },
                      { label: "Spouse", value: "Spouse" },
                      { label: "Father", value: "Father" },
                      { label: "Mother", value: "Mother" },
                      { label: "Son", value: "Son" },
                      { label: "Daughter", value: "Daughter" },
                      { label: "Brother", value: "Brother" },
                      { label: "Sister", value: "Sister" },
                      { label: "Father-in-law", value: "Father-in-law" },
                      { label: "Mother-in-law", value: "Mother-in-law" },
                      { label: "Business Partner", value: "Business Partner" },
                      { label: "Joint Family", value: "Joint Family" },
                      { label: "Other Relative", value: "Other Relative" },
                    ]}
                  />
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
                        <FormSelect name="_furnishing" placeholder="Select" options={[{label: "Furnished", value: "1"}, {label: "Semi Furnished", value: "2"}, {label: "Unfurnished", value: "0"}]} value={preferences?.furnished || null} onValueChange={v => setPreferences({...preferences, furnished: v})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Floor Number</label>
                        <Input type="text" placeholder="e.g. Ground, 1st, High" value={preferences?.floorNumber || ""} onChange={e => setPreferences({...preferences, floorNumber: e.target.value})} className="h-12 rounded-xl bg-muted/30" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Facing</label>
                        <FormSelect 
                          name="_facing" 
                          placeholder="Select Facing" 
                          options={[
                            {label: "North", value: "North"}, 
                            {label: "East", value: "East"}, 
                            {label: "South", value: "South"}, 
                            {label: "West", value: "West"}, 
                            {label: "North-East (NE)", value: "North-East"},
                            {label: "North-West (NW)", value: "North-West"},
                            {label: "South-East (SE)", value: "South-East"},
                            {label: "South-West (SW)", value: "South-West"},
                            {label: "Any", value: "Any"}
                          ]} 
                          value={preferences?.facing || null} 
                          onValueChange={v => setPreferences({...preferences, facing: v})} 
                        />
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
          </>
        )}

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

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 pb-4 md:pb-0">
          <Button type="button" variant="ghost" className="h-12 px-8 rounded-xl font-medium text-[15px] w-full sm:w-auto" onClick={() => router.push("/leads")} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="h-12 px-10 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-lg font-semibold flex items-center gap-2 text-[15px] active:scale-[0.97] w-full sm:w-auto">
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (editId ? <Save size={18} /> : <CheckCircle2 size={18} />)}
            {isSubmitting ? "Saving..." : (editId ? "Update Lead" : "Create Lead")}
          </Button>
        </div>
      </form>

      {/* Assignment Modal for New Leads */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-bold">Assign this Lead</DialogTitle>
            <DialogDescription className="text-muted-foreground pt-1">
              Where should this new lead be routed?
            </DialogDescription>
          </DialogHeader>

          {currentUser?.role?.name === "Staff" ? (
            <div className="flex flex-col gap-3 py-4">
              <Button 
                onClick={() => {
                  setIsAssignModalOpen(false);
                  if (pendingFormData) executeSubmission(pendingFormData, currentUser?.id);
                }} 
                className="h-14 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 justify-start px-5 font-semibold text-[15px]"
                variant="outline"
              >
                <User className="mr-3 h-5 w-5 text-primary" />
                Assign to Myself
              </Button>
              <Button 
                onClick={() => {
                  setIsAssignModalOpen(false);
                  if (pendingFormData) executeSubmission(pendingFormData, null);
                }} 
                className="h-14 justify-start px-5 font-semibold text-[15px]"
                variant="outline"
              >
                <div className="mr-3 h-5 w-5 flex items-center justify-center rounded bg-muted">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">RQ</span>
                </div>
                Add to Routing Queue (Unassigned)
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Staff Member</label>
                <FormSelect 
                  name="assignee"
                  options={staffList.map(s => ({ label: `${s.name} (${s.department?.name || 'No Dept'})`, value: s.id.toString() }))}
                  value={assigneeId ? assigneeId.toString() : ""}
                  onValueChange={(v) => setAssigneeId(v ? parseInt(v) : null)}
                  placeholder={isFetchingStaff ? "Loading staff..." : "Select to assign directly..."}
                  disabled={isFetchingStaff}
                />
              </div>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-muted" />
                <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs uppercase font-bold">OR</span>
                <div className="flex-grow border-t border-muted" />
              </div>

              <Button 
                onClick={() => {
                  setIsAssignModalOpen(false);
                  if (pendingFormData) executeSubmission(pendingFormData, null);
                }} 
                className="w-full h-12 font-semibold text-[14px]"
                variant="outline"
              >
                Add to Routing Queue (Unassigned)
              </Button>
            </div>
          )}

          <DialogFooter className="mt-2 pt-4 border-t sm:justify-between">
            <Button variant="ghost" className="rounded-xl" onClick={() => setIsAssignModalOpen(false)}>
              Back to Form
            </Button>
            {currentUser?.role?.name !== "Staff" && (
              <Button 
                disabled={!assigneeId}
                onClick={() => {
                  setIsAssignModalOpen(false);
                  if (pendingFormData) executeSubmission(pendingFormData, assigneeId);
                }}
                className="rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC]"
              >
                Assign & Create
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
