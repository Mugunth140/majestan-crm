"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatIndianCurrencyWords, parseIndianCurrency } from "@/lib/indian-currency";

interface PriceInputProps {
  value?: string;
  defaultValue?: string | number;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  min?: number;
  step?: string;
  name?: string;
}

export function PriceInput({
  value,
  defaultValue,
  onChange,
  placeholder,
  className,
  type = "text",
  min,
  step,
  name,
}: PriceInputProps) {
  const [internal, setInternal] = useState(
    defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : ""
  );
  const current = value !== undefined ? value : internal;
  const numeric = type === "number" ? Number(current) : parseIndianCurrency(current);
  const caption = current !== "" && numeric > 0 ? formatIndianCurrencyWords(numeric) : "";
  return (
    <div className="space-y-1">
      <Input
        type={type}
        min={min}
        step={step}
        name={name}
        value={current}
        onChange={(e) => {
          if (value === undefined) setInternal(e.target.value);
          onChange?.(e.target.value);
        }}
        placeholder={placeholder ?? "e.g. 1.2Cr or 80L"}
        className={cn("h-12 rounded-xl bg-muted/30", className)}
      />
      {caption && (
        <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 pl-1">
          {caption}
        </p>
      )}
    </div>
  );
}
