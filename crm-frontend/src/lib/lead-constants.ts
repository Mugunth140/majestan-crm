export const PURCHASE_TYPES = [
  { label: "Rental", value: "rental" },
  { label: "Construction", value: "construction" },
  { label: "Liasioning", value: "liasioning" },
  { label: "Property Management", value: "property_management" },
  { label: "Sale", value: "sale" },
  { label: "Buy", value: "buy" },
];

export const PURCHASE_TIMELINES = [
  { label: "Immediate", value: "immediate" },
  { label: "Within 30 Days", value: "within_30_days" },
  { label: "3 Months", value: "3_months" },
  { label: "6 Months", value: "6_months" },
  { label: "Just Enquiry", value: "just_enquiry" },
];

export const QUALIFICATION_PURPOSES = [
  { label: "Self Use", value: "self_use" },
  { label: "Investment", value: "investment" },
  { label: "Rental Income", value: "rental_income" },
  { label: "Business Use", value: "business_use" },
];

export const PROPERTY_CATEGORIES = [
  { label: "Residential", value: "residential" },
  { label: "Commercial", value: "commercial" },
  { label: "Industrial", value: "industrial" },
  { label: "Agricultural", value: "agricultural" },
  { label: "Institutional", value: "institutional" },
];

export const PROPERTY_TYPES_MAP: Record<string, { label: string; value: string }[]> = {
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

export const FUNDERS = [
  { label: "Self Funded", value: "self" },
  { label: "Bank Loan", value: "bank" },
];

export const PROJECTS = [
  { label: "Majestan Prestige", value: "majestan_prestige" },
  { label: "Majestan Heights", value: "majestan_heights" },
  { label: "Majestan Residency", value: "majestan_residency" },
  { label: "Majestan Enclave", value: "majestan_enclave" },
  { label: "Majestan Grand", value: "majestan_grand" },
];
