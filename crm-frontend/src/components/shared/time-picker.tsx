"use client";

import * as React from "react";
import { Clock, ChevronUp, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TimePickerProps {
  value?: string; // Format "HH:mm:ss" or "HH:mm"
  onChange?: (time: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function TimePicker({ value, onChange, placeholder = "Pick time", className }: TimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Parse initial value or default to 12:00 PM
  let defaultH24 = 12;
  let defaultMin = 0;
  if (value) {
    const parts = value.split(":");
    if (parts.length >= 2) {
      defaultH24 = parseInt(parts[0], 10);
      defaultMin = parseInt(parts[1], 10);
    }
  }

  const [hour24, setHour24] = React.useState(defaultH24);
  const [minute, setMinute] = React.useState(defaultMin);

  const hour12 = hour24 % 12 || 12;
  const ampm = hour24 >= 12 ? "PM" : "AM";

  const [hourInput, setHourInput] = React.useState<string>(hour12.toString());
  const [minuteInput, setMinuteInput] = React.useState<string>(minute.toString().padStart(2, '0'));

  React.useEffect(() => {
    if (!isOpen && value) {
      const parts = value.split(":");
      if (parts.length >= 2) {
        setHour24(parseInt(parts[0], 10));
        setMinute(parseInt(parts[1], 10));
      }
    }
  }, [value, isOpen]);

  React.useEffect(() => {
    setHourInput(hour12.toString());
    setMinuteInput(minute.toString().padStart(2, '0'));
  }, [hour12, minute]);

  const setTime = (h12: number, m: number, ap: "AM" | "PM") => {
    let newH24 = h12;
    if (ap === "PM" && h12 < 12) newH24 += 12;
    if (ap === "AM" && h12 === 12) newH24 = 0;
    
    setHour24(newH24);
    setMinute(m);
    
    if (onChange) {
      onChange(`${newH24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`);
    }
  };

  const commitHour = () => {
    let h = parseInt(hourInput, 10);
    if (isNaN(h)) {
      setHourInput(hour12.toString());
      return;
    }
    if (h < 1) h = 1;
    if (h > 12) h = 12;
    setTime(h, minute, ampm);
  };

  const commitMinute = () => {
    let m = parseInt(minuteInput, 10);
    if (isNaN(m)) {
      setMinuteInput(minute.toString().padStart(2, '0'));
      return;
    }
    if (m < 0) m = 0;
    if (m > 59) m = 59;
    setTime(hour12, m, ampm);
  };

  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") { e.preventDefault(); setTime(hour12 === 12 ? 1 : hour12 + 1, minute, ampm); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setTime(hour12 === 1 ? 12 : hour12 - 1, minute, ampm); }
    else if (e.key === "Enter") { e.preventDefault(); commitHour(); }
  };

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") { e.preventDefault(); setTime(hour12, (minute + 1) % 60, ampm); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setTime(hour12, (minute - 1 + 60) % 60, ampm); }
    else if (e.key === "Enter") { e.preventDefault(); commitMinute(); }
  };

  const toggleAmPm = () => {
    setTime(hour12, minute, ampm === "AM" ? "PM" : "AM");
  };

  const displayString = value ? (() => {
     const parts = value.split(":");
     let h = parseInt(parts[0], 10);
     const m = parts[1];
     const ap = h >= 12 ? "PM" : "AM";
     h = h % 12 || 12;
     return `${h}:${m} ${ap}`;
  })() : "";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger render={
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-medium bg-background hover:bg-muted/40 rounded-xl h-12 border-border/60 shadow-sm transition-all duration-200",
            !value && "text-muted-foreground font-normal",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
          {value ? <span>{displayString}</span> : <span>{placeholder}</span>}
        </Button>
      } />
      <PopoverContent 
        side="top"
        sideOffset={8}
        className="w-auto p-0 rounded-2xl shadow-2xl border-border/50 bg-background overflow-hidden animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 duration-150" 
        align="center"
      >
        <div className="p-6 bg-muted/5 flex flex-col gap-5 w-[250px]">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block text-center">Select Time</span>
            
            {/* Up/Down Time Picker */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {/* Hour Column */}
              <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-8 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md" onClick={() => setTime(hour12 === 12 ? 1 : hour12 + 1, minute, ampm)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <div className="relative group">
                  <input
                    className="w-12 h-12 text-center text-xl font-bold bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0052FF]/40 focus:border-[#0052FF] transition-all"
                    value={hourInput}
                    onChange={e => setHourInput(e.target.value)}
                    onBlur={commitHour}
                    onKeyDown={handleHourKeyDown}
                  />
                  <div className="absolute inset-0 pointer-events-none rounded-xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-8 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md" onClick={() => setTime(hour12 === 1 ? 12 : hour12 - 1, minute, ampm)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              <span className="text-2xl font-bold text-muted-foreground/50 pb-1">:</span>

              {/* Minute Column */}
              <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-8 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md" onClick={() => setTime(hour12, (minute + 1) % 60, ampm)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <div className="relative group">
                  <input
                    className="w-12 h-12 text-center text-xl font-bold bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0052FF]/40 focus:border-[#0052FF] transition-all"
                    value={minuteInput}
                    onChange={e => setMinuteInput(e.target.value)}
                    onBlur={commitMinute}
                    onKeyDown={handleMinuteKeyDown}
                  />
                  <div className="absolute inset-0 pointer-events-none rounded-xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-8 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md" onClick={() => setTime(hour12, (minute - 1 + 60) % 60, ampm)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              {/* AM/PM Toggle */}
              <div className="flex flex-col justify-center ml-2 h-full">
                <button
                  className="h-12 px-3 text-sm font-bold bg-[#0052FF]/10 text-[#0052FF] border border-[#0052FF]/20 rounded-xl hover:bg-[#0052FF]/20 transition-colors active:scale-95"
                  onClick={toggleAmPm}
                >
                  {ampm}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                className="flex-1 h-9 rounded-lg text-xs font-semibold"
                onClick={() => {
                  if (onChange) onChange(undefined);
                  setIsOpen(false);
                }}
              >
                Clear
              </Button>
              <Button 
                className="flex-1 h-9 bg-[#0052FF] hover:bg-[#0040CC] text-white rounded-lg text-xs font-semibold shadow-sm"
                onClick={() => setIsOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
