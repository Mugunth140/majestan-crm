"use client";

import { GroupByPicker as FieldPicker } from "@/components/views/group-by-picker";

export const LEAD_GROUP_FIELDS = [
  { id: "status", label: "Status" },
  { id: "staff", label: "Assigned to" },
  { id: "source", label: "Source" },
  { id: "propertyType", label: "Property type" },
] as const;

export type LeadGroupField = (typeof LEAD_GROUP_FIELDS)[number]["id"];

// Toolbar control for the Leads Group By view.
export function GroupByPicker({ value, onChange }: { value: LeadGroupField; onChange: (field: LeadGroupField) => void }) {
  return <FieldPicker fields={LEAD_GROUP_FIELDS} value={value} onChange={onChange} />;
}
