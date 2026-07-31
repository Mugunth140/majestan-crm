"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/shared/form-select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { 
  PURCHASE_TYPES, PURCHASE_TIMELINES, QUALIFICATION_PURPOSES, 
  PROPERTY_CATEGORIES, PROPERTY_TYPES_MAP, FUNDERS, PROJECTS 
} from "@/lib/lead-constants";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

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

interface EditRequirementModalProps {
  open: boolean;
  onClose: () => void;
  inquiry: any;
  leadId: number;
  onSuccess: () => void;
}

export function EditRequirementModal({ open, onClose, inquiry, leadId, onSuccess }: EditRequirementModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cities, setCities] = useState<{ id: number; city_name: string }[]>([]);
  const [subLocations, setSubLocations] = useState<{ id: number; locality_name: string }[]>([]);
  
  // State
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [selectedSubLocations, setSelectedSubLocations] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<any>({});

  // Initialize state when inquiry changes
  useEffect(() => {
    if (open && inquiry) {
      setSelectedCategory(inquiry.property_category || null);
      setSelectedType(inquiry.property_type || null);
      setSelectedCityId(inquiry.city_id || null);
      setSelectedSubLocations(inquiry.sub_locations || []);
      setPreferences(inquiry.preferences || {});
    }
  }, [open, inquiry]);

  // Fetch Cities
  useEffect(() => {
    if (open) {
      apiFetch(API_URL + "/leads/cities")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setCities(data.data);
        })
        .catch(() => {});
    }
  }, [open]);

  // Fetch Sub Locations
  useEffect(() => {
    if (selectedCityId) {
      apiFetch(API_URL + "/leads/sublocations?city_id=" + selectedCityId)
        .then(res => res.json())
        .then(data => {
          if (data.success) setSubLocations(data.data);
        })
        .catch(() => {});
    } else {
      setSubLocations([]);
    }
  }, [selectedCityId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      
      const payloadPreferences = { ...preferences };
      if (payloadPreferences.minBudget) {
        payloadPreferences.minBudget = parseIndianCurrency(payloadPreferences.minBudget);
      }
      if (payloadPreferences.maxBudget) {
        payloadPreferences.maxBudget = parseIndianCurrency(payloadPreferences.maxBudget);
      }

      const payload = {
        purchaseType: formData.get("purchaseType"),
        propertyCategory: selectedCategory,
        propertyType: selectedType,
        funder: formData.get("funder"),
        project: formData.get("project"),
        cityId: selectedCityId,
        subLocations: selectedSubLocations.length > 0 ? selectedSubLocations : null,
        purchaseTimeline: formData.get("purchaseTimeline"),
        qualificationPurpose: formData.get("qualificationPurpose"),
        decisionMaker: formData.get("decisionMaker"),
        preferences: payloadPreferences
      };

      const res = await apiFetch(`${API_URL}/leads/${leadId}/inquiries/${inquiry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Requirement updated successfully.");
        onSuccess();
        onClose();
      } else {
        toast.error(data.message || "Failed to update requirement");
      }
    } catch {
      toast.error("An error occurred while updating the requirement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!inquiry) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 pb-4 border-b sticky top-0 bg-background z-10">
            <DialogTitle>Edit Requirement</DialogTitle>
            <DialogDescription>
              Update the details, qualifications, and preferences for this specific requirement.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-8">
            {/* Core Details */}
            <div className="space-y-4">
              <h4 className="font-bold text-foreground">Core Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purchase / Service Type</label>
                  <FormSelect name="purchaseType" defaultValue={inquiry.purchase_type} placeholder="Select Purchase Type" options={PURCHASE_TYPES} required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Category</label>
                  <FormSelect 
                    name="propertyCategory" 
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
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Type</label>
                  <FormSelect 
                    name="propertyType" 
                    value={selectedType}
                    onValueChange={setSelectedType}
                    placeholder={selectedCategory ? "Select Property Type" : "Select Category First"} 
                    options={selectedCategory ? PROPERTY_TYPES_MAP[selectedCategory] || [] : []} 
                    disabled={!selectedCategory}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Funding</label>
                  <FormSelect name="funder" defaultValue={inquiry.funder} placeholder="Select Funding" options={FUNDERS} required />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project List</label>
                  <FormSelect name="project" defaultValue={inquiry.project_list} placeholder="Select Project" options={PROJECTS} />
                </div>
              </div>
            </div>

            {/* Buyer Qualification */}
            <div className="space-y-4">
              <h4 className="font-bold text-foreground">Buyer Qualification</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target City</label>
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
                </div>
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purchase Timeline</label>
                  <FormSelect name="purchaseTimeline" defaultValue={inquiry.purchase_timeline} placeholder="Select Timeline" options={PURCHASE_TIMELINES} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Qualification Purpose</label>
                  <FormSelect name="qualificationPurpose" defaultValue={inquiry.qualification_purpose} placeholder="Select Purpose" options={QUALIFICATION_PURPOSES} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Decision Maker</label>
                  <Input name="decisionMaker" defaultValue={inquiry.decision_maker} placeholder="e.g. Self, Spouse, Father" className="h-12 rounded-xl bg-muted/30" />
                </div>
              </div>
            </div>

            {/* Customer Preferences */}
            <div className="space-y-4">
              <h4 className="font-bold text-foreground">Customer Preferences</h4>
              {!selectedCategory ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Please select a Property Category above to define preferences.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <FormSelect name="_facing" placeholder="Select Facing" options={[{label: "North", value: "north"}, {label: "East", value: "east"}, {label: "South", value: "south"}, {label: "West", value: "west"}, {label: "North-East", value: "north_east"}]} value={preferences?.facing || null} onValueChange={v => setPreferences({...preferences, facing: v})} />
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
          </div>

          <DialogFooter className="p-6 pt-4 border-t sticky bottom-0 bg-background z-10">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#0052FF] text-white hover:bg-[#0040CC]">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Requirement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
