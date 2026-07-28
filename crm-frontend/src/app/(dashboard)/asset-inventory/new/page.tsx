"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Save, UploadCloud, X, FileText, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function AssetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [assetData, setAssetData] = useState<any>(null);

  const [formData, setFormData] = useState({
    source: "",
    mediator_name: "",
    cp_reference_name: "",
    owner_name: "",
    mobile_number: "",
    remarks: "",
    location: {
      district: "",
      taluk: "",
      village: "",
      zone: "",
      junction_name: "",
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
      near_burial_ground: ""
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
  const docInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

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
              location: data.data.location || {},
              features: data.data.features || {},
              financials: data.data.financials || {}
            });
            setLayouts(data.data.layouts || []);
          }
        })
        .finally(() => setIsFetchingData(false));
    }
  }, [editId]);

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
      if (documentFile || imageFiles.length > 0) {
        const mediaForm = new FormData();
        if (documentFile) mediaForm.append("document", documentFile);
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
      <div className="flex items-center justify-between pr-[150px] min-h-[48px]">
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

      <form onSubmit={handleAddSubmit} className="space-y-6">
        
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
              <Input value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} placeholder="Source" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mediator Name</label>
              <Input value={formData.mediator_name} onChange={e => setFormData({...formData, mediator_name: e.target.value})} placeholder="Mediator Name" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CP Reference Name</label>
              <Input value={formData.cp_reference_name} onChange={e => setFormData({...formData, cp_reference_name: e.target.value})} placeholder="CP Reference Name" className="h-12 rounded-xl bg-muted/30" />
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
              <Input value={formData.location.district} onChange={e => setFormData({...formData, location: {...formData.location, district: e.target.value}})} placeholder="e.g. Karnataka" className="h-12 rounded-xl bg-muted/30" />
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
              <Input value={formData.location.zone} onChange={e => setFormData({...formData, location: {...formData.location, zone: e.target.value}})} placeholder="Zone" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Junction Name</label>
              <Input value={formData.location.junction_name} onChange={e => setFormData({...formData, location: {...formData.location, junction_name: e.target.value}})} placeholder="Junction Name" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Distance from Airport</label>
              <Input value={formData.location.distance_from_airport} onChange={e => setFormData({...formData, location: {...formData.location, distance_from_airport: e.target.value}})} placeholder="Distance" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Firka Range</label>
              <Input value={formData.location.firka_range} onChange={e => setFormData({...formData, location: {...formData.location, firka_range: e.target.value}})} placeholder="Firka Range" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">HACA Range</label>
              <Input value={formData.location.haca_range} onChange={e => setFormData({...formData, location: {...formData.location, haca_range: e.target.value}})} placeholder="HACA Range" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Road Name</label>
              <Input value={formData.location.road_name} onChange={e => setFormData({...formData, location: {...formData.location, road_name: e.target.value}})} placeholder="Road Name" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Adjacent Layout</label>
              <Input value={formData.location.adjacent_layout} onChange={e => setFormData({...formData, location: {...formData.location, adjacent_layout: e.target.value}})} placeholder="Adjacent Layout" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Approached Roads</label>
              <Input value={formData.location.approached_roads} onChange={e => setFormData({...formData, location: {...formData.location, approached_roads: e.target.value}})} placeholder="Approached Roads" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Approached Road Width</label>
              <Input value={formData.location.approached_road_width} onChange={e => setFormData({...formData, location: {...formData.location, approached_road_width: e.target.value}})} placeholder="Approached Road Width" className="h-12 rounded-xl bg-muted/30" />
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

        {/* Physical Features */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Physical Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Classification Type</label>
              <Input value={formData.features.classification_type} onChange={e => setFormData({...formData, features: {...formData.features, classification_type: e.target.value}})} placeholder="Classification Type" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Classified Area</label>
              <Input value={formData.features.classified_area} onChange={e => setFormData({...formData, features: {...formData.features, classified_area: e.target.value}})} placeholder="Classified Area" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Saleable Area</label>
              <Input value={formData.features.saleable_area} onChange={e => setFormData({...formData, features: {...formData.features, saleable_area: e.target.value}})} placeholder="Saleable Area" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Extent</label>
              <Input value={formData.features.extent} onChange={e => setFormData({...formData, features: {...formData.features, extent: e.target.value}})} placeholder="Area Size" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">TSLR</label>
              <Input value={formData.features.tslr} onChange={e => setFormData({...formData, features: {...formData.features, tslr: e.target.value}})} placeholder="TSLR" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Water Source</label>
              <Input value={formData.features.water_source} onChange={e => setFormData({...formData, features: {...formData.features, water_source: e.target.value}})} placeholder="e.g. Borewell" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Water Depth</label>
              <Input value={formData.features.water_depth} onChange={e => setFormData({...formData, features: {...formData.features, water_depth: e.target.value}})} placeholder="Water Depth" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Soil Type</label>
              <Input value={formData.features.soil_type} onChange={e => setFormData({...formData, features: {...formData.features, soil_type: e.target.value}})} placeholder="e.g. Red Soil" className="h-12 rounded-xl bg-muted/30" />
            </div>

            {/* Selects for Yes/No attributes */}
            {['high_voltage_line', 'canal', 'presence_of_well', 'borewell', 'near_railway', 'near_water_body', 'near_burial_ground'].map((field) => (
              <div key={field} className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{field.replace(/_/g, ' ')}</label>
                <select 
                  className="flex h-12 w-full rounded-xl border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={(formData.features as any)[field]}
                  onChange={e => setFormData({...formData, features: {...formData.features, [field]: e.target.value}})}
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Financials */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Financials & Pricing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Business Mode</label>
              <Input value={formData.financials.business_mode} onChange={e => setFormData({...formData, financials: {...formData.financials, business_mode: e.target.value}})} placeholder="Outright / JV / Different Payment" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Land Price</label>
              <Input type="number" value={formData.financials.land_price} onChange={e => setFormData({...formData, financials: {...formData.financials, land_price: e.target.value}})} placeholder="Amount" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">DTCP Price</label>
              <Input type="number" value={formData.financials.dtcp_price} onChange={e => setFormData({...formData, financials: {...formData.financials, dtcp_price: e.target.value}})} placeholder="Amount" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">LO Price</label>
              <Input type="number" value={formData.financials.lo_price} onChange={e => setFormData({...formData, financials: {...formData.financials, lo_price: e.target.value}})} placeholder="Amount" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Registration Time</label>
              <Input value={formData.financials.registration_time} onChange={e => setFormData({...formData, financials: {...formData.financials, registration_time: e.target.value}})} placeholder="Registration Time" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Options</label>
              <Input value={formData.financials.payment_options} onChange={e => setFormData({...formData, financials: {...formData.financials, payment_options: e.target.value}})} placeholder="Payment Options" className="h-12 rounded-xl bg-muted/30" />
            </div>
          </div>
        </div>

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
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</label>
                    <Input value={layout.name} onChange={e => updateLayout(index, "name", e.target.value)} placeholder="Name" className="h-12 rounded-xl bg-muted/30" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price</label>
                    <Input type="number" value={layout.price} onChange={e => updateLayout(index, "price", e.target.value)} placeholder="Price" className="h-12 rounded-xl bg-muted/30" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Duration</label>
                    <Input value={layout.duration} onChange={e => updateLayout(index, "duration", e.target.value)} placeholder="Duration" className="h-12 rounded-xl bg-muted/30" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">No of Plots</label>
                    <div className="flex gap-2">
                      <Input type="number" value={layout.no_of_plots} onChange={e => updateLayout(index, "no_of_plots", e.target.value)} placeholder="Plots" className="h-12 rounded-xl bg-muted/30 flex-1" />
                      <Button type="button" variant="destructive" size="icon" className="h-12 w-12 rounded-xl shrink-0" onClick={() => removeLayout(index)}>
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
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
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">FMB / Layout Document (Max 1)</label>
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

        <div className="flex justify-end mt-8 border-t pt-6 border-border/40 pb-10">
          <Button type="button" variant="outline" className="mr-3 h-12 px-6 rounded-xl font-medium shadow-sm hover:bg-muted" onClick={() => router.push("/asset-inventory")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="h-12 px-8 rounded-xl bg-[#0052FF] hover:bg-[#0052FF]/90 font-medium shadow-md">
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Asset</>}
          </Button>
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
