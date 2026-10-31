"use client";
import { Checkbox } from "@/components/ui/checkbox";
export function parseMultiValue(
  value: string,
  options: readonly string[] = [],
): string[] {
  if (!value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
    )
      return [...new Set(parsed)];
  } catch {
    /* Existing selections may be stored as plain text. */
  }
  return options.includes(value)
    ? [value]
    : [
        ...new Set(
          value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ];
}
export function PropertyMultiSelect({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const selected = parseMultiValue(value, options);
  const choices = [
    ...options,
    ...selected.filter((item) => !options.includes(item)),
  ];
  return (
    <details className="relative rounded-xl border border-border bg-muted/30">
      <summary
        title={selected.join(", ")}
        className="min-h-12 cursor-pointer px-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {selected.length
          ? selected.length > 2
            ? `${selected.length} selected`
            : selected.join(", ")
          : `Select ${name.toLowerCase()}`}
      </summary>
      <div
        role="group"
        aria-label={name}
        className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border bg-popover p-2 shadow-md"
      >
        {choices.map((choice) => (
          <label
            key={choice}
            className="flex cursor-pointer items-start gap-3 rounded-lg p-2 text-sm hover:bg-muted"
          >
            <Checkbox
              checked={selected.includes(choice)}
              onCheckedChange={(checked) =>
                onChange(
                  (checked
                    ? [...selected, choice]
                    : selected.filter((item) => item !== choice)
                  ).join(", "),
                )
              }
            />
            {choice}
          </label>
        ))}
      </div>
    </details>
  );
}
