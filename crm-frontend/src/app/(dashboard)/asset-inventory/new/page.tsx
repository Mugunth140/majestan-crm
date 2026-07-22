"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Save, UploadCloud, X, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { FormSelect } from "@/components/shared/form-select";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function AssetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [assetData, setAssetData] = useState<any>(null);

  const [formData, setFormData] = useState({
    owner_name: "",
    mobile_number: "",
    location: { district: "", taluk: "", village: "", road_name: "", distance_from_main: "", site_location: "", google_pin: "" },
    features: { extent: "", soil_type: "", water_source: "" },
    financials: { land_price: "", dtcp_price: "", expectation: "", payment_options: "" }
  });

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
              owner_name: data.data.owner_name || "",
              mobile_number: data.data.mobile_number || "",
              location: data.data.location || {},
              features: data.data.features || {},
              financials: data.data.financials || {}
            });
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

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      
      const payload = {
        ...formData,
        financials: {
          ...formData.financials,
          land_price: formData.financials.land_price ? Number(formData.financials.land_price) : undefined,
          dtcp_price: formData.financials.dtcp_price ? Number(formData.financials.dtcp_price) : undefined,
          expectation: formData.financials.expectation ? Number(formData.financials.expectation) : undefined,
        }
      };

      // 1. Create or Update Asset
      const res = await fetch(`${API_URL}/assets${editId ? `/${editId}` : ""}`, {
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

        const mediaRes = await fetch(`${API_URL}/assets/${assetId}/media`, {
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
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => router.push("/asset-inventory")}>
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
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Owner Name *</label>
              <Input value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} placeholder="John Doe" required className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile Number *</label>
              <Input value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} placeholder="+91 98765 43210" required className="h-12 rounded-xl bg-muted/30" />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Location Details</h3>
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
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Road Name</label>
              <Input value={formData.location.road_name} onChange={e => setFormData({...formData, location: {...formData.location, road_name: e.target.value}})} placeholder="Road Name" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Site Location</label>
              <Input value={formData.location.site_location} onChange={e => setFormData({...formData, location: {...formData.location, site_location: e.target.value}})} placeholder="Site Location" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Google Pin</label>
              <Input value={formData.location.google_pin} onChange={e => setFormData({...formData, location: {...formData.location, google_pin: e.target.value}})} placeholder="Maps link" className="h-12 rounded-xl bg-muted/30" />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Features & Surroundings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Extent</label>
              <Input value={formData.features.extent} onChange={e => setFormData({...formData, features: {...formData.features, extent: e.target.value}})} placeholder="Area Size" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Soil Type</label>
              <Input value={formData.features.soil_type} onChange={e => setFormData({...formData, features: {...formData.features, soil_type: e.target.value}})} placeholder="e.g. Red Soil" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Water Source</label>
              <Input value={formData.features.water_source} onChange={e => setFormData({...formData, features: {...formData.features, water_source: e.target.value}})} placeholder="e.g. Borewell" className="h-12 rounded-xl bg-muted/30" />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Financials & Pricing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Land Price</label>
              <Input type="number" value={formData.financials.land_price} onChange={e => setFormData({...formData, financials: {...formData.financials, land_price: e.target.value}})} placeholder="Amount" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">DTCP Price</label>
              <Input type="number" value={formData.financials.dtcp_price} onChange={e => setFormData({...formData, financials: {...formData.financials, dtcp_price: e.target.value}})} placeholder="Amount" className="h-12 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expectation</label>
              <Input type="number" value={formData.financials.expectation} onChange={e => setFormData({...formData, financials: {...formData.financials, expectation: e.target.value}})} placeholder="Amount" className="h-12 rounded-xl bg-muted/30" />
            </div>
          </div>
        </div>

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
                  <Button variant="ghost" size="icon" className="text-red-500 flex-shrink-0" onClick={() => setDocumentFile(null)}>
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
