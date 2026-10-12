"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FloorNosInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function FloorNosInput({
  value,
  onChange,
  placeholder = "e.g. 8, 12, 13",
  className = "",
}: FloorNosInputProps) {
  const [inputValue, setInputValue] = useState("");

  // Parse stored string into sorted, unique numbers
  const parseFloors = (str: string): number[] => {
    if (!str || !str.trim()) return [];
    const nums = str
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n >= 0);
    return Array.from(new Set(nums)).sort((a, b) => a - b);
  };

  const currentFloors = parseFloors(value);

  const addFloor = (val: string) => {
    const rawTokens = val.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    const validNums: number[] = [];
    for (const t of rawTokens) {
      const n = Number(t);
      if (Number.isInteger(n) && n >= 0) {
        validNums.push(n);
      }
    }
    if (validNums.length === 0) return;

    const merged = Array.from(new Set([...currentFloors, ...validNums])).sort(
      (a, b) => a - b
    );
    onChange(merged.join(", "));
    setInputValue("");
  };

  const removeFloor = (floorToRemove: number) => {
    const filtered = currentFloors.filter((f) => f !== floorToRemove);
    onChange(filtered.join(", "));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addFloor(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && currentFloors.length > 0) {
      e.preventDefault();
      removeFloor(currentFloors[currentFloors.length - 1]);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addFloor(inputValue);
    }
  };

  return (
    <div
      className={`min-h-[48px] rounded-xl bg-muted/30 border border-input p-1.5 flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${className}`}
    >
      {currentFloors.map((floor) => (
        <Badge
          key={floor}
          variant="secondary"
          className="h-7 px-2.5 rounded-lg text-xs font-semibold gap-1.5 bg-background border shadow-xs text-foreground shrink-0"
        >
          <span>{floor}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeFloor(floor);
            }}
            className="hover:bg-muted rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            title={`Remove floor ${floor}`}
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      <input
        type="text"
        inputMode="numeric"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={currentFloors.length === 0 ? placeholder : "Add floor..."}
        className="flex-1 min-w-[70px] bg-transparent text-sm px-2 py-1 outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
