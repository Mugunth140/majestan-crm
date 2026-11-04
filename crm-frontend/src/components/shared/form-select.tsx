"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OptionSearchList } from "@/components/shared/option-search-list";
import { cn } from "@/lib/utils";

interface FormSelectProps {
  id?: string;
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
  id,
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
    <Select name={name} required={required} onValueChange={(nextValue) => onValueChange?.(nextValue ?? "")} disabled={disabled} {...selectProps}>
      <SelectTrigger
        id={id}
        className={cn(
          "w-full h-12! rounded-xl bg-muted/30 border-border/60 focus:ring-2 focus:ring-[#0052FF]/20 focus:border-[#0052FF] transition-all text-[15px]",
          className
        )}
      >
        <SelectValue placeholder={placeholder}>
          {(val: string | null) => (val && val !== "" ? (labelMap[val] ?? val) : placeholder)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]" alignItemWithTrigger={false} side="bottom" align="start">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-[14.5px] py-2.5 px-5 cursor-pointer">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * FormSelect with a search box, for long lists (localities). Looks like the
 * other selects; the list opens in a popover so typing filters it.
 */
export function SearchableFormSelect({
  id, name, placeholder, options, className, value, onValueChange, disabled, searchPlaceholder,
}: Omit<FormSelectProps, "defaultValue" | "required"> & { searchPlaceholder?: string }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            id={id}
            type="button"
            name={name}
            disabled={disabled}
            aria-haspopup="listbox"
            className={cn(
              "flex w-full h-12! items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 text-left text-[15px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 disabled:cursor-not-allowed disabled:opacity-50 data-[popup-open]:border-ring",
              className,
            )}
          />
        }
      >
        <span className={cn("min-w-0 flex-1 truncate", !current && !value && "text-muted-foreground")}>{current?.label ?? (value || placeholder)}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-[240px] gap-0 p-0">
        <OptionSearchList
          options={options}
          value={value}
          label={placeholder}
          placeholder={searchPlaceholder}
          onPick={(v) => { setOpen(false); if (v !== value) onValueChange?.(v); }}
        />
      </PopoverContent>
    </Popover>
  );
}

