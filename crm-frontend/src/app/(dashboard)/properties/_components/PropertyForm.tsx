"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { MobileHeader } from "@/components/layout/mobile-header";
import { apiFetch } from "@/lib/api-fetch";
import { propertiesApi } from "@/lib/properties-api";
import { Property } from "./PropertyTable";
import {
  ArrowLeft,
  Loader2,
  Save,
  UploadCloud,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROPERTY_TYPE_OPTIONS = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
  { value: "commercial", label: "Commercial Space" },
  { value: "coworking", label: "Co-working" },
  { value: "farmland", label: "Farmland" },
  { value: "industrial", label: "Industrial" },
  { value: "individual_portion", label: "Independent House" },
];

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "sold", label: "Sold" },
  { value: "rented", label: "Rented" },
  { value: "unavailable", label: "Unavailable" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface City {
  id: number;
  cityName: string;
}

interface Sublocation {
  id: number;
  localityName: string;
  cityId: number;
}

interface FormDataShape {
  cities: City[];
  sublocations: Sublocation[];
}

interface UploadedImage {
  imageUrl: string;
  fileName: string;
  previewUrl: string;
}

interface PropertyFormProps {
  mode: "create" | "edit";
  initialData?: Property;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PropertyForm({ mode, initialData, onSuccess }: PropertyFormProps) {
  const router = useRouter();

  // ---- Meta state ----
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFormData, setIsLoadingFormData] = useState(true);
  const [formData, setFormData] = useState<FormDataShape>({ cities: [], sublocations: [] });

  // ---- Field state ----
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [listingType, setListingType] = useState<"Buy" | "Rent">(
    initialData?.listingType === "Rent" ? "Rent" : "Buy"
  );
  const [propertyType, setPropertyType] = useState(initialData?.propertyType ?? "");
  const [status, setStatus] = useState(initialData?.status ?? "available");

  const [price, setPrice] = useState(initialData?.price ? String(initialData.price) : "");
  const [negotiable, setNegotiable] = useState(false);

  const [cityId, setCityId] = useState<string>("");
  const [sublocationId, setSublocationId] = useState<string>("");

  const [bedrooms, setBedrooms] = useState(initialData?.bedrooms ? String(initialData.bedrooms) : "");
  const [bathrooms, setBathrooms] = useState(initialData?.bathrooms ? String(initialData.bathrooms) : "");
  const [areaSqft, setAreaSqft] = useState(initialData?.areaSqft ? String(initialData.areaSqft) : "");

  const [ownerName, setOwnerName] = useState(initialData?.ownerName ?? "");
  const [ownerPhone, setOwnerPhone] = useState(initialData?.ownerPhone ?? "");
  const [ownerEmail, setOwnerEmail] = useState("");

  const [description, setDescription] = useState(initialData?.description ?? "");

  // ---- Image upload state ----
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadTotalCount, setUploadTotalCount] = useState(0);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // ---- Load form data (cities & sublocations) ----
  useEffect(() => {
    setIsLoadingFormData(true);
    propertiesApi
      .formData()
      .then((data: any) => {
        if (data) {
          setFormData({
            cities: data.cities ?? [],
            sublocations: data.sublocations ?? [],
          });
        }
      })
      .catch(() => {
        toast.error("Failed to load form data.");
      })
      .finally(() => setIsLoadingFormData(false));
  }, []);

  // ---- Filtered sublocations based on selected city ----
  const filteredSublocations = cityId
    ? formData.sublocations.filter((s) => String(s.cityId) === cityId)
    : [];

  // ---- Handle city change (reset locality) ----
  const handleCityChange = (val: string) => {
    setCityId(val);
    setSublocationId("");
  };

  // ---- Image upload logic ----
  const handleImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    // Reset the input so the same files can be re-selected if removed
    if (imgInputRef.current) imgInputRef.current.value = "";

    setUploadTotalCount(files.length);
    setUploadingCount(files.length);

    const newImages: UploadedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // 1. Get presigned URL from site backend (via /site-api rewrite)
        const presignedRes = await apiFetch(
          `/site-api/properties/presigned-url?fileName=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}`
        );
        if (!presignedRes.ok) throw new Error("Failed to get presigned URL");
        const presignedData = await presignedRes.json();
        const { uploadUrl, imageUrl } = presignedData;

        // 2. PUT file directly to R2 (no auth header)
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) throw new Error("Failed to upload image");

        // 3. Store result
        newImages.push({
          imageUrl,
          fileName: file.name,
          previewUrl: URL.createObjectURL(file),
        });
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      } finally {
        setUploadingCount((prev) => prev - 1);
      }
    }

    setUploadedImages((prev) => [...prev, ...newImages]);
    setUploadTotalCount(0);
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].previewUrl);
      next.splice(index, 1);
      return next;
    });
  };

  // ---- Validation ----
  const validate = (): string | null => {
    if (!title.trim()) return "Title is required.";
    if (!listingType) return "Listing type is required.";
    if (!propertyType) return "Property type is required.";
    if (!price || isNaN(Number(price))) return "A valid price is required.";
    return null;
  };

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsLoading(true);
    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        listingType: listingType === "Buy" ? "Sell" : "Rent",
        propertyType,
        price: Number(price),
        negotiable,
        status,
        cityId: cityId ? Number(cityId) : undefined,
        sublocationId: sublocationId ? Number(sublocationId) : undefined,
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        areaSqft: areaSqft ? Number(areaSqft) : undefined,
        ownerName: ownerName.trim() || undefined,
        ownerPhone: ownerPhone.trim() || undefined,
        ownerEmail: ownerEmail.trim() || undefined,
        description: description.trim() || undefined,
        imageUrls: uploadedImages.map((img, idx) => ({
          imageUrl: img.imageUrl,
          imageKey: "",
          isPrimary: idx === 0,
        })),
      };

      // Remove undefined fields
      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined) delete payload[k];
      });

      let result: any;
      if (mode === "create") {
        result = await propertiesApi.create(payload);
      } else {
        result = await propertiesApi.update(initialData!.id, payload);
      }

      if (result && result.success === false) {
        toast.error(result.message ?? `Failed to ${mode} property.`);
        return;
      }

      toast.success(`Property ${mode === "create" ? "created" : "updated"} successfully!`);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/properties");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Render ----
  if (isLoadingFormData) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
          <p className="text-muted-foreground font-medium">Loading form data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2.5 md:px-0 mt-2 md:mt-0 mb-20 md:mb-0">
      <MobileHeader title={mode === "create" ? "Add Property" : "Edit Property"} showBack />

      {/* Desktop header */}
      <div className="hidden md:flex items-center gap-4 min-h-[48px]">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={() => router.push("/properties")}
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === "create" ? "Add New Property" : "Edit Property"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "create"
              ? "Enter the details for the new property."
              : "Update the details for this property."}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
            e.preventDefault();
          }
        }}
        className="space-y-6"
      >
        {/* ---- Basic Info ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Basic Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Title */}
            <div className="space-y-2 lg:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Title *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 3 BHK Apartment in Anna Nagar"
                required
                className="h-12 rounded-xl bg-muted/30"
              />
            </div>

            {/* Listing Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Listing Type *
              </label>
              <div className="flex gap-2">
                {(["Buy", "Rent"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setListingType(type)}
                    className={`flex-1 h-12 rounded-xl border font-semibold text-sm transition-all ${
                      listingType === type
                        ? "bg-[#0052FF] text-white border-[#0052FF] shadow-md"
                        : "bg-muted/30 text-muted-foreground border-border/60 hover:bg-muted/60"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Property Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Property Type *
              </label>
              <FormSelect
                name="propertyType"
                placeholder="Select Type"
                options={PROPERTY_TYPE_OPTIONS}
                value={propertyType || null}
                onValueChange={setPropertyType}
                required
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Status
              </label>
              <FormSelect
                name="status"
                placeholder="Select Status"
                options={STATUS_OPTIONS}
                value={status || null}
                onValueChange={setStatus}
              />
            </div>
          </div>
        </div>

        {/* ---- Pricing ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Pricing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Price */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Price *
              </label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 5000000"
                required
                min={0}
                className="h-12 rounded-xl bg-muted/30"
              />
            </div>

            {/* Negotiable */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Negotiable
              </label>
              <div className="flex items-center space-x-3 bg-muted/10 border border-border/40 p-4 h-12 rounded-xl transition-colors hover:bg-muted/30">
                <Checkbox
                  id="negotiable"
                  checked={negotiable}
                  onCheckedChange={(checked) => setNegotiable(!!checked)}
                />
                <label
                  htmlFor="negotiable"
                  className="text-sm font-semibold cursor-pointer flex-1"
                >
                  Price is negotiable
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ---- Location ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Location</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* City */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                City
              </label>
              <FormSelect
                name="cityId"
                placeholder="Select City"
                options={formData.cities.map((c) => ({
                  value: String(c.id),
                  label: c.cityName,
                }))}
                value={cityId || null}
                onValueChange={handleCityChange}
              />
            </div>

            {/* Locality */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Locality
              </label>
              <FormSelect
                name="sublocationId"
                placeholder={cityId ? "Select Locality" : "Select a city first"}
                options={filteredSublocations.map((s) => ({
                  value: String(s.id),
                  label: s.localityName,
                }))}
                value={sublocationId || null}
                onValueChange={setSublocationId}
                disabled={!cityId || filteredSublocations.length === 0}
              />
            </div>
          </div>
        </div>

        {/* ---- Details ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Bedrooms */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Bedrooms
              </label>
              <Input
                type="number"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                placeholder="e.g. 3"
                min={0}
                className="h-12 rounded-xl bg-muted/30"
              />
            </div>

            {/* Bathrooms */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Bathrooms
              </label>
              <Input
                type="number"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                placeholder="e.g. 2"
                min={0}
                className="h-12 rounded-xl bg-muted/30"
              />
            </div>

            {/* Area */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Area (sq ft)
              </label>
              <Input
                type="number"
                value={areaSqft}
                onChange={(e) => setAreaSqft(e.target.value)}
                placeholder="e.g. 1200"
                min={0}
                className="h-12 rounded-xl bg-muted/30"
              />
            </div>
          </div>
        </div>

        {/* ---- Owner ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Owner</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Owner Name
              </label>
              <Input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="John Doe"
                className="h-12 rounded-xl bg-muted/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Owner Phone
              </label>
              <Input
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="h-12 rounded-xl bg-muted/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Owner Email
              </label>
              <Input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@email.com"
                className="h-12 rounded-xl bg-muted/30"
              />
            </div>
          </div>
        </div>

        {/* ---- Images ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Images</h3>

          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageFiles}
          />

          {/* Upload area */}
          <div
            onClick={() => imgInputRef.current?.click()}
            className="border-2 border-dashed border-border/60 rounded-xl h-[120px] flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors mb-4"
          >
            <UploadCloud className="h-6 w-6 text-muted-foreground mb-2" />
            <span className="text-sm font-medium text-foreground">
              Click to upload images
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              First image will be set as primary
            </span>
          </div>

          {/* Upload progress */}
          {uploadingCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading {uploadTotalCount - uploadingCount + 1} of {uploadTotalCount}...
            </div>
          )}

          {/* Thumbnails */}
          {uploadedImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {uploadedImages.map((img, idx) => (
                <div
                  key={idx}
                  className="relative border border-border rounded-xl overflow-hidden bg-muted/10 group"
                >
                  <img
                    src={img.previewUrl}
                    alt={img.fileName}
                    className="w-full h-28 object-cover"
                  />
                  {idx === 0 && (
                    <span className="absolute top-1.5 left-1.5 bg-[#0052FF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      Primary
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center transition-colors"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="px-2 py-1.5">
                    <p className="text-xs text-muted-foreground truncate" title={img.fileName}>
                      {img.fileName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- Description ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Description</h3>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the property, key features, surroundings, etc."
            rows={5}
            className="rounded-xl bg-muted/30 resize-none"
          />
        </div>

        {/* ---- Actions ---- */}
        <div className="flex justify-between mt-8 border-t pt-6 border-border/40 pb-10">
          <Button
            type="button"
            variant="outline"
            className="h-12 px-6 rounded-xl font-medium shadow-sm hover:bg-muted"
            onClick={() => router.push("/properties")}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={isLoading || uploadingCount > 0}
            className="h-12 px-8 rounded-xl bg-[#0052FF] hover:bg-[#0052FF]/90 font-medium shadow-md"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {mode === "create" ? "Create Property" : "Update Property"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
