"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Loader2, MapPin, Building2, Briefcase, FileText, IndianRupee, Image as ImageIcon, Map, Layers, RefreshCw, FileImage, Edit } from "lucide-react";
import { MobileHeader } from "@/components/layout/mobile-header";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

function PageSkeleton() {
  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

function SectionField({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col gap-1 py-2 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">{label}</span>
      <span className="font-medium text-[14px] text-foreground">{String(value)}</span>
    </div>
  );
}

export default function AssetViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [asset, setAsset] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAsset = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/assets/${id}`);
      const result = await res.json();
      if (result.success) setAsset(result.data);
      else { toast.error("Asset not found"); router.push("/asset-inventory"); }
    } catch {
      toast.error("Failed to load asset details");
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchAsset(); }, [fetchAsset]);

  if (isLoading) return <PageSkeleton />;
  if (!asset) return null;

  const location = asset.location || {};
  const features = asset.features || {};
  const financials = asset.financials || {};
  const layouts = asset.layouts || [];

  return (
    <div className="flex flex-col md:h-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* ── Mobile Header ── */}
      <MobileHeader title={`Asset #${asset.id}`} showBack />

      {/* ── Header (desktop only) ── */}
      <div className="hidden md:flex items-center justify-between pr-[150px] min-h-[48px] mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => router.push("/asset-inventory")}>
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Asset #{asset.id} - {asset.owner_name}
            </h1>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              {asset.status || "New"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={fetchAsset} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => router.push(`/asset-inventory/new?edit=${asset.id}`)} className="rounded-full px-8 py-5 bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md">
            Edit Asset
          </Button>
        </div>
      </div>

      {/* ── Mobile Summary Strip ── */}
      <div className="md:hidden flex flex-col gap-3 px-4 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">{asset.status || "New"}</Badge>
          <span className="text-sm font-semibold text-muted-foreground">{asset.owner_name}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => router.push(`/asset-inventory/new?edit=${asset.id}`)} className="h-11 rounded-xl text-foreground font-semibold border-border/60">
            <Edit className="w-4 h-4 mr-2 text-muted-foreground" /> Edit
          </Button>
          <Button variant="outline" onClick={fetchAsset} className="h-11 rounded-xl border-border/60 font-semibold text-foreground">
            <RefreshCw className="w-4 h-4 mr-2 text-muted-foreground" /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 px-4 lg:px-0 lg:pr-2">
        
        {/* Core Details & Financials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#0052FF]" /> Core Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <SectionField label="Owner Name" value={asset.owner_name} />
              <SectionField label="Mobile Number" value={asset.mobile_number} />
              <SectionField label="Source" value={asset.source} />
              <SectionField label="Mediator Name" value={asset.mediator_name} />
              <SectionField label="CP Reference Name" value={asset.cp_reference_name} />
              <div className="sm:col-span-2">
                <SectionField label="Remarks" value={asset.remarks} />
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-emerald-600" /> Financials & Pricing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <SectionField label="Business Mode" value={financials.business_mode} />
              <SectionField label="Registration Time" value={financials.registration_time} />
              <SectionField label="Land Price" value={financials.land_price} />
              <SectionField label="DTCP Price" value={financials.dtcp_price} />
              <SectionField label="LO Price" value={financials.lo_price} />
              <SectionField label="Expectation" value={financials.expectation} />
              <div className="sm:col-span-2">
                <SectionField label="Payment Options" value={financials.payment_options} />
              </div>
            </div>
          </div>
        </div>

        {/* Geography & Physical Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-500" /> Geography & Approach
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <SectionField label="District" value={location.district} />
              <SectionField label="Taluk" value={location.taluk} />
              <SectionField label="Village" value={location.village} />
              <SectionField label="Zone" value={location.zone} />
              <SectionField label="Junction Name" value={location.junction_name} />
              <SectionField label="Distance from Airport" value={location.distance_from_airport} />
              <SectionField label="Firka Range" value={location.firka_range} />
              <SectionField label="HACA Range" value={location.haca_range} />
              <SectionField label="Road Name" value={location.road_name} />
              <SectionField label="Adjacent Layout" value={location.adjacent_layout} />
              <SectionField label="Approached Roads" value={location.approached_roads} />
              <SectionField label="Approached Road Width" value={location.approached_road_width} />
              <SectionField label="Site Location" value={location.site_location} />
              {location.google_pin && (
                <div className="flex flex-col gap-1 py-2 border-b border-border/30 last:border-0 sm:col-span-2">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Google Pin</span>
                  <a href={location.google_pin} target="_blank" rel="noreferrer" className="font-medium text-[14px] text-[#0052FF] hover:underline flex items-center gap-1">
                    <Map className="h-3 w-3" /> View on Map
                  </a>
                </div>
              )}
              <SectionField label="Latitude" value={location.latitude} />
              <SectionField label="Longitude" value={location.longitude} />
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-500" /> Physical Features
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <SectionField label="Classification Type" value={features.classification_type} />
              <SectionField label="Classified Area" value={features.classified_area} />
              <SectionField label="Saleable Area" value={features.saleable_area} />
              <SectionField label="Extent" value={features.extent} />
              <SectionField label="TSLR" value={features.tslr} />
              <SectionField label="Water Source" value={features.water_source} />
              <SectionField label="Water Depth" value={features.water_depth} />
              <SectionField label="Soil Type" value={features.soil_type} />
              <SectionField label="High Voltage Line" value={features.high_voltage_line} />
              <SectionField label="Canal" value={features.canal} />
              <SectionField label="Presence of Well" value={features.presence_of_well} />
              <SectionField label="Borewell" value={features.borewell} />
              <SectionField label="Near Railway" value={features.near_railway} />
              <SectionField label="Near Water Body" value={features.near_water_body} />
              <SectionField label="Near Burial Ground" value={features.near_burial_ground} />
            </div>
          </div>
        </div>

        {/* Layouts Table */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4 text-teal-500" /> Layout Details
          </h3>
          {layouts.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">No layouts defined for this asset.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold rounded-tl-lg">Layout No</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Duration</th>
                    <th className="px-4 py-3 font-semibold rounded-tr-lg">No of Plots</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {layouts.map((l: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/10">
                      <td className="px-4 py-3 font-medium">{l.layout_no || "-"}</td>
                      <td className="px-4 py-3">{l.name || "-"}</td>
                      <td className="px-4 py-3">{l.price ? `₹${l.price}` : "-"}</td>
                      <td className="px-4 py-3">{l.duration || "-"}</td>
                      <td className="px-4 py-3 font-semibold">{l.no_of_plots || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Documents & Media */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
            <FileImage className="h-4 w-4 text-pink-500" /> Documents & Media
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" /> Document
              </h4>
              {!asset.documents || asset.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No document uploaded.</p>
              ) : (
                <div className="space-y-3">
                  {asset.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-xl bg-muted/10">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="h-8 w-8 text-blue-500 shrink-0" />
                        <div>
                          <p className="text-sm font-medium truncate">{doc.file_name || "Document"}</p>
                          <p className="text-xs text-muted-foreground uppercase">{doc.document_type || "File"}</p>
                        </div>
                      </div>
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#0052FF] hover:underline px-3 py-1.5 border border-[#0052FF]/30 rounded-lg hover:bg-[#0052FF]/5">
                        View
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> Images
              </h4>
              {!asset.images || asset.images.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No images uploaded.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {asset.images.map((img: any) => (
                    <a key={img.id} href={img.file_url} target="_blank" rel="noreferrer" className="block relative aspect-video border rounded-xl overflow-hidden hover:opacity-90 transition-opacity">
                      <img src={img.file_url} alt="Site Photo" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
