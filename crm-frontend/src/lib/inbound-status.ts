export const INBOUND_STATUS_OPTIONS = [
  { label: "Available", value: "available" },
  { label: "Not available", value: "not_available" },
  { label: "Fixed verification", value: "fixed_verification" },
  { label: "Verification done", value: "verification_done" },
];

/** Tone for an availability, by value or label. */
export function inboundStatusTone(value?: string | null): "green" | "red" | "amber" | "blue" {
  const v = INBOUND_STATUS_OPTIONS.find(o => o.value === value || o.label === value)?.value;
  return v === "available" ? "green" : v === "not_available" ? "red" : v === "verification_done" ? "blue" : "amber";
}

export function inboundStatusLabel(value?: string | null): string {
  return INBOUND_STATUS_OPTIONS.find(option => option.value === value)?.label || "—";
}
