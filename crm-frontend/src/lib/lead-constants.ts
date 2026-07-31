export const LEAD_STATUS_STYLES: Record<string, string> = {
  "New Lead":             "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "Contacted":            "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  "Qualified":            "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400",
  "Property Shared":      "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  "Other Location":       "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400",
  "Interested":           "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
  "Site Visit Scheduled": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  "Site Visit Completed": "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
  "Re Visit Scheduled":   "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
  "Re Visit Completed":   "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400",
  "Negotiation":          "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400",
  "Booking Advance":      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Agreement":            "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400",
  "Closed Won":           "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  "Not Interested":       "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  "Dropped":              "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400",
  "Lost":                 "bg-red-200 text-red-900 border-red-300 dark:bg-red-900/50 dark:text-red-300",
  "Future Follow-up":     "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
};

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
