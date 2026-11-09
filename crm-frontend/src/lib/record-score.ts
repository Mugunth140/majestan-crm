// How complete a record is: the share of its key fields that are filled in,
// shown as a ring at the top of each record's side panel (Inbound shows its
// own listing-quality score there instead).

/** A key field: its name (for the "missing" hint) and its saved value. */
export type ScoreField = readonly [label: string, value: unknown];

/** Empty text, lists and objects don't count; 0 and false do (they're answers). */
export function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function completeness(fields: ScoreField[]): { score: number; missing: string[] } {
  if (!fields.length) return { score: 0, missing: [] };
  const missing = fields.filter(([, v]) => !isFilled(v)).map(([label]) => label);
  return { score: Math.round(((fields.length - missing.length) / fields.length) * 100), missing };
}

/** The ring's hover text: "72% complete · Missing: Email, Website". */
export function completenessLabel({ score, missing }: { score: number; missing: string[] }): string {
  if (!missing.length) return `${score}% complete`;
  const shown = missing.length > 6 ? `${missing.slice(0, 6).join(", ")} and ${missing.length - 6} more` : missing.join(", ");
  return `${score}% complete · Missing: ${shown}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- records arrive as loose API JSON */

export const leadScoreFields = (lead: any): ScoreField[] => [
  ["Name", lead.name],
  ["Mobile", lead.mobile_number],
  ["WhatsApp", lead.whatsapp_number],
  ["Email", lead.email],
  ["City", lead.city],
  ["Address", lead.address],
  ["Source", lead.lead_source],
  ["Assigned to", lead.assigned_staff_id],
  ["Requirement", lead.inquiries],
];

export const agentScoreFields = (agent: any): ScoreField[] => [
  ["Name", agent.name],
  ["Company", agent.company_name],
  ["Partner type", agent.partner_type],
  ["Category", agent.property_category],
  ["Mobile", agent.mobile_number],
  ["WhatsApp", agent.whatsapp_number],
  ["Email", agent.email],
  ["City", agent.city],
  ["State", agent.state],
  ["Commission", agent.commission_accepted ? agent.commission_type : agent.commission_accepted],
  ["Assigned to", agent.assigned_staff_id],
];

export const candidateScoreFields = (c: any): ScoreField[] => [
  ["Name", c.name],
  ["Mobile", c.mobile],
  ["WhatsApp", c.whatsapp],
  ["Email", c.email],
  ["City", c.city],
  ["State", c.state],
  ["Department", c.department],
  ["Position", c.position],
  ["Experience", c.experience],
  ["Notice period", c.noticePeriod],
  ["Current CTC", c.currentSalary],
  ["Expected CTC", c.expectedSalary],
  ["HR source", c.hrSourceId ?? c.recruitmentSource],
  ["Assigned to", c.assignedStaffId],
];

export const builderScoreFields = (b: any): ScoreField[] => [
  ["Name", b.name],
  ["Logo", b.logoUrl],
  ["Website", b.website],
  ["Phone", b.phone],
  ["Email", b.email],
  ["Experience", b.experienceYears],
  ["Completed projects", b.completedProjects],
  ["Ongoing projects", b.ongoingProjects],
  ["Description", b.description],
];

export const assetScoreFields = (a: any): ScoreField[] => {
  const loc = a.location ?? {};
  const fin = a.financials ?? {};
  const docs: any[] = a.documents ?? [];
  return [
    ["Owner", a.owner_name],
    ["Mobile", a.mobile_number],
    ["Type", a.type],
    ["Source", a.source],
    ["District", loc.district],
    ["Zone", loc.zone],
    ["Map pin", loc.google_pin],
    ["LO price", fin.lo_price],
    ["Expectation", fin.expectation],
    ["Business mode", fin.business_mode],
    ["Visited on", a.visited_date],
    ["Visited by", a.site_visited_done],
    ["Photos", docs.filter((d) => d.file_type === "image")],
    ["Documents", docs.filter((d) => d.file_type !== "image")],
    ["Assigned to", a.assigned_staff],
  ];
};

export const projectScoreFields = (p: any): ScoreField[] => [
  ["Name", p.name],
  ["Builder", p.builderName],
  ["Project type", p.projectType],
  ["RERA number", p.reraNumber],
  ["City", p.city],
  ["Locality", p.sublocation],
  ["Address", p.address],
  ["Pincode", p.pincode],
  ["Map pin", p.latitude],
  ["Possession status", p.possessionStatus],
  ["Possession date", p.possessionDate],
  ["Project area", p.projectAreaSqft],
  ["Total units", p.totalUnits],
  ["Description", p.description],
  ["Cover image", p.coverImageUrl],
  ["Gallery", p.galleryImageUrls],
  ["Brochure", p.brochureUrl ?? p.brochureKey],
  ["Amenities", p.projectAmenities],
  ["Highlights", p.highlights],
  ["Connectivity", p.connectivity],
];

/** A property's key fields; `visible` is the form's own rule, so each type is scored on what it can have. */
export const propertyScoreFields = (p: any, visible: (field: string) => boolean): ScoreField[] => {
  const det = p.propertyDetails ?? {};
  const loc = (p.propertyLocations ?? [])[0] ?? {};
  const plotLike = ["plot", "farmland"].includes(p.propertyType);
  const fields: ScoreField[] = [
    ["Title", p.title],
    ["Price", Number(p.propertyType === "coworking" ? det.rentPerSeat ?? p.price : p.price) > 0 || null],
    ["City", p.city],
    ["Locality", p.locality],
    ["Address", loc.address],
    ["Map pin", loc.latitude],
    ["Description", p.description],
    ["Photos", p.propertyImages ?? p.images],
    ["Owner name", p.ownerName],
    ["Owner phone", p.ownerPhone],
    ["Area", plotLike ? det.areaSqft : det.builtUpArea ?? det.areaSqft],
    ["Facing", det.propertyFacing],
    ["Connectivity", loc.localityData?.connectivity],
  ];
  const optional: [field: string, label: string, value: unknown][] = [
    ["bedrooms", "Bedrooms", det.bedrooms],
    ["bathrooms", "Bathrooms", det.bathrooms],
    ["furnishingStatus", "Furnishing status", det.furnishingStatus],
    ["possessionStatus", "Possession status", det.possessionStatus],
    ["totalFloors", "Total floors", det.totalFloors],
    ["amenityIds", "Amenities", p.amenitiesList],
  ];
  for (const [field, label, value] of optional) if (visible(field)) fields.push([label, value]);
  return fields;
};
