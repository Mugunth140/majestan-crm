"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, CheckCircle2, Loader2, Save, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { FormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { TimePicker } from "@/components/shared/time-picker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

const PURPOSES = [
  { label: "Sale", value: "Sale" },
  { label: "Rent", value: "Rent" },
  { label: "Lease", value: "Lease" },
];

const STATUSES = [
  { label: "New Inbound", value: "New Inbound" },
  { label: "Contacting Owner", value: "Contacting Owner" },
  { label: "Terms not Accepted", value: "Terms not Accepted" },
  { label: "On Hold", value: "On Hold" },
  { label: "Pending Verification", value: "Pending Verification" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
  { label: "Closed", value: "Closed" },
];

const PRIMARY_CONTACTS = [
  { label: "Owner", value: "Owner" },
  { label: "Building Manager", value: "Building Manager" },
  { label: "Caretaker", value: "Caretaker" },
  { label: "Security", value: "Security" },
  { label: "Broker", value: "Broker" },
];

const KEY_AVAILABLE_WITH = [
  { label: "Owner", value: "Owner" },
  { label: "Manager", value: "Manager" },
  { label: "Security", value: "Security" },
  { label: "Tenant", value: "Tenant" },
];

const BROKERAGE_ACCEPTED = [
  { label: "Yes", value: "Yes" },
  { label: "No", value: "No" },
  { label: "Negotiable", value: "Negotiable" },
];

const BROKERAGE_PAID_BY_OPTIONS = ["Owner", "Buyer", "Tenant"];

const BROKERAGE_TYPES = [
  { label: "Percentage", value: "Percentage" },
  { label: "Fixed", value: "Fixed" },
];

const FLOOR_APPLICABLE_TYPES = [
  "apartment", "builder_floor", "office", "shop", "showroom", "commercial_building", 
  "hotel", "restaurant", "school", "college", "hospital", "clinic", "training_centre"
];

function InboundForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cities, setCities] = useState<{ label: string; value: string }[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  
  const [inboundData, setInboundData] = useState<any>(null);
  const [isLoadingInbound, setIsLoadingInbound] = useState(!!editId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for conditional logic
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);
  const [primaryContact, setPrimaryContact] = useState<string | null>(null);
  
  // Brokerage States
  const [brokerageAccepted, setBrokerageAccepted] = useState<string | null>(null);
  const [brokeragePaidBy, setBrokeragePaidBy] = useState<string[]>([]);
  const [brokerageType, setBrokerageType] = useState<string | null>(null);

  const [preferredContactTime, setPreferredContactTime] = useState<string | undefined>(undefined);

  // Checkbox States
  const [panAvailable, setPanAvailable] = useState(false);
  const [gstApplicable, setGstApplicable] = useState(false);
  const [priorAppointmentRequired, setPriorAppointmentRequired] = useState(false);
  const [isExclusive, setIsExclusive] = useState(false);
  const [isPrimeLocation, setIsPrimeLocation] = useState(false);
  const [documentsCollected, setDocumentsCollected] = useState(false);

  // File
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        setIsFetchingData(true);
        const cityRes = await fetch(API_URL + "/master/cities");
        const cityData = await cityRes.json();
        if (cityData.success) setCities(cityData.data);
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
      fetch(API_URL + "/inbounds/" + editId)
        .then((res) => res.json())
        .then((result) => {
          if (result) {
            const data = result;
            setInboundData(data);
            setSelectedCategory(data.property_category || null);
            setSelectedType(data.property_type || null);
            setSelectedPurpose(data.purpose || null);
            setPrimaryContact(data.primary_contact || null);
            
            setBrokerageAccepted(data.brokerage_accepted || null);
            if (data.brokerage_paid_by) {
               try {
                 const parsed = Array.isArray(data.brokerage_paid_by) ? data.brokerage_paid_by : JSON.parse(data.brokerage_paid_by);
                 setBrokeragePaidBy(parsed || []);
               } catch {
                 setBrokeragePaidBy([]);
               }
            }
            setBrokerageType(data.brokerage_type || null);
            
            if (data.preferred_contact_time) {
               setPreferredContactTime(data.preferred_contact_time);
            }

            setPanAvailable(!!data.pan_available);
            setGstApplicable(!!data.gst_applicable);
            setPriorAppointmentRequired(!!data.prior_appointment_required);
            setIsExclusive(!!data.is_exclusive);
            setIsPrimeLocation(!!data.is_prime_location);
            setDocumentsCollected(!!data.documents_collected);
          } else {
            toast.error("Inbound not found");
            router.push("/inbound");
          }
        })
        .catch(() => {
          toast.error("Failed to load inbound property data");
        })
        .finally(() => setIsLoadingInbound(false));
    }
  }, [editId, router]);

  const toggleBrokeragePaidBy = (val: string) => {
    setBrokeragePaidBy(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const payload: any = {};
      
      // Convert FormData to object
      formData.forEach((value, key) => {
        payload[key] = value;
      });

      // Override with controlled values
      payload.property_category = selectedCategory;
      payload.property_type = selectedType;
      payload.purpose = selectedPurpose;
      payload.special_purpose = formData.get("special_purpose") || null;
      payload.budget_details = formData.get("budget_details") || null;
      payload.floor_number = formData.get("floor_number") || null;
      payload.brokerage_days = formData.get("brokerage_days") ? parseInt(formData.get("brokerage_days") as string, 10) : null;
      payload.primary_contact = primaryContact;
      payload.security_name = formData.get("security_name") || null;
      payload.broker_name = formData.get("broker_name") || null;
      payload.broker_mobile = formData.get("broker_mobile") || null;
      payload.brokerage_accepted = brokerageAccepted;
      payload.brokerage_paid_by = brokeragePaidBy;
      payload.brokerage_type = brokerageType;
      payload.preferred_contact_time = preferredContactTime || null;

      payload.pan_available = panAvailable;
      payload.gst_applicable = gstApplicable;
      payload.prior_appointment_required = priorAppointmentRequired;
      payload.is_exclusive = isExclusive;
      payload.is_prime_location = isPrimeLocation;
      payload.documents_collected = documentsCollected;

      if (payload.percentage === "") payload.percentage = null;
      if (payload.fixed_amount === "") payload.fixed_amount = null;

      const method = editId ? "PATCH" : "POST";
      const endpoint = API_URL + (editId ? "/inbounds/" + editId : "/inbounds");

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || "Failed to save inbound");
      }

      // Handle Image Upload
      if (selectedFile) {
         const fileData = new FormData();
         fileData.append('file', selectedFile);
         const uploadId = editId ? editId : result.id;
         
         const uploadRes = await fetch(`${API_URL}/inbounds/${uploadId}/image`, {
            method: 'POST',
            body: fileData
         });
         
         if (!uploadRes.ok) {
            toast.error("InBound saved, but image upload failed.");
         }
      }

      toast.success(editId ? "Inbound updated successfully!" : "Inbound created successfully!");
      router.push("/inbound");
    } catch (err: any) {
      toast.error(err.message || "Failed to save inbound.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const skeletonField = (
    <div className="h-12 rounded-xl bg-muted/50 animate-pulse flex items-center px-4">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );

  if (isLoadingInbound) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
          <p className="text-muted-foreground font-medium">Loading Inbound Data...</p>
        </div>
      </div>
    );
  }

  const showRentalBrokerage = selectedPurpose === 'Rent' || selectedPurpose === 'Lease';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between pr-[150px] min-h-[48px]">
        <div className="flex items-center gap-4">
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => router.push("/inbound")}>
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{editId ? "Edit Inbound" : "Add Inbound"}</h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Basic Information */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2 lg:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Title</label>
              <Input name="property_title" defaultValue={inboundData?.property_title || ""} placeholder="e.g. 3 BHK Luxury Apartment in Downtown" required className="h-12 rounded-xl bg-muted/30" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Category</label>
              <FormSelect 
                name="_property_category" 
                defaultValue={inboundData?.property_category || null} 
                value={selectedCategory}
                onValueChange={(val) => {
                  setSelectedCategory(val);
                  setSelectedType(null);
                }}
                placeholder="Select Category" 
                options={PROPERTY_CATEGORIES} 
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Type</label>
              <FormSelect 
                name="_property_type" 
                defaultValue={inboundData?.property_type || null} 
                value={selectedType}
                onValueChange={setSelectedType}
                placeholder={selectedCategory ? "Select Type" : "Select Category First"} 
                options={selectedCategory ? PROPERTY_TYPES_MAP[selectedCategory] || [] : []} 
                disabled={!selectedCategory}
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purpose</label>
              <FormSelect 
                name="_purpose" 
                value={selectedPurpose}
                onValueChange={setSelectedPurpose}
                placeholder="Sale / Rent / Lease" 
                options={PURPOSES} 
                required 
              />
            </div>
            
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Special Purpose (Optional)</label>
              <Input name="special_purpose" defaultValue={inboundData?.special_purpose || ""} placeholder="e.g. Renting for Grocery shop" className="h-12 rounded-xl bg-muted/30" />
            </div>
            
            <div className="space-y-2 lg:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Budget Details (Optional)</label>
              <Input name="budget_details" defaultValue={inboundData?.budget_details || ""} placeholder="e.g. Max budget is 50,000 / month" className="h-12 rounded-xl bg-muted/30" />
            </div>

            {selectedType && FLOOR_APPLICABLE_TYPES.includes(selectedType) && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Floor Number</label>
                <Input name="floor_number" defaultValue={inboundData?.floor_number || ""} placeholder="e.g. Ground, 1st, Multiple" className="h-12 rounded-xl bg-muted/30" />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</label>
              <FormSelect name="status" defaultValue={inboundData?.status || "New Inbound"} placeholder="Select Status" options={STATUSES} required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">State</label>
              <Input name="state" defaultValue={inboundData?.state || "Tamil Nadu"} placeholder="Enter State" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">City</label>
              {isFetchingData ? skeletonField : <FormSelect name="city" defaultValue={inboundData?.city || null} placeholder="Select City" options={cities} required />}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Area</label>
              <Input name="area" defaultValue={inboundData?.area || ""} placeholder="e.g. 1500 sqft" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Locality</label>
              <Input name="locality" defaultValue={inboundData?.locality || ""} placeholder="Enter Locality" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Landmark</label>
              <Input name="landmark" defaultValue={inboundData?.landmark || ""} placeholder="Enter Landmark" className="h-12 rounded-xl bg-muted/30" />
            </div>

            <div className="space-y-2 lg:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Google Map Location</label>
              <Input name="google_map_location" defaultValue={inboundData?.google_map_location || ""} placeholder="Paste Google Maps Link" className="h-12 rounded-xl bg-muted/30" />
            </div>
          </div>
        </div>

        {/* Owner Information */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Owner Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Owner Name</label>
              <Input name="owner_name" defaultValue={inboundData?.owner_name || ""} placeholder="Enter Owner Name" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number</label>
              <Input name="mobile_number" defaultValue={inboundData?.mobile_number || ""} placeholder="+91 98765 43210" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Whatsapp Number</label>
              <Input name="whatsapp_number" defaultValue={inboundData?.whatsapp_number || ""} placeholder="+91 98765 43210" className="h-12 rounded-xl bg-muted/30" />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Id</label>
              <Input name="email" defaultValue={inboundData?.email || ""} type="email" placeholder="owner@example.com" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Alternate Contact</label>
              <Input name="alternate_contact" defaultValue={inboundData?.alternate_contact || ""} placeholder="Alternate Number" className="h-12 rounded-xl bg-muted/30" />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preferred Contact Time</label>
              <TimePicker
                value={preferredContactTime}
                onChange={setPreferredContactTime}
                placeholder="Pick time"
              />
            </div>
            <div className="space-y-2 lg:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address</label>
              <Textarea name="address" defaultValue={inboundData?.address || ""} placeholder="Enter owner address" className="bg-muted/30 rounded-xl resize-none text-[15px] p-4" rows={2} />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox id="panAvailable" checked={panAvailable} onCheckedChange={(c) => setPanAvailable(!!c)} />
              <label htmlFor="panAvailable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                PAN Available
              </label>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox id="gstApplicable" checked={gstApplicable} onCheckedChange={(c) => setGstApplicable(!!c)} />
              <label htmlFor="gstApplicable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                GST Applicable
              </label>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Contact & Accessibility Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Primary Contact</label>
              <FormSelect 
                name="_primary_contact" 
                value={primaryContact}
                onValueChange={setPrimaryContact}
                placeholder="Select Contact" 
                options={PRIMARY_CONTACTS} 
                required
              />
            </div>

            {primaryContact === "Building Manager" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Manager Name</label>
                  <Input name="building_manager_name" defaultValue={inboundData?.building_manager_name || ""} placeholder="Name" required className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Manager Mobile</label>
                  <Input name="manager_mobile" defaultValue={inboundData?.manager_mobile || ""} placeholder="Mobile" required className="h-12 rounded-xl bg-muted/30" />
                </div>
              </>
            )}

            {primaryContact === "Caretaker" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Caretaker Name</label>
                  <Input name="caretaker_name" defaultValue={inboundData?.caretaker_name || ""} placeholder="Name" required className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Caretaker Mobile</label>
                  <Input name="caretaker_mobile" defaultValue={inboundData?.caretaker_mobile || ""} placeholder="Mobile" required className="h-12 rounded-xl bg-muted/30" />
                </div>
              </>
            )}

            {primaryContact === "Security" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Security Name</label>
                  <Input name="security_name" defaultValue={inboundData?.security_name || ""} placeholder="Name" required className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Security Contact</label>
                  <Input name="security_contact" defaultValue={inboundData?.security_contact || ""} placeholder="Contact Info" required className="h-12 rounded-xl bg-muted/30" />
                </div>
              </>
            )}

            {primaryContact === "Broker" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Broker Name</label>
                  <Input name="broker_name" defaultValue={inboundData?.broker_name || ""} placeholder="Name" required className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Broker Mobile</label>
                  <Input name="broker_mobile" defaultValue={inboundData?.broker_mobile || ""} placeholder="Mobile" required className="h-12 rounded-xl bg-muted/30" />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Key Available With</label>
              <FormSelect name="key_available_with" defaultValue={inboundData?.key_available_with || null} placeholder="Select" options={KEY_AVAILABLE_WITH} required />
            </div>
            
            <div className="flex items-center space-x-2 lg:col-span-2 pt-6">
              <Checkbox id="priorAppointment" checked={priorAppointmentRequired} onCheckedChange={(c) => setPriorAppointmentRequired(!!c)} />
              <label htmlFor="priorAppointment" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Prior Appointment Required
              </label>
            </div>
          </div>
        </div>

        {/* Brokerage Details */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Brokerage Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Brokerage Accepted</label>
              <FormSelect 
                name="_brokerage_accepted" 
                value={brokerageAccepted}
                onValueChange={setBrokerageAccepted}
                placeholder="Select" 
                options={BROKERAGE_ACCEPTED} 
                required
              />
            </div>

            {(brokerageAccepted === "Yes" || brokerageAccepted === "Negotiable") && (
              <>
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">Brokerage Paid By</label>
                  <div className="flex flex-wrap gap-4">
                     {BROKERAGE_PAID_BY_OPTIONS.map(opt => (
                        <div key={opt} className="flex items-center space-x-2 bg-muted/20 border border-border/50 px-4 py-2 rounded-xl">
                          <Checkbox 
                            id={`paidby-${opt}`} 
                            checked={brokeragePaidBy.includes(opt)}
                            onCheckedChange={() => toggleBrokeragePaidBy(opt)}
                          />
                          <label htmlFor={`paidby-${opt}`} className="text-sm font-medium cursor-pointer">
                            {opt}
                          </label>
                        </div>
                     ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Brokerage Type</label>
                  <FormSelect 
                     name="_brokerage_type" 
                     value={brokerageType}
                     onValueChange={setBrokerageType}
                     placeholder="Select Type" 
                     options={BROKERAGE_TYPES} 
                  />
                </div>

                {brokerageType === "Percentage" && (
                   <div className="space-y-2">
                     <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Percentage (%)</label>
                     <Input type="number" step="0.1" name="percentage" defaultValue={inboundData?.percentage || ""} placeholder="e.g. 2" className="h-12 rounded-xl bg-muted/30" />
                   </div>
                )}
                
                {brokerageType === "Fixed" && (
                   <div className="space-y-2">
                     <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fixed Amount (₹)</label>
                     <Input type="number" name="fixed_amount" defaultValue={inboundData?.fixed_amount || ""} placeholder="e.g. 50000" className="h-12 rounded-xl bg-muted/30" />
                   </div>
                )}

                {showRentalBrokerage && (
                   <div className="space-y-2">
                     <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Brokerage Days</label>
                     <Input type="number" name="brokerage_days" defaultValue={inboundData?.brokerage_days || ""} placeholder="e.g. 15" className="h-12 rounded-xl bg-muted/30" />
                   </div>
                )}

                <div className="space-y-2 lg:col-span-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Brokerage Remarks</label>
                  <Textarea name="brokerage_remarks" defaultValue={inboundData?.brokerage_remarks || ""} placeholder="Additional notes regarding brokerage..." className="bg-muted/30 rounded-xl resize-none text-[15px] p-4" rows={2} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Media & Inventory */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Media & Inventory Flags</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-b pb-8">
            <div>
               <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Property Photo (Max 5MB)</label>
               {inboundData?.image_url && !selectedFile && (
                  <div className="mb-3">
                     <img src={inboundData.image_url} alt="Property" className="w-full max-w-[250px] h-32 object-cover rounded-xl border border-border/60" />
                     <p className="text-xs text-muted-foreground mt-1">Current Image. Upload new to replace.</p>
                  </div>
               )}
               <div className="flex items-center gap-4">
                  <Input 
                     ref={fileInputRef}
                     type="file" 
                     accept="image/*"
                     onChange={handleFileChange}
                     className="max-w-[300px] cursor-pointer"
                  />
                  {selectedFile && <span className="text-sm font-medium text-blue-600">{selectedFile.name}</span>}
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="flex items-center space-x-2 bg-muted/10 border border-border/40 p-4 rounded-xl">
               <Checkbox id="exclusive" checked={isExclusive} onCheckedChange={(c) => setIsExclusive(!!c)} />
               <label htmlFor="exclusive" className="text-sm font-semibold cursor-pointer">
                 Exclusive Property
               </label>
             </div>
             
             <div className="flex items-center space-x-2 bg-muted/10 border border-border/40 p-4 rounded-xl">
               <Checkbox id="prime" checked={isPrimeLocation} onCheckedChange={(c) => setIsPrimeLocation(!!c)} />
               <label htmlFor="prime" className="text-sm font-semibold cursor-pointer">
                 Prime Location
               </label>
             </div>
             
             <div className="flex items-center space-x-2 bg-muted/10 border border-border/40 p-4 rounded-xl">
               <Checkbox id="docs" checked={documentsCollected} onCheckedChange={(c) => setDocumentsCollected(!!c)} />
               <label htmlFor="docs" className="text-sm font-semibold cursor-pointer">
                 Documents Collected
               </label>
             </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="ghost" className="h-12 px-8 rounded-xl font-medium text-[15px]" onClick={() => router.push("/inbound")} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="h-12 px-10 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-lg font-semibold flex items-center gap-2 text-[15px] active:scale-[0.97]">
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (editId ? <Save size={18} /> : <CheckCircle2 size={18} />)}
            {isSubmitting ? "Saving..." : (editId ? "Update Inbound" : "Create Inbound")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewInboundPage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" /></div>}>
      <InboundForm />
    </Suspense>
  );
}
