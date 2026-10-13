export const PROPERTY_TABS = ["Available", "Review Queue", "Archived"] as const;

export function propertyTabStatus(tab: string): "available" | "review" | "archived" {
  if (tab === "Review Queue") return "review";
  return tab === "Archived" ? "archived" : "available";
}
