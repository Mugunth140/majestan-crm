import { parseIndianCurrency } from "@/lib/indian-currency";
export const PG_CATEGORIES = [
  "Flat/Apartment",
  "Independent House / Villa",
  "Builder Floor",
  "1 RK / Studio Apartment",
  "Serviced Apartment",
];
export const PG_SERVICES = [
  "Laundry",
  "Electricity",
  "Water",
  "Wifi",
  "Housekeeping",
  "DTH",
];
export const PG_MEALS = ["Breakfast", "Lunch", "Dinner"];
export const PG_ROOM_ITEMS = [
  "AC",
  "TV",
  "Beds",
  "Wardrobe",
  "Light",
  "Fans",
  "Geyser",
  "Fridge",
  "Curtains",
  "Study Table",
];
export const PG_COMMON_ITEMS = [
  "TV",
  "AC",
  "Light",
  "Fans",
  "Sofa",
  "Wardrobe",
  "Geyser",
  "Washing Machine",
  "Stove",
  "Fridge",
  "Water Purifier",
  "Microwave",
  "Modular Kitchen",
  "Chimney",
  "Dining Table",
  "Curtains",
  "Exhaust Fan",
];
export const PG_SELECTS: [string, string, string[]][] = [
  ["category", "Accommodation category", PG_CATEGORIES],
  ["roomType", "Room type", ["Sharing", "Private"]],
  ["availableFor", "Available for", ["Girls", "Boys", "Any"]],
  ["depositType", "Security deposit", ["Fixed", "Multiple of Rent", "None"]],
  [
    "maintenancePeriod",
    "Maintenance period",
    ["Monthly", "Annually", "One Time", "Per Unit/Monthly"],
  ],
  ["foodAvailable", "Food availability", ["Available", "Not Available"]],
  ["mealType", "Meal type", ["Only Veg", "Veg & Non Veg"]],
  [
    "foodChargeType",
    "Charges for food",
    ["Included in rent", "Per meal basis", "Fixed monthly amount"],
  ],
  [
    "minimumContractMonths",
    "Minimum contract duration (months)",
    Array.from({ length: 37 }, (_, i) => String(i)),
  ],
  [
    "noticeMonths",
    "Months of notice",
    Array.from({ length: 7 }, (_, i) => String(i)),
  ],
  [
    "earlyLeavingType",
    "Early leaving charges",
    ["None", "Fixed", "Multiple of Rent"],
  ],
  ...["Pets", "Visitors", "Smoking", "Alcohol", "Party/Event"].map(
    (label) =>
      [
        label.toLowerCase().replace(/\W/g, "") + "Allowed",
        label + " allowed",
        ["Yes", "No"],
      ] as [string, string, string[]],
  ),
  [
    "lastEntryTime",
    "Last entry time",
    [
      "19:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
      "21:30",
      "22:00",
      "22:30",
      "23:00",
      "23:30",
      "00:00",
    ],
  ],
];
export const PG_COUNTS: [string, string][] = [
  ["sharingCount", "People sharing the room"],
  ["totalCapacity", "Total capacity"],
  ["availableCapacity", "Available capacity"],
  ["coveredParking", "Covered parking"],
  ["openParking", "Open parking"],
  ["depositMonths", "Deposit months"],
  ["earlyLeavingMonths", "Early leaving months"],
];
export const PG_MONEY: [string, string][] = [
  ["depositAmount", "Security deposit amount"],
  ["maintenanceAmount", "Maintenance"],
  ["bookingAmount", "Booking amount"],
  ["membershipCharge", "Membership charge"],
  ["foodMonthlyCharge", "Monthly food charge"],
  ["breakfastCharge", "Breakfast charge"],
  ["lunchCharge", "Lunch charge"],
  ["dinnerCharge", "Dinner charge"],
  ["earlyLeavingAmount", "Early leaving amount"],
];
export const PG_MULTI: [string, string, string[]][] = [
  ["suitableFor", "Suitable for", ["Students", "Working Professionals"]],
  [
    "otherRooms",
    "Other rooms",
    ["Pooja Room", "Study Room", "Servant Room", "Store Room"],
  ],
  ["weekdayMeals", "Meals on weekdays", PG_MEALS],
  ["weekendMeals", "Meals on weekends", PG_MEALS],
];
export const PG_FLAGS = [
  ["attachedBathroom", "Attached bathroom"],
  ["attachedBalcony", "Attached balcony"],
] as const;
export type PgDraft = Record<string, string>;
export function restorePgDetails(
  data: Record<string, unknown> | null | undefined,
): PgDraft {
  return Object.fromEntries(
    Object.entries(data ?? {}).map(([key, value]) => [
      key,
      value == null
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value),
    ]),
  );
}
export function pgFieldVisible(key: string, draft: PgDraft) {
  if (key === "sharingCount") return draft.roomType === "Sharing";
  if (["depositAmount", "depositMonths"].includes(key))
    return (
      draft.depositType ===
      (key === "depositAmount" ? "Fixed" : "Multiple of Rent")
    );
  if (["earlyLeavingAmount", "earlyLeavingMonths"].includes(key))
    return (
      draft.earlyLeavingType ===
      (key === "earlyLeavingAmount" ? "Fixed" : "Multiple of Rent")
    );
  if (
    ["mealType", "weekdayMeals", "weekendMeals", "foodChargeType"].includes(key)
  )
    return draft.foodAvailable === "Available";
  if (key === "foodMonthlyCharge")
    return (
      draft.foodAvailable === "Available" &&
      draft.foodChargeType === "Fixed monthly amount"
    );
  if (["breakfastCharge", "lunchCharge", "dinnerCharge"].includes(key))
    return (
      draft.foodAvailable === "Available" &&
      draft.foodChargeType === "Per meal basis"
    );
  return true;
}
export function pgPayload(
  draft: PgDraft,
  furnishingStatus?: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key] of PG_SELECTS)
    if (pgFieldVisible(key, draft))
      payload[key] = ["minimumContractMonths", "noticeMonths"].includes(key)
        ? draft[key]
          ? Number(draft[key])
          : null
        : (draft[key] ?? "");
  for (const [key] of PG_COUNTS)
    if (pgFieldVisible(key, draft))
      payload[key] = draft[key]?.trim() ? Number(draft[key]) : null;
  for (const [key] of PG_MONEY)
    if (pgFieldVisible(key, draft))
      payload[key] = draft[key]?.trim()
        ? parseIndianCurrency(draft[key])
        : null;
  for (const [key] of PG_FLAGS)
    if (draft[key] === "true" || draft[key] === "false")
      payload[key] = draft[key] === "true";
  for (const [key] of PG_MULTI)
    if (pgFieldVisible(key, draft)) payload[key] = readPgArray(draft[key]);
  for (const key of ["roomFurnishings", "commonFurnishings", "services"])
    if (
      draft[key] &&
      (key === "services" ||
        furnishingStatus === undefined ||
        isPgFurnished(furnishingStatus))
    )
      payload[key] = readPgArray(draft[key]);
  payload.otherRules = draft.otherRules ?? "";
  return payload;
}
export function readPgArray(value: string | undefined): any[] {
  try {
    const rows = JSON.parse(value || "[]");
    return Array.isArray(rows) ? rows.filter((row) => row != null) : [];
  } catch {
    return [];
  }
}
export function pgErrors(draft: PgDraft, furnishingStatus?: string): string[] {
  const errors: string[] = [];
  for (const [key, label] of PG_COUNTS)
    if (
      pgFieldVisible(key, draft) &&
      draft[key]?.trim() &&
      (!Number.isInteger(Number(draft[key])) || Number(draft[key]) < 0)
    )
      errors.push(`${label} must be a nonnegative whole number.`);
  if (
    draft.roomType === "Sharing" &&
    draft.sharingCount &&
    Number(draft.sharingCount) < 2
  )
    errors.push("A shared room needs at least two occupants.");
  if (
    draft.totalCapacity?.trim() &&
    draft.availableCapacity?.trim() &&
    Number(draft.availableCapacity) > Number(draft.totalCapacity)
  )
    errors.push("Available capacity cannot exceed total capacity.");
  for (const key of ["depositMonths"])
    if (pgFieldVisible(key, draft) && Number(draft[key]) > 30)
      errors.push("Rent multiples cannot exceed 30 months.");
  for (const [key, label] of PG_MONEY)
    if (
      pgFieldVisible(key, draft) &&
      draft[key]?.trim() &&
      (!Number.isFinite(parseIndianCurrency(draft[key])) ||
        parseIndianCurrency(draft[key]) < 0 ||
        (!parseIndianCurrency(draft[key]) && !/^0+(?:\.0+)?$/.test(draft[key])))
    )
      errors.push(`Enter a valid ${label.toLowerCase()}.`);
  for (const key of ["roomFurnishings", "commonFurnishings"])
    if (furnishingStatus === undefined || isPgFurnished(furnishingStatus))
      for (const row of readPgArray(draft[key]))
        if (!Number.isInteger(Number(row.count)) || Number(row.count) < 0)
          errors.push("Furnishing counts must be nonnegative whole numbers.");
  for (const row of readPgArray(draft.services))
    if (
      row.status === "Available for extra charge" &&
      row.amount != null &&
      (!Number.isFinite(Number(row.amount)) || Number(row.amount) < 0)
    )
      errors.push("Service charges must be nonnegative amounts.");
  return errors;
}

