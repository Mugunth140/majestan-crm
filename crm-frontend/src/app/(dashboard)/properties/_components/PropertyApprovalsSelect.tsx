"use client";
import { Checkbox } from "@/components/ui/checkbox";
export const APPROVAL_OPTIONS = [
  "CMDA",
  "LPA",
  "DTCP",
  "Corporation Approved",
  "Village Panchayat",
];
export function parseApprovals(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
export function PropertyApprovalsSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = parseApprovals(value);
  const options = [
    ...APPROVAL_OPTIONS,
    ...selected.filter((item) => !APPROVAL_OPTIONS.includes(item)),
  ];
  return (
    <details className="relative rounded-md border border-border bg-muted/40 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-white/[0.04]">
      <summary className="min-h-9 cursor-pointer px-2.5 py-2 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {selected.length ? selected.join(", ") : "Select approvals"}
      </summary>
      <div
        role="group"
        aria-label="Approvals"
        className="absolute z-20 mt-1 w-full rounded-lg border bg-popover p-2 shadow-md"
      >
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-3 rounded-lg p-2 text-sm hover:bg-muted"
          >
            <Checkbox
              checked={selected.includes(option)}
              onCheckedChange={(checked) =>
                onChange(
                  (checked
                    ? [...selected, option]
                    : selected.filter((item) => item !== option)
                  ).join(", "),
                )
              }
            />
            {option}
          </label>
        ))}
      </div>
    </details>
  );
}
