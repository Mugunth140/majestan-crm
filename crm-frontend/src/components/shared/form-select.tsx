"use client";

import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FormSelectProps {
  name: string;
  placeholder: string;
  options: { label: string; value: string }[];
  required?: boolean;
  className?: string;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: any) => void;
  disabled?: boolean;
}

export function FormSelect({
  name,
  placeholder,
  options,
  required,
  className,
  value,
  defaultValue,
  onValueChange,
  disabled,
}: FormSelectProps) {
  // Build a value→label lookup so Select.Value can show the label, not the raw value string.
  // @base-ui resolves display text by calling the children render prop with the current value.
  const labelMap = useMemo(
    () => Object.fromEntries(options.map((o) => [o.value, o.label])),
    [options]
  );

  const isControlled = value !== undefined;
  const selectProps = isControlled 
    ? { value: value === null ? "" : value }
    : { defaultValue: defaultValue === null ? undefined : defaultValue };

  return (
    <Select name={name} required={required} onValueChange={onValueChange} disabled={disabled} {...selectProps}>
      <SelectTrigger
        className={cn(
          "w-full h-12! rounded-xl bg-muted/30 border-border/60 focus:ring-2 focus:ring-[#0052FF]/20 focus:border-[#0052FF] transition-all text-[15px]",
          className
        )}
      >
        <SelectValue placeholder={placeholder}>
          {(val: string | null) => (val && val !== "" ? (labelMap[val] ?? val) : placeholder)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-75" alignItemWithTrigger={false} side="bottom" align="start">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-[14.5px] py-2.5 px-5 cursor-pointer">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
