export const INBOUND_STATUS_OPTIONS = [
  { label: "Available", value: "available" },
  { label: "Not available", value: "not_available" },
  { label: "Fixed verification", value: "fixed_verification" },
];

export function inboundStatusLabel(value?: string | null): string {
  return INBOUND_STATUS_OPTIONS.find(option => option.value === value)?.label || "—";
}
