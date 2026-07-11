"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FormSelect } from "@/components/shared/form-select";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Loader2, User, Phone, MapPin, Building2,
  Mail, Edit, RefreshCw, FileText, IndianRupee, Image as ImageIcon,
  CheckCircle, Shield, Briefcase
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUS_OPTIONS = [
  "Hold", "Verification Pending", "Verified", "Approved for Inventory",
  "Pending", "Revisit", "Reject", "Close", "Sold", "Rented"
];

const STATUS_STYLES: Record<string, string> = {
  "Hold": "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "Verification Pending": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  "Verified": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  "Approved for Inventory": "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Pending": "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
  "Revisit": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  "Reject": "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  "Close": "bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
  "Sold": "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  "Rented": "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400",
};

function PageSkeleton() {
  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex items-center justify-between pr-[150px] min-h-[48px] mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-6 w-24 rounded-md" />
            </div>
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto min-h-0 pb-6 pr-2">
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-card border rounded-2xl p-6 shadow-sm">
            <Skeleton className="h-5 w-48 mb-6" />
            <div className="grid grid-cols-2 gap-y-6 gap-x-6">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-1 bg-card border rounded-2xl p-6 shadow-sm">
            <Skeleton className="h-5 w-32 mb-6" />
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-24 mb-2" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
           <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <Skeleton className="h-5 w-40 mb-6" />
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
           </div>
           <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <Skeleton className="h-5 w-40 mb-6" />
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

export default function InboundViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [inbound, setInbound] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchInbound = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/inbounds/${id}`);
      const result = await res.json();
      if (result.success) {
        setInbound(result.data);
        setSelectedStatus(result.data.status || "Hold");
      } else { 
        toast.error("Inbound property not found"); 
        router.push("/inbound"); 
      }
    } catch {
      toast.error("Failed to load inbound details");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => { fetchInbound(); }, [fetchInbound]);

  const handleStatusUpdate = async () => {
    if (!selectedStatus) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`${API_URL}/inbounds/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Status updated successfully.");
        fetchInbound(true);
        setStatusModalOpen(false);
      } else {
        toast.error(data.message || "Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const renderQualityScore = (score: number) => {
    let label = "Needs Improvement";
    let cls = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400";
    
    if (score > 90) {
      label = "Premium";
      cls = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400";
    } else if (score > 75) {
      label = "Featured";
      cls = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
    } else if (score > 60) {
      label = "Standard";
      cls = "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400";
    }

    return (
      <div className="flex items-center gap-3">
        <Badge className={`font-bold px-3 py-1 shadow-sm border whitespace-nowrap text-[13px] ${cls}`}>
          {label} ({score}%)
        </Badge>
      </div>
    );
  };

  if (isLoading) return <PageSkeleton />;
  if (!inbound) return null;

  const statusName = inbound.status || "Hold";
  const badgeCls = STATUS_STYLES[statusName] ?? STATUS_STYLES["Hold"];

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* ── Header ── */}
      <div className="flex items-center justify-between pr-[150px] min-h-[48px] mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => router.push("/inbound")}>
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {inbound.property_id || inbound.propertyId || `Inbound #${inbound.id}`}
            </h1>
            <Badge className={`font-medium px-2.5 py-0.5 shadow-sm border ${badgeCls}`}>{statusName}</Badge>
            <span className="text-muted-foreground/40 text-xs">&bull;</span>
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              Created on {new Date(inbound.created_at || inbound.createdAt || inbound.date || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => fetchInbound(true)} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => router.push(`/inbound/new?edit=${inbound.id}`)} className="rounded-full px-8 py-5 bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md flex items-center gap-2">
            <Edit className="h-4 w-4" /> Edit Details
          </Button>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-6 pr-2 space-y-6">

        {/* Top Row: Basic Info & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-2 bg-card border rounded-2xl p-6 shadow-sm h-full">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Basic Information
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Property Category</p>
                <p className="text-[14px] font-medium text-foreground">{inbound.property_category || inbound.propertyCategory || "\u2014"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Property Type</p>
                <p className="text-[14px] font-medium text-foreground capitalize">{(inbound.property_type || inbound.propertyType || "").replace(/_/g, " ") || "\u2014"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">City</p>
                <p className="flex items-center gap-1.5 text-[14px] font-medium text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {inbound.city || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Expected Price / Rent</p>
                <p className="flex items-center gap-1 text-[14px] font-medium text-foreground">
                  <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" /> 
                  {inbound.price ? Number(inbound.price).toLocaleString("en-IN") : "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Area (Sq.ft)</p>
                <p className="text-[14px] font-medium text-foreground">{inbound.area_sqft || inbound.areaSqft || "\u2014"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Furnishing</p>
                <p className="text-[14px] font-medium text-foreground">{inbound.furnishing_status || inbound.furnishingStatus || "\u2014"}</p>
              </div>
              <div className="col-span-2 lg:col-span-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Full Address / Location</p>
                <p className="text-[14px] font-medium text-foreground/80">{inbound.address || inbound.location || "\u2014"}</p>
              </div>
            </div>
          </div>

          <div className="col-span-1 bg-card border rounded-2xl p-6 shadow-sm h-full flex flex-col">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" /> Actions & Score
            </h3>
            
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Quality Score</p>
              {renderQualityScore(Number(inbound.quality_score || inbound.qualityScore || 0))}
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
               <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Current Status</p>
                  <div className="flex items-center justify-between p-3 border rounded-xl bg-muted/20">
                     <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusName === "Reject" ? "bg-red-500" : statusName.includes("Verif") ? "bg-amber-500" : statusName === "Approved for Inventory" ? "bg-emerald-500" : "bg-blue-500"}`} />
                        <span className="text-sm font-semibold">{statusName}</span>
                     </div>
                     <Button variant="outline" size="sm" className="h-8 text-xs font-medium" onClick={() => setStatusModalOpen(true)}>
                        Change
                     </Button>
                  </div>
               </div>

               {inbound.assigned_to && (
                 <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 mt-2">Assigned To</p>
                    <p className="text-[14px] font-medium">{inbound.assigned_to.name || "Staff Member"}</p>
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* Row 2: Owner/Contact Info & Brokerage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-card border rounded-2xl p-6 shadow-sm">
             <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Owner & Contact Info
             </h3>
             <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Owner Name</span>
                  <span className="font-medium text-[14px]">{inbound.owner_name || inbound.ownerName || "\u2014"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Mobile Number</span>
                  <span className="font-medium text-[14px] flex items-center gap-2">
                     <Phone className="h-3 w-3 text-muted-foreground" /> {inbound.owner_mobile || inbound.mobile_number || "\u2014"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Email Address</span>
                  <span className="font-medium text-[14px] flex items-center gap-2">
                     <Mail className="h-3 w-3 text-muted-foreground" /> {inbound.owner_email || inbound.email || "\u2014"}
                  </span>
                </div>
             </div>
           </div>

           <div className="bg-card border rounded-2xl p-6 shadow-sm">
             <h3 className="text-base font-bold text-foreground border-b pb-3 mb-5 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" /> Brokerage Details
             </h3>
             <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Source</span>
                  <span className="font-medium text-[14px]">{inbound.source || "\u2014"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Channel Partner</span>
                  <span className="font-medium text-[14px]">{inbound.channel_partner_name || inbound.channelPartnerName || "\u2014"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Brokerage (%)</span>
                  <span className="font-medium text-[14px]">{inbound.brokerage_percent || inbound.brokeragePercent ? `${inbound.brokerage_percent || inbound.brokeragePercent}%` : "\u2014"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Remarks</span>
                  <span className="font-medium text-[14px] truncate max-w-[200px]" title={inbound.remarks}>{inbound.remarks || "\u2014"}</span>
                </div>
             </div>
           </div>
        </div>
      </div>

      {/* ── Status Change Modal ── */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-border/60">
          <DialogHeader className="p-6 pb-4 bg-muted/10 border-b">
            <DialogTitle className="text-lg">Update Status</DialogTitle>
            <DialogDescription>
              Change the progression status of this inbound property.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
               <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Status</label>
               <FormSelect 
                 name="inboundStatus" 
                 options={STATUS_OPTIONS.map(s => ({label: s, value: s}))}
                 value={selectedStatus}
                 onValueChange={(v) => setSelectedStatus(v || "")}
                 placeholder="Select Status"
               />
            </div>
            
            {selectedStatus && (
               <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-3 mt-2 border">
                  <Badge className={`font-medium shadow-sm border ${STATUS_STYLES[selectedStatus] ?? STATUS_STYLES["Hold"]}`}>
                     {selectedStatus}
                  </Badge>
               </div>
            )}
          </div>
          <DialogFooter className="p-4 bg-muted/10 border-t">
            <Button variant="outline" onClick={() => setStatusModalOpen(false)}>Cancel</Button>
            <Button 
               onClick={handleStatusUpdate} 
               disabled={isUpdatingStatus || !selectedStatus || selectedStatus === inbound.status}
               className="bg-[#0052FF] hover:bg-[#0040CC] text-white flex items-center gap-2"
            >
              {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