export function pgReadFields(
  data: Record<string, unknown> | null | undefined,
): { label: string; value: string }[] {
  if (!data) return [];
  const draft = restorePgDetails(data),
    rows: { label: string; value: string }[] = [];
  const add = (label: string, value: unknown) => {
    if (
      value != null &&
      value !== "" &&
      (!Array.isArray(value) || value.length)
    )
      rows.push({
        label,
        value: Array.isArray(value) ? value.join(", ") : String(value),
      });
  };
  for (const [key, label] of PG_SELECTS)
    if (pgFieldVisible(key, draft)) add(label, data[key]);
  for (const [key, label] of PG_COUNTS)
    if (pgFieldVisible(key, draft))
      add(
        key === "totalCapacity"
          ? `Total ${draft.roomType === "Private" ? "rooms" : "beds"} in PG`
          : key === "availableCapacity"
            ? `${draft.roomType === "Private" ? "Rooms" : "Beds"} available in PG`
            : label,
        data[key],
      );
  for (const [key, label] of PG_MONEY)
    if (pgFieldVisible(key, draft) && data[key] != null)
      add(label, `₹ ${Number(data[key]).toLocaleString("en-IN")}`);
  for (const [key, label] of PG_FLAGS)
    if (typeof data[key] === "boolean") add(label, data[key] ? "Yes" : "No");
  for (const [key, label] of PG_MULTI)
    if (pgFieldVisible(key, draft)) add(label, data[key]);
  for (const [key, label] of [
    ["roomFurnishings", "In room furnishings"],
    ["commonFurnishings", "Common area furnishings"],
  ])
    if (Array.isArray(data[key]))
      add(
        label,
        (data[key] as { item: string; count: number }[])
          .map((row) => `${row.item} × ${row.count}`)
          .join(", "),
      );
  if (Array.isArray(data.services))
    for (const row of data.services as {
      name: string;
      status: string;
      chargeType?: string;
      amount?: number | null;
    }[]) {
      const parts = [row.status];
      if (row.status === "Available for extra charge") {
        if (row.chargeType) parts.push(row.chargeType);
        if (row.chargeType !== "On consumption basis" && row.amount != null)
          parts.push(`₹ ${Number(row.amount).toLocaleString("en-IN")}`);
      }
      add(row.name, parts.filter(Boolean).join(" · "));
    }
  add("Other house rules", data.otherRules);
  return rows;
}

export function isPgFurnished(status: string | null | undefined): boolean {
  return ["furnished", "fullyfurnished", "semifurnished"].includes(
    String(status ?? "")
      .toLowerCase()
      .replace(/[^a-z]/g, ""),
  );
}
