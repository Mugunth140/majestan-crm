"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FormSelectProps {
  name: string;
  placeholder: string;
  options: { label: string; value: string }[];
  required?: boolean;
  className?: string;
  value?: string;
  onValueChange?: (value: string | null) => void;
  disabled?: boolean;
}

export function FormSelect({ 
  name, 
  placeholder, 
  options, 
  required, 
  className,
  value,
  onValueChange,
  disabled 
}: FormSelectProps) {
  return (
    <Select name={name} required={required} value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger 
        className={cn(
          "h-12! min-w-64! max-w-full! rounded-xl bg-muted/30 border-border/60 focus:ring-2 focus:ring-[#0052FF]/20 focus:border-[#0052FF] transition-all text-[15px]",
          className
        )}
      >
      <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-75">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-[14.5px] py-2.5 px-5 cursor-pointer">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
