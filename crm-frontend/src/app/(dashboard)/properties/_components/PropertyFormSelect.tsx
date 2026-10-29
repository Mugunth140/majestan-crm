"use client";

import type { ComponentProps } from "react";
import { FormSelect } from "@/components/shared/form-select";

const ABBREVIATIONS = new Set([
  "AC", "BHK", "CMDA", "DTCP", "EB", "FMB", "GST", "HP", "HT", "INR",
  "LT", "PG", "NA", "N/A", "RCC", "RERA", "TSLR", "UDS", "VLT", "CCTV", "IT",
]);

/** Presentation only: keep API/master values and meaningful abbreviations. */
export function propertyOptionLabel(label: string): string {
  return label.replace(/[A-Za-z]+/g, (word, offset: number) => {
    if (ABBREVIATIONS.has(word.toUpperCase())) return word.toUpperCase();
    // Keep technical codes such as 3BHK and 24/7 unchanged.
    if (offset > 0 && /\d/.test(label[offset - 1])) return word;
    if (word !== word.toUpperCase() && word !== word.toLowerCase()) return word;
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  });
}

export function PropertyFormSelect(props: ComponentProps<typeof FormSelect>) {
  const current = props.value ?? props.defaultValue;
  const options = props.options.map((option) => ({ ...option, label: propertyOptionLabel(option.label) }));
  if (current && !options.some((option) => option.value === current)) {
    options.push({ value: current, label: propertyOptionLabel(current) });
  }
  return <FormSelect {...props} options={options} />;
}
