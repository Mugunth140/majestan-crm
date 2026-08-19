"use client";

import { apiFetch } from "@/lib/api-fetch";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Camera, CheckCircle2, Loader2, MapPin, Save, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { FormSelect } from "@/components/shared/form-select";
import { DateTimePicker } from "@/components/shared/datetime-picker";
import { TimePicker } from "@/components/shared/time-picker";
import { MobileHeader } from "@/components/layout/mobile-header";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

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
  { label: "Days", value: "Days" },
];

const FLOOR_APPLICABLE_TYPES = [
  "apartment", "builder_floor", "office", "shop", "showroom", "commercial_building", 
  "hotel", "restaurant", "school", "college", "hospital", "clinic", "training_centre"
];

const BHK_OPTIONS = [
  { label: "1 BHK", value: "1" },
  { label: "2 BHK", value: "2" },
  { label: "3 BHK", value: "3" },
  { label: "4 BHK", value: "4" },
  { label: "5 BHK", value: "5" },
  { label: "6 BHK", value: "6" },
];

const BHK_APPLICABLE_TYPES = ["apartment", "villa", "independent_house"];

function InboundForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [cities, setCities] = useState<{ label: string; value: string }[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  
  const [inboundData, setInboundData] = useState<any>(null);
  const [isLoadingInbound, setIsLoadingInbound] = useState(!!editId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for conditional logic
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);
  const [selectedSpecialPurposes, setSelectedSpecialPurposes] = useState<string[]>([]);
  const [primaryContact, setPrimaryContact] = useState<string | null>(null);
  const [keyAvailableWith, setKeyAvailableWith] = useState<string | null>(null);
  
  // Brokerage States
  const [brokerageAccepted, setBrokerageAccepted] = useState<string | null>(null);
  const [brokeragePaidBy, setBrokeragePaidBy] = useState<string[]>([]);
  const [brokerageType, setBrokerageType] = useState<string | null>(null);

  // Locality / City states
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [sublocations, setSublocations] = useState<{ label: string; value: string }[]>([]);
  const [selectedLocality, setSelectedLocality] = useState<string | null>(null);
  const [isFetchingSublocations, setIsFetchingSublocations] = useState(false);

  // BHK state
  const [selectedBhk, setSelectedBhk] = useState<string | null>(null);

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done" | "error">("idle");

  // GPS location state
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [googleMapLocation, setGoogleMapLocation] = useState<string>("");

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        setIsFetchingData(true);
        const cityRes = await apiFetch(API_URL + "/master/cities");
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
      apiFetch(API_URL + "/inbounds/" + editId)
        .then((res) => res.json())
        .then((result) => {
          if (result) {
            const data = result;
            setInboundData(data);
            setSelectedCategory(data.property_category || null);
            setSelectedType(data.property_type || null);
            setSelectedPurpose(data.purpose || null);
            
            const specialPurposes = data.special_purpose ? data.special_purpose.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
            setSelectedSpecialPurposes(specialPurposes);

            setSelectedCity(data.city || null);
            setSelectedLocality(data.locality || null);
            setSelectedBhk(data.bhk || null);

            setPrimaryContact(data.primary_contact || null);
            setKeyAvailableWith(data.key_available_with || null);
            
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
            setGoogleMapLocation(data.google_map_location || "");
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

  useEffect(() => {
    if (!selectedCity) {
      setSublocations([]);
      return;
    }
    setIsFetchingSublocations(true);
    apiFetch(API_URL + "/master/sublocations?city_name=" + encodeURIComponent(selectedCity))
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSublocations(data.data);
      })
      .catch(() => {})
      .finally(() => setIsFetchingSublocations(false));
  }, [selectedCity]);

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
      // Generate preview
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setUploadProgress("idle");
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
      payload.special_purpose = selectedSpecialPurposes.length > 0 ? selectedSpecialPurposes.join(", ") : null;
      payload.locality = selectedLocality;
      payload.bhk = selectedBhk;
      
      payload.advance = formData.get("advance") || null;

      if (selectedPurpose === "Rent") {
        payload.total_rent = formData.get("total_rent") ? parseFloat(formData.get("total_rent") as string) : null;
        payload.rent_per_sqft = formData.get("rent_per_sqft") ? parseFloat(formData.get("rent_per_sqft") as string) : null;
      }

      payload.floor_number = formData.get("floor_number") || null;
      payload.brokerage_days = formData.get("brokerage_days") ? parseInt(formData.get("brokerage_days") as string, 10) : null;
      payload.primary_contact = primaryContact;
      payload.key_available_with = keyAvailableWith;
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

      const res = await apiFetch(endpoint, {
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
        setIsUploadingImage(true);
        setUploadProgress("uploading");
        try {
          const fileData = new FormData();
          fileData.append('file', selectedFile);
          const uploadId = editId ? editId : result.id;
          const uploadRes = await apiFetch(`${API_URL}/inbounds/${uploadId}/image`, {
            method: 'POST',
            body: fileData,
          });
          if (!uploadRes.ok) {
            setUploadProgress("error");
            toast.error("Property saved, but photo upload failed.");
          } else {
            setUploadProgress("done");
          }
        } catch {
          setUploadProgress("error");
          toast.error("Property saved, but photo upload failed.");
        } finally {
          setIsUploadingImage(false);
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

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser.");
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        setGoogleMapLocation(mapsUrl);
        setIsGettingLocation(false);
        toast.success("Location captured successfully!");
      },
      (error) => {
        setIsGettingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Location permission denied. Please allow location access and try again.");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Location unavailable. Please try again.");
            break;
          case error.TIMEOUT:
            toast.error("Location request timed out. Please try again.");
            break;
          default:
            toast.error("Failed to get location.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
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
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2.5 md:px-0 mt-2 md:mt-0 mb-20 md:mb-0">
      <MobileHeader title={editId ? "Edit Inbound" : "Add Inbound"} showBack />
      <div className="hidden md:flex items-center justify-between pr-[150px] min-h-[48px]">
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
        <div className="bg-card border rounded-2xl p-5 sm:p-8 shadow-sm">
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
                  setSelectedBhk(null);
                  if (val !== "commercial") setSelectedSpecialPurposes([]);
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
                onValueChange={(val) => { setSelectedType(val); setSelectedBhk(null); }}
                placeholder={selectedCategory ? "Select Type" : "Select Category First"} 
                options={selectedCategory ? PROPERTY_TYPES_MAP[selectedCategory] || [] : []} 
                disabled={!selectedCategory}
                required 
              />
            </div>
            {selectedCategory === "residential" && selectedType && BHK_APPLICABLE_TYPES.includes(selectedType) && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">BHK</label>
                <FormSelect
                  name="_bhk"
                  value={selectedBhk}
                  onValueChange={setSelectedBhk}
                  placeholder="Select BHK"
                  options={BHK_OPTIONS}
                />
              </div>
            )}
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
            
            {selectedCategory === "commercial" && (
            <div className="space-y-2 lg:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Special Purpose (Optional)</label>
              <div className="flex flex-wrap gap-2.5 pt-1">
                {["Salon", "Spa", "Restaurant", "Gym"].map((sp) => {
                  const isSelected = selectedSpecialPurposes.includes(sp);
                  return (
                    <button
                      type="button"
                      key={sp}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedSpecialPurposes(selectedSpecialPurposes.filter((s) => s !== sp));
                        } else {
                          setSelectedSpecialPurposes([...selectedSpecialPurposes, sp]);
                        }
                      }}
                      className={`px-4 py-2 text-[13px] font-medium rounded-xl border transition-all ${
                        isSelected
                          ? "bg-[#0052FF] text-white border-[#0052FF] shadow-sm shadow-blue-500/20"
                          : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {sp}
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {selectedPurpose === "Rent" && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Rent</label>
                <Input type="number" name="total_rent" defaultValue={inboundData?.total_rent || ""} placeholder="e.g. 15000" className="h-12 rounded-xl bg-muted/30" />
              </div>
            )}
            
            {(selectedPurpose === "Rent" || selectedPurpose === "Sale" || selectedPurpose === "Lease" || selectedPurpose) && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Advance {selectedPurpose === "Rent" ? "(Months)" : ""}</label>
                {selectedPurpose === "Rent" ? (
                  <FormSelect
                    name="advance"
                    placeholder="Select Advance"
                    defaultValue={inboundData?.advance || null}
                    options={[
                      { label: "1 Month", value: "1" },
                      { label: "2 Months", value: "2" },
                      { label: "3 Months", value: "3" },
                      { label: "4 Months", value: "4" },
                      { label: "5 Months", value: "5" },
                      { label: "6 Months", value: "6" },
                      { label: "7 Months", value: "7" },
                      { label: "8 Months", value: "8" },
                      { label: "9 Months", value: "9" },
                      { label: "10 Months", value: "10" },
                      { label: "11 Months", value: "11" },
                      { label: "12 Months", value: "12" },
                    ]}
                  />
                ) : (
                  <Input type="text" name="advance" defaultValue={inboundData?.advance || ""} placeholder={selectedPurpose === "Sale" ? "e.g. 5 Lakhs" : "e.g. 1 Lakh"} className="h-12 rounded-xl bg-muted/30" />
                )}
              </div>
            )}

            {selectedPurpose === "Rent" && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rent per Sq Ft</label>
                <Input type="number" step="0.01" name="rent_per_sqft" defaultValue={inboundData?.rent_per_sqft || ""} placeholder="e.g. 25.5" className="h-12 rounded-xl bg-muted/30" />
              </div>
            )}

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
              {isFetchingData ? skeletonField : <FormSelect 
                name="city" 
                value={selectedCity}
                defaultValue={inboundData?.city || null} 
                onValueChange={(val) => {
                  setSelectedCity(val);
                  setSelectedLocality(null);
                  setSublocations([]);
                }}
                placeholder="Select City" 
                options={cities} 
                required 
              />}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Area</label>
              <Input name="area" defaultValue={inboundData?.area || ""} placeholder="e.g. 1500 sqft" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Locality</label>
              {isFetchingSublocations ? skeletonField : (
                <FormSelect
                  name="_locality"
                  value={selectedLocality}
                  onValueChange={setSelectedLocality}
                  placeholder={selectedCity ? "Select Locality" : "Select City First"}
                  options={sublocations}
                  disabled={!selectedCity || sublocations.length === 0}
                  required
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Landmark</label>
              <Input name="landmark" defaultValue={inboundData?.landmark || ""} placeholder="Enter Landmark" className="h-12 rounded-xl bg-muted/30" />
            </div>

            <div className="space-y-2 lg:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Google Map Location</label>
              <div className="flex items-center gap-2">
                <Input
                  name="google_map_location"
                  value={googleMapLocation}
                  onChange={(e) => setGoogleMapLocation(e.target.value)}
                  placeholder="Paste Google Maps Link or use button →"
                  className="h-12 rounded-xl bg-muted/30 flex-1"
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={isGettingLocation}
                  className="flex-shrink-0 h-12 px-4 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-2 text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGettingLocation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  {isGettingLocation ? "Getting..." : "Use Location"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Owner Information */}
        <div className="bg-card border rounded-2xl p-5 sm:p-8 shadow-sm">
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
        <div className="bg-card border rounded-2xl p-5 sm:p-8 shadow-sm">
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

            {primaryContact && primaryContact !== "Owner" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Name</label>
                  <Input name="primary_contact_name" defaultValue={inboundData?.primary_contact_name || ""} placeholder="Name" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Number</label>
                  <Input name="primary_contact_number" defaultValue={inboundData?.primary_contact_number || ""} placeholder="Mobile Number" className="h-12 rounded-xl bg-muted/30" />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Key Available With</label>
              <FormSelect 
                name="_key_available_with" 
                value={keyAvailableWith}
                onValueChange={setKeyAvailableWith}
                placeholder="Select" 
                options={KEY_AVAILABLE_WITH} 
                required 
              />
            </div>

            {keyAvailableWith && keyAvailableWith !== "Owner" && keyAvailableWith !== primaryContact && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Key Contact Name</label>
                  <Input name="key_contact_name" defaultValue={inboundData?.key_contact_name || ""} placeholder="Name" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Key Contact Number</label>
                  <Input name="key_contact_number" defaultValue={inboundData?.key_contact_number || ""} placeholder="Mobile Number" className="h-12 rounded-xl bg-muted/30" />
                </div>
              </>
            )}
            
            <div className="flex items-center space-x-2 lg:col-span-3 pt-6 border-t mt-4 border-border/50">
              <Checkbox id="priorAppointment" checked={priorAppointmentRequired} onCheckedChange={(c) => setPriorAppointmentRequired(!!c)} />
              <label htmlFor="priorAppointment" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Prior Appointment Required
              </label>
            </div>
          </div>
        </div>

        {/* Brokerage Details */}
        <div className="bg-card border rounded-2xl p-5 sm:p-8 shadow-sm">
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

                {brokerageType === "Days" && (
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
        <div className="bg-card border rounded-2xl p-5 sm:p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Media & Inventory Flags</h3>
          
          <div className="mb-8 border-b pb-8">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">Property Photo</label>
            
            {/* Preview area */}
            {(previewUrl || (inboundData?.image_url && !selectedFile)) && (
              <div className="mb-4 relative inline-block">
                <img
                  src={previewUrl || inboundData.image_url}
                  alt="Property preview"
                  className="w-full max-w-[280px] h-40 object-cover rounded-2xl border border-border/60 shadow-sm"
                />
                {previewUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setUploadProgress("idle");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      if (cameraInputRef.current) cameraInputRef.current.value = "";
                    }}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold shadow-md hover:bg-destructive/80"
                  >
                    ✕
                  </button>
                )}
                {!previewUrl && inboundData?.image_url && (
                  <p className="text-xs text-muted-foreground mt-1.5">Current photo. Select new to replace.</p>
                )}
              </div>
            )}

            {/* Upload progress */}
            {isUploadingImage && (
              <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-[#0052FF]" />
                <span>Uploading photo & processing...</span>
              </div>
            )}
            {uploadProgress === "done" && !isUploadingImage && (
              <div className="flex items-center gap-2 mb-3 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Photo uploaded successfully</span>
              </div>
            )}
            {uploadProgress === "error" && !isUploadingImage && (
              <div className="flex items-center gap-2 mb-3 text-sm text-destructive">
                <span>⚠ Upload failed — photo was not saved</span>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-2 h-11 px-5 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all text-[13px] font-medium"
              >
                <Camera className="h-4 w-4" />
                Take Photo
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 h-11 px-5 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all text-[13px] font-medium"
              >
                <UploadCloud className="h-4 w-4" />
                Choose from Gallery
              </button>
            </div>

            {selectedFile && (
              <p className="text-xs text-muted-foreground mt-2">
                {selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
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
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 pb-4 md:pb-0">
          <Button type="button" variant="ghost" className="h-12 px-8 rounded-xl font-medium text-[15px] w-full sm:w-auto" onClick={() => router.push("/inbound")} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="h-12 px-10 rounded-xl bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-lg font-semibold flex items-center gap-2 text-[15px] active:scale-[0.97] w-full sm:w-auto">
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
