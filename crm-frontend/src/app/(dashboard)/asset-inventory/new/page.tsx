"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Save, UploadCloud, X, FileText, Image as ImageIcon, Plus, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { RadioPills } from "./RadioPills";
import { FormSelect } from "@/components/shared/form-select";
import { MobileHeader } from "@/components/layout/mobile-header";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

function SliderWithValue({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: string | number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (val: string) => void;
}) {
  const numericVal = value === "" ? min : Number(value);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
        <span className="text-sm font-semibold text-primary">
          Selected: {numericVal} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numericVal}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-2 bg-muted/50 rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground font-medium">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );
}

const STEPS = [
  { id: 1, title: "Core Details & Geography" },
  { id: 2, title: "Physical Features" },
  { id: 3, title: "Financials & Pricing" },
  { id: 4, title: "Media & Documents" },
];

function AssetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [assetData, setAssetData] = useState<any>(null);
  
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    source: "",
    mediator_name: "",
    cp_reference_name: "",
    owner_name: "",
    mobile_number: "",
    remarks: "",
    visited_date: "",
    site_visited_done: "",
    checked_by: "",
    approved_by: "",
    location: {
      district: "",
      taluk: "",
      village: "",
      zone: "",
      junction_name: "",
      distance_from_main: "",
      distance_from_airport: "",
      firka_range: "",
      haca_range: "",
      road_name: "",
      adjacent_layout: "",
      approached_roads: "",
      approached_road_width: "",
      site_location: "",
      google_pin: "",
      latitude: "",
      longitude: ""
    },
    features: {
      classification_type: "",
      classified_area: "",
      saleable_area: "",
      extent: "",
      tslr: "",
      water_source: "",
      water_depth: "",
      soil_type: "",
      high_voltage_line: "",
      canal: "",
      presence_of_well: "",
      borewell: "",
      near_railway: "",
      near_water_body: "",
      near_burial_ground: "",
      fmb_attachment: ""
    },
    financials: {
      business_mode: "",
      land_price: "",
      dtcp_price: "",
      lo_price: "",
      expectation: "",
      registration_time: "",
      payment_options: ""
    }
  });

  const [layouts, setLayouts] = useState<any[]>([]);

  // File states
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [fmbAttached, setFmbAttached] = useState(false);
  const [fmbFile, setFmbFile] = useState<File | null>(null);
  const [barcodeFile, setBarcodeFile] = useState<File | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [cities, setCities] = useState<{ id: number; city_name: string }[]>([]);

  useEffect(() => {
    apiFetch(API_URL + "/leads/cities")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCities(data.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (editId) {
      setIsFetchingData(true);
      fetch(`${API_URL}/assets/${editId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setAssetData(data.data);
            setFormData({
              source: data.data.source || "",
              mediator_name: data.data.mediator_name || "",
              cp_reference_name: data.data.cp_reference_name || "",
              owner_name: data.data.owner_name || "",
              mobile_number: data.data.mobile_number || "",
              remarks: data.data.remarks || "",
              visited_date: data.data.visited_date || "",
              site_visited_done: data.data.site_visited_done || "",
              checked_by: data.data.checked_by || "",
              approved_by: data.data.approved_by || "",
              location: data.data.location || { distance_from_main: "" },
              features: data.data.feature || {},
              financials: data.data.financials || {}
            });
            setLayouts(data.data.layouts || []);
          }
        })
        .finally(() => setIsFetchingData(false));
    }
  }, [editId]);

  const handleFmbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFmbFile(e.target.files[0]);
    }
  };

  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBarcodeFile(e.target.files[0]);
    }
  };

  const fmbInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDocumentFile(e.target.files[0]);
    }
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      const total = imageFiles.length + selected.length;
      if (total > 4) {
        toast.error("You can only upload a maximum of 4 images.");
        return;
      }
      setImageFiles([...imageFiles, ...selected]);
    }
  };

  const removeImage = (index: number) => {
    const newImgs = [...imageFiles];
    newImgs.splice(index, 1);
    setImageFiles(newImgs);
  };

  const addLayout = () => {
    setLayouts([...layouts, { layout_no: "", name: "", price: "", duration: "", no_of_plots: "" }]);
  };

  const updateLayout = (index: number, field: string, value: string) => {
    const newLayouts = [...layouts];
    newLayouts[index] = { ...newLayouts[index], [field]: value };
    setLayouts(newLayouts);
  };

  const removeLayout = (index: number) => {
    const newLayouts = [...layouts];
    newLayouts.splice(index, 1);
    setLayouts(newLayouts);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      
      const payload = {
        ...formData,
        layouts,
        financials: {
          ...formData.financials,
          land_price: formData.financials.land_price ? Number(formData.financials.land_price) : undefined,
          dtcp_price: formData.financials.dtcp_price ? Number(formData.financials.dtcp_price) : undefined,
          lo_price: formData.financials.lo_price ? Number(formData.financials.lo_price) : undefined,
          expectation: formData.financials.expectation ? Number(formData.financials.expectation) : undefined,
        }
      };

      // 1. Create or Update Asset
      const res = await apiFetch(`${API_URL}/assets${editId ? `/${editId}` : ""}`, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      if (!data.success) {
        toast.error(`Failed to ${editId ? "update" : "add"} asset.`);
        setIsLoading(false);
        return;
      }

      const assetId = editId || data.data.id;

      // 2. Upload Media if any selected
      if (documentFile || imageFiles.length > 0 || fmbFile || barcodeFile) {
        const mediaForm = new FormData();
        if (documentFile) mediaForm.append("document", documentFile);
        if (fmbFile) mediaForm.append("fmb", fmbFile);
        if (barcodeFile) mediaForm.append("barcode", barcodeFile);
        imageFiles.forEach(img => mediaForm.append("images", img));

        const mediaRes = await apiFetch(`${API_URL}/assets/${assetId}/media`, {
          method: "POST",
          body: mediaForm
        });
        const mediaData = await mediaRes.json();
        if (!mediaData.success) {
          toast.error("Asset saved, but media upload failed.");
        }
      }

      toast.success(`Asset ${editId ? "updated" : "added"} successfully!`);
      router.push("/asset-inventory");
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    if (currentStep < 4) setCurrentStep(prev => prev + 1);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  if (isFetchingData) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
          <p className="text-muted-foreground font-medium">Loading Asset Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <MobileHeader title={editId ? "Edit Asset" : "Add Asset"} showBack />
      <div className="hidden md:flex items-center justify-between pr-[150px] min-h-[48px]">
        <div className="flex items-center gap-4">
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => router.push("/asset-inventory")}>
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{editId ? "Edit Asset" : "Add New Asset"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {editId ? "Update the details for this real estate asset." : "Enter the details for the new asset."}
            </p>
          </div>
        </div>
      </div>

      {/* Stepper UI */}
      <div className="mb-8 border-b pb-6">
        <div className="flex items-center justify-between px-2">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center flex-1 relative">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 transition-colors ${
                  currentStep >= step.id ? "bg-[#0052FF] text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {step.id}
              </div>
              <span className={`text-xs mt-2 font-medium ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"}`}>
                {step.title}
              </span>
              {index < STEPS.length - 1 && (
                <div 
                  className={`absolute top-5 left-[50%] w-full h-[2px] -z-0 transition-colors ${
                    currentStep > step.id ? "bg-[#0052FF]" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <form 
        onSubmit={handleAddSubmit} 
        onKeyDown={(e) => {
          // Prevent accidental form submission when pressing Enter in text fields
          if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
            e.preventDefault();
          }
        }}
        className="space-y-6"
      >
        
        {/* Step 1: Core Details & Geography */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Core Details */}
            <div className="bg-card border rounded-2xl p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Core Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Owner Name *</label>
                  <Input value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} placeholder="John Doe" required className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number *</label>
                  <Input value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} placeholder="+91 98765 43210" required className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Source</label>
                  <RadioPills options={["Mediator", "MD", "Referral", "CP Reference"]} value={formData.source} onChange={v => setFormData({...formData, source: v})} />
                </div>
                {formData.source === "Mediator" && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mediator Name</label>
                    <Input value={formData.mediator_name} onChange={e => setFormData({...formData, mediator_name: e.target.value})} placeholder="Mediator Name" className="h-12 rounded-xl bg-muted/30" />
                  </div>
                )}
                {formData.source === "CP Reference" && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CP Reference Name</label>
                    <Input value={formData.cp_reference_name} onChange={e => setFormData({...formData, cp_reference_name: e.target.value})} placeholder="CP Reference Name" className="h-12 rounded-xl bg-muted/30" />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Site Visited Date</label>
                  <Input type="date" value={formData.visited_date ? formData.visited_date.split('T')[0] : ""} onChange={e => setFormData({...formData, visited_date: e.target.value})} className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Site Visited Done By</label>
                  <Input value={formData.site_visited_done} onChange={e => setFormData({...formData, site_visited_done: e.target.value})} placeholder="Name of visitor" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Checked By</label>
                  <Input value={formData.checked_by} onChange={e => setFormData({...formData, checked_by: e.target.value})} placeholder="Checked by" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Approved By</label>
                  <Input value={formData.approved_by} onChange={e => setFormData({...formData, approved_by: e.target.value})} placeholder="Approved by" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2 lg:col-span-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Remarks</label>
                  <Input value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} placeholder="Remarks" className="h-12 rounded-xl bg-muted/30" />
                </div>
              </div>
            </div>

            {/* Geography & Approach */}
            <div className="bg-card border rounded-2xl p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Geography & Approach</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">District</label>
                  {isFetchingData ? <div className="h-12 bg-muted/50 rounded-xl animate-pulse" /> : (
                    <FormSelect
                      name="district"
                      placeholder="Select District"
                      options={cities.map((c) => ({ label: c.city_name, value: c.city_name }))}
                      value={formData.location.district || null}
                      onValueChange={(val) => setFormData({...formData, location: {...formData.location, district: val}})}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Taluk</label>
                  <Input value={formData.location.taluk} onChange={e => setFormData({...formData, location: {...formData.location, taluk: e.target.value}})} placeholder="Taluk" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Village</label>
                  <Input value={formData.location.village} onChange={e => setFormData({...formData, location: {...formData.location, village: e.target.value}})} placeholder="Village" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Zone</label>
                  <RadioPills options={["Coimbatore East", "Coimbatore West", "Coimbatore South", "Coimbatore North", "Coimbatore Center"]} value={formData.location.zone} onChange={v => setFormData({...formData, location: {...formData.location, zone: v}})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Junction Name</label>
                  <Input value={formData.location.junction_name} onChange={e => setFormData({...formData, location: {...formData.location, junction_name: e.target.value}})} placeholder="Junction Name" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <SliderWithValue
                    label="Distance from Main"
                    value={formData.location.distance_from_main || ""}
                    min={0} max={100} step={0.5} unit="km"
                    onChange={v => setFormData({...formData, location: {...formData.location, distance_from_main: v}})}
                  />
                </div>
                <div className="space-y-2">
                  <SliderWithValue
                    label="Distance from Airport"
                    value={formData.location.distance_from_airport || ""}
                    min={0} max={100} step={1} unit="km"
                    onChange={v => setFormData({...formData, location: {...formData.location, distance_from_airport: v}})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Firka Range</label>
                  <Input value={formData.location.firka_range} onChange={e => setFormData({...formData, location: {...formData.location, firka_range: e.target.value}})} placeholder="Firka Range" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">HACA Range</label>
                  <div className="flex items-center space-x-3 bg-muted/10 border border-border/40 p-4 h-12 rounded-xl transition-colors hover:bg-muted/30 mt-1">
                    <Checkbox 
                      id="haca_range" 
                      checked={formData.location.haca_range === "Yes"} 
                      onCheckedChange={(c) => setFormData({...formData, location: {...formData.location, haca_range: c ? "Yes" : "No"}})} 
                    />
                    <label htmlFor="haca_range" className="text-sm font-semibold cursor-pointer capitalize flex-1">
                      HACA Range
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Road Name</label>
                  <Input value={formData.location.road_name} onChange={e => setFormData({...formData, location: {...formData.location, road_name: e.target.value}})} placeholder="Road Name" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Adjacent Layout</label>
                  <RadioPills options={["Yes", "No", "N/A"]} value={formData.location.adjacent_layout} onChange={v => setFormData({...formData, location: {...formData.location, adjacent_layout: v}})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Approached Roads</label>
                  <Input value={formData.location.approached_roads} onChange={e => setFormData({...formData, location: {...formData.location, approached_roads: e.target.value}})} placeholder="Approached Roads" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <SliderWithValue
                    label="Approached Road Width"
                    value={formData.location.approached_road_width || ""}
                    min={10} max={200} step={1} unit="Feet"
                    onChange={v => setFormData({...formData, location: {...formData.location, approached_road_width: v}})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Site Location</label>
                  <Input value={formData.location.site_location} onChange={e => setFormData({...formData, location: {...formData.location, site_location: e.target.value}})} placeholder="Site Location" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Google Pin</label>
                  <Input value={formData.location.google_pin} onChange={e => setFormData({...formData, location: {...formData.location, google_pin: e.target.value}})} placeholder="Maps link" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Latitude</label>
                  <Input value={formData.location.latitude} onChange={e => setFormData({...formData, location: {...formData.location, latitude: e.target.value}})} placeholder="Latitude" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Longitude</label>
                  <Input value={formData.location.longitude} onChange={e => setFormData({...formData, location: {...formData.location, longitude: e.target.value}})} placeholder="Longitude" className="h-12 rounded-xl bg-muted/30" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Physical Features */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-card border rounded-2xl p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Physical Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Classification Type</label>
                  <RadioPills options={["Non-Classified Area", "Classified Area", "N/A"]} value={formData.features.classification_type} onChange={v => setFormData({...formData, features: {...formData.features, classification_type: v}})} />
                </div>
                {formData.features.classification_type === "Classified Area" && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Classified Area</label>
                    <Input value={formData.features.classified_area} onChange={e => setFormData({...formData, features: {...formData.features, classified_area: e.target.value}})} placeholder="Classified Area" className="h-12 rounded-xl bg-muted/30" />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Saleable Area</label>
                  <RadioPills options={["Full", "Partial", "Full/Partial"]} value={formData.features.saleable_area} onChange={v => setFormData({...formData, features: {...formData.features, saleable_area: v}})} />
                </div>
                <div className="space-y-2">
                  <SliderWithValue
                    label="Extent"
                    value={formData.features.extent || ""}
                    min={0} max={100} step={0.1} unit="Acres"
                    onChange={v => setFormData({...formData, features: {...formData.features, extent: v}})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">TSLR</label>
                  <Input value={formData.features.tslr} onChange={e => setFormData({...formData, features: {...formData.features, tslr: e.target.value}})} placeholder="TSLR" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Water Source</label>
                  <RadioPills options={["High", "Medium", "Low", "N/A"]} value={formData.features.water_source} onChange={v => setFormData({...formData, features: {...formData.features, water_source: v}})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Water Depth</label>
                  <RadioPills options={["0-100Ft", "100-300Ft", "Above 300Ft"]} value={formData.features.water_depth} onChange={v => setFormData({...formData, features: {...formData.features, water_depth: v}})} />
                </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Soil Type</label>
              <FormSelect
                name="soil_type"
                placeholder="Select Soil Type"
                options={[
                  { label: "Red Soil", value: "redsoil" },
                  { label: "Black Soil", value: "blacksoil" },
                  { label: "Clay Soil", value: "claysoil" },
                  { label: "Loamy Soil", value: "loamysoil" },
                  { label: "Red Rock Soil", value: "redrocksoil" },
                  { label: "Red Rock Mixed", value: "redrockmixed" },
                  { label: "Rock Soil", value: "rocksoil" },
                ]}
                value={formData.features.soil_type || null}
                onValueChange={val => setFormData({...formData, features: {...formData.features, soil_type: val}})}
              />
            </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Near Railway</label>
                  <RadioPills options={["0-100Meter", "100-300Meter", "Above 300Meter", "N/A"]} value={formData.features.near_railway} onChange={v => setFormData({...formData, features: {...formData.features, near_railway: v}})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Near Water Body</label>
                  <RadioPills options={["0-100Meter", "100-300Meter", "Above 300Meter", "N/A"]} value={formData.features.near_water_body} onChange={v => setFormData({...formData, features: {...formData.features, near_water_body: v}})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Near Burial Ground</label>
                  <RadioPills options={["0-100Meter", "100-300Meter", "Above 300Meter", "N/A"]} value={formData.features.near_burial_ground} onChange={v => setFormData({...formData, features: {...formData.features, near_burial_ground: v}})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Canal</label>
                  <RadioPills options={["0-100Meter", "100-300Meter", "Above 300Meter", "N/A"]} value={formData.features.canal} onChange={v => setFormData({...formData, features: {...formData.features, canal: v}})} />
                </div>
                
                {/* Checkboxes for Yes/No attributes */}
                <div className="lg:col-span-3 pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 border-t mt-4">
                  {['high_voltage_line', 'presence_of_well', 'borewell'].map((field) => {
                    const val = (formData.features as any)[field];
                    const isChecked = val === "Yes" || val === true || val === "true" || val === 1;
                    return (
                      <div key={field} className="flex items-center space-x-3 bg-muted/10 border border-border/40 p-4 rounded-xl transition-colors hover:bg-muted/30">
                        <Checkbox 
                          id={`feature_${field}`} 
                          checked={isChecked} 
                          onCheckedChange={(c) => {
                            const newVal = c ? "Yes" : "No";
                            setFormData({...formData, features: {...formData.features, [field]: newVal}});
                          }} 
                        />
                        <label htmlFor={`feature_${field}`} className="text-sm font-semibold cursor-pointer capitalize flex-1">
                          {field.replace(/_/g, ' ')}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Financials & Pricing */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-card border rounded-2xl p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Financials & Pricing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2 lg:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Business Mode</label>
              <RadioPills options={["Outright", "JV", "Different Payment"]} value={formData.financials.business_mode} onChange={v => setFormData({...formData, financials: {...formData.financials, business_mode: v}})} />
            </div>
                <div className="space-y-2 lg:col-span-1">
                  <SliderWithValue
                    label="Land Price"
                    value={formData.financials.land_price || ""}
                    min={5} max={1000} step={1} unit="Lakhs"
                    onChange={v => setFormData({...formData, financials: {...formData.financials, land_price: v}})}
                  />
                </div>
                <div className="space-y-2 lg:col-span-1">
                  <SliderWithValue
                    label="DTCP Price"
                    value={formData.financials.dtcp_price || ""}
                    min={1} max={50} step={1} unit="Lakhs"
                    onChange={v => setFormData({...formData, financials: {...formData.financials, dtcp_price: v}})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">LO Price</label>
                  <Input type="number" value={formData.financials.lo_price} onChange={e => setFormData({...formData, financials: {...formData.financials, lo_price: e.target.value}})} placeholder="Amount" className="h-12 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2 lg:col-span-1">
                  <SliderWithValue
                    label="Expectation"
                    value={formData.financials.expectation || ""}
                    min={1} max={1000} step={1} unit="Lakhs"
                    onChange={v => setFormData({...formData, financials: {...formData.financials, expectation: v}})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Registration Time</label>
                  <RadioPills options={["Immediately", "1-3 Month", "3-6 Month", "Upto 1 Year"]} value={formData.financials.registration_time} onChange={v => setFormData({...formData, financials: {...formData.financials, registration_time: v}})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Options</label>
                  <Input value={formData.financials.payment_options} onChange={e => setFormData({...formData, financials: {...formData.financials, payment_options: e.target.value}})} placeholder="Payment Options" className="h-12 rounded-xl bg-muted/30" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Media & Documents */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Layout Details Repeater */}
            <div className="bg-card border rounded-2xl p-8 shadow-sm">
              <div className="flex items-center justify-between border-b pb-3 mb-6">
                <h3 className="text-lg font-bold text-foreground">Layout Details</h3>
                <Button type="button" variant="outline" size="sm" onClick={addLayout} className="rounded-xl flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Add Layout
                </Button>
              </div>
              
              {layouts.length === 0 ? (
                <div className="text-center text-muted-foreground py-6 border-2 border-dashed border-border/60 rounded-xl">
                  No layouts added yet. Click "Add Layout" to include layout details.
                </div>
              ) : (
                <div className="space-y-4">
                  {layouts.map((layout, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end bg-muted/10 p-4 rounded-xl border border-border">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Layout No</label>
                        <Input value={layout.layout_no} onChange={e => updateLayout(index, "layout_no", e.target.value)} placeholder="No" className="h-12 rounded-xl bg-muted/30" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Media & Documents */}
            <div className="bg-card border rounded-2xl p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Media & Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Document Upload */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">General Document (Max 1)</label>
                    <p className="text-[13px] text-muted-foreground mb-3 mt-1">Upload a PDF or document for the layout plan.</p>
                  </div>
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" ref={docInputRef} onChange={handleDocumentChange} />
                  
                  {!documentFile ? (
                    <div 
                      onClick={() => docInputRef.current?.click()}
                      className="border-2 border-dashed border-border/60 rounded-xl h-[120px] flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <UploadCloud className="h-6 w-6 text-muted-foreground mb-2" />
                      <span className="text-sm font-medium text-foreground">Click to upload document</span>
                    </div>
                  ) : (
                    <div className="border border-border rounded-xl p-4 flex items-center justify-between bg-muted/10">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{documentFile.name}</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="text-red-500 flex-shrink-0" onClick={() => setDocumentFile(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* FMB Attachment */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">FMB Attached</label>
                    <RadioPills options={["Yes", "No", "N/A"]} value={fmbAttached ? "Yes" : "No"} onChange={(val) => setFmbAttached(val === "Yes")} />
                  </div>
                  {fmbAttached && (
                    <div className="mt-2">
                      <input type="file" accept="image/*,.pdf" className="hidden" ref={fmbInputRef} onChange={handleFmbChange} />
                      {!fmbFile ? (
                        <div 
                          onClick={() => fmbInputRef.current?.click()}
                          className="border-2 border-dashed border-border/60 rounded-xl h-[120px] flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors"
                        >
                          <UploadCloud className="h-6 w-6 text-muted-foreground mb-2" />
                          <span className="text-sm font-medium text-foreground">Click to upload FMB File</span>
                        </div>
                      ) : (
                        <div className="border border-border rounded-xl p-4 flex items-center justify-between bg-muted/10">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                            <span className="text-sm font-medium truncate">{fmbFile.name}</span>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="text-red-500 flex-shrink-0" onClick={() => setFmbFile(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* QR/Barcode Image */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">QR / Barcode Image</label>
                    <p className="text-[13px] text-muted-foreground mb-3 mt-1">Upload a barcode or QR image.</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" ref={barcodeInputRef} onChange={handleBarcodeChange} />
                  {!barcodeFile ? (
                    <div 
                      onClick={() => barcodeInputRef.current?.click()}
                      className="border-2 border-dashed border-border/60 rounded-xl h-[120px] flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <UploadCloud className="h-6 w-6 text-muted-foreground mb-2" />
                      <span className="text-sm font-medium text-foreground">Click to upload QR/Barcode</span>
                    </div>
                  ) : (
                    <div className="border border-border rounded-xl p-4 flex items-center justify-between bg-muted/10">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <ImageIcon className="h-8 w-8 text-blue-500 flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{barcodeFile.name}</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="text-red-500 flex-shrink-0" onClick={() => setBarcodeFile(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Image Upload */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Site Photos (Max 4)</label>
                    <p className="text-[13px] text-muted-foreground mb-3 mt-1">Upload up to 4 images of the site.</p>
                  </div>
                  <input type="file" accept="image/*" multiple className="hidden" ref={imgInputRef} onChange={handleImagesChange} />
                  
                  {imageFiles.length < 4 && (
                    <div 
                      onClick={() => imgInputRef.current?.click()}
                      className="border-2 border-dashed border-border/60 rounded-xl h-[120px] flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <ImageIcon className="h-6 w-6 text-muted-foreground mb-2" />
                      <span className="text-sm font-medium text-foreground">Click to add images ({imageFiles.length}/4)</span>
                    </div>
                  )}

                  {imageFiles.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {imageFiles.map((file, idx) => (
                        <div key={idx} className="border border-border rounded-lg p-2 flex items-center justify-between bg-muted/10">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="h-8 w-8 bg-muted rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                              <img src={URL.createObjectURL(file)} className="h-full w-full object-cover" alt="preview" />
                            </div>
                            <span className="text-xs font-medium truncate">{file.name}</span>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeImage(idx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stepper Navigation */}
        <div className="flex justify-between mt-8 border-t pt-6 border-border/40 pb-10">
          <Button 
            type="button" 
            variant="outline" 
            className="h-12 px-6 rounded-xl font-medium shadow-sm hover:bg-muted" 
            onClick={currentStep === 1 ? () => router.push("/asset-inventory") : handlePrev}
          >
            {currentStep === 1 ? "Cancel" : <><ChevronLeft className="mr-2 h-4 w-4" /> Previous Step</>}
          </Button>

          {currentStep < 4 ? (
            <Button 
              type="button" 
              className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 font-medium shadow-md"
              onClick={handleNext}
            >
              Next Step <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={isLoading} className="h-12 px-8 rounded-xl bg-[#0052FF] hover:bg-[#0052FF]/90 font-medium shadow-md">
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> {editId ? "Update Asset" : "Create Asset"}</>}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export default function NewAssetPage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" /></div>}>
      <AssetForm />
    </Suspense>
  );
}
