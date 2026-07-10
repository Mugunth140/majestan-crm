"use client";

import * as React from "react";
import { format, addDays, endOfWeek, nextMonday, addMonths} from "date-fns";
import { Calendar as CalendarIcon, Globe, ChevronUp, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateTimePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({ value, onChange, placeholder = "Pick date & time", className }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(value);

  // Time state derived from internalDate
  const hour24 = internalDate ? internalDate.getHours() : 12;
  const hour12 = hour24 % 12 || 12;
  const minute = internalDate ? internalDate.getMinutes() : 0;
  const ampm = hour24 >= 12 ? "PM" : "AM";

  const [hourInput, setHourInput] = React.useState<string>(hour12.toString());
  const [minuteInput, setMinuteInput] = React.useState<string>(minute.toString().padStart(2, '0'));

  React.useEffect(() => {
    setHourInput(hour12.toString());
    setMinuteInput(minute.toString().padStart(2, '0'));
  }, [hour12, minute]);

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

  // Sync internal state when popover opens
  React.useEffect(() => {
    if (isOpen) {
      setInternalDate(value);
    }
  }, [isOpen, value]);

  const updateInternalDate = (newDate: Date | undefined) => {
    if (!newDate) {
      setInternalDate(undefined);
      return;
    }
    // If we only updated the date part, ensure time is preserved
    if (internalDate) {
      newDate.setHours(internalDate.getHours(), internalDate.getMinutes(), 0, 0);
    } else {
      newDate.setHours(0, 0, 0, 0); // Start of day if no previous time
    }
    setInternalDate(newDate);
  };

  const setTime = (h12: number, min: number, ap: "AM" | "PM") => {
    let h24 = h12;
    if (ap === "AM" && h24 === 12) h24 = 0;
    if (ap === "PM" && h24 !== 12) h24 += 12;
    
    const targetDate = internalDate ? new Date(internalDate) : new Date();
    targetDate.setHours(h24, min, 0, 0);
    setInternalDate(targetDate);
  };

  const handleApply = () => {
    onChange?.(internalDate);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  const handleClear = () => {
    setInternalDate(undefined);
  };

  const applyQuickTime = (h24: number, min: number) => {
    const targetDate = internalDate ? new Date(internalDate) : new Date();
    targetDate.setHours(h24, min, 0, 0);
    setInternalDate(targetDate);
  };

  const QUICK_TIMES = [
    { label: "9:30 AM", h: 9, m: 30 },
    { label: "11:30 AM", h: 11, m: 30 },
    { label: "1:45 PM", h: 13, m: 45 },
    { label: "3:30 PM", h: 15, m: 30 },
    { label: "4:45 PM", h: 16, m: 45 },
    { label: "6:30 PM", h: 18, m: 30 },
  ];

  const SHORTCUTS = [
    { label: "Today", date: new Date() },
    { label: "Tomorrow", date: addDays(new Date(), 1) },
    { label: "Next Week", date: addDays(new Date(), 7) },
    { label: "End of Week", date: endOfWeek(new Date(), { weekStartsOn: 1 }) },
    { label: "Next Monday", date: nextMonday(new Date()) },
    { label: "Next Month", date: addMonths(new Date(), 1) },
  ];

  // Increment/Decrement handlers
  const incHour = () => {
    const newH12 = hour12 === 12 ? 1 : hour12 + 1;
    setTime(newH12, minute, ampm);
  };
  const decHour = () => {
    const newH12 = hour12 === 1 ? 12 : hour12 - 1;
    setTime(newH12, minute, ampm);
  };
  const incMin = () => {
    let newMin = minute + 5;
    if (newMin >= 60) newMin = newMin - 60;
    setTime(hour12, newMin, ampm);
  };
  const decMin = () => {
    let newMin = minute - 5;
    if (newMin < 0) newMin = 60 + newMin;
    setTime(hour12, newMin, ampm);
  };
  const toggleAmPm = () => {
    setTime(hour12, minute, ampm === "AM" ? "PM" : "AM");
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger render={
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-medium bg-background hover:bg-muted/40 rounded-xl h-11 border-border/60 shadow-sm transition-all duration-200",
            !value && "text-muted-foreground font-normal",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          {value ? format(value, "MMM do, yyyy - hh:mm a") : <span>{placeholder}</span>}
        </Button>
      } />
      <PopoverContent 
        side="top"
        sideOffset={8}
        className="w-auto p-0 rounded-2xl shadow-2xl border-border/50 bg-background overflow-hidden animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 duration-150" 
        align="start"
      >
        <div className="flex flex-col md:flex-row">
          {/* Smart Shortcuts Sidebar */}
          <div className="flex md:flex-col border-b md:border-b-0 md:border-r border-border/40 p-3 gap-1 bg-muted/10 w-full md:w-44 overflow-x-auto hide-scrollbar">
            <span className="text-xs font-semibold text-muted-foreground px-2 pb-1.5 pt-1 uppercase tracking-wider hidden md:block">Shortcuts</span>
            {SHORTCUTS.map((s, i) => (
              <Button 
                key={i} 
                variant="ghost" 
                onClick={() => updateInternalDate(s.date)}
                className="justify-start text-[13px] font-medium h-8 rounded-lg text-foreground/80 hover:bg-primary/10 hover:text-blue-600 transition-colors px-3 whitespace-nowrap"
              >
                {s.label}
              </Button>
            ))}
            <div className="mt-auto hidden md:block pt-4">
              <Button variant="ghost" onClick={handleClear} className="w-full justify-start text-[13px] text-muted-foreground hover:text-red-500 hover:bg-red-50 h-8 rounded-lg px-3">
                Clear Selection
              </Button>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex flex-col sm:flex-row">
              {/* Calendar Section */}
              <div className="p-4 border-r border-border/40">
                <Calendar
                  mode="single"
                  selected={internalDate}
                  onSelect={updateInternalDate}
                  captionLayout="dropdown"
                  className="p-0"
                  classNames={{
                    today: "bg-blue-500/10 text-blue-600 border border-blue-200 font-bold dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:border-transparent",
                  }}
                  modifiers={{ weekend: { dayOfWeek: [0, 6] } }}
                  modifiersClassNames={{ weekend: "text-muted-foreground opacity-70" }}
                />
              </div>
              
              {/* Time Section */}
              <div className="p-4 w-full sm:w-60 bg-muted/5 flex flex-col gap-5">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Time</span>
                  
                  {/* Up/Down Time Picker */}
                  <div className="flex items-center justify-center gap-2 mb-6">
                    {/* Hour */}
                    <div className="flex flex-col items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={incHour}>
                        <ChevronUp className="h-5 w-5" />
                      </Button>
                      <input
                        type="text"
                        value={hourInput}
                        onChange={(e) => setHourInput(e.target.value)}
                        onBlur={commitHour}
                        onKeyDown={(e) => e.key === "Enter" && commitHour()}
                        className="w-11 h-11 text-center bg-background rounded-xl text-lg font-bold border border-border/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={decHour}>
                        <ChevronDown className="h-5 w-5" />
                      </Button>
                    </div>

                    <span className="text-xl font-light text-muted-foreground/50 pb-1">:</span>

                    {/* Minute */}
                    <div className="flex flex-col items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={incMin}>
                        <ChevronUp className="h-5 w-5" />
                      </Button>
                      <input
                        type="text"
                        value={minuteInput}
                        onChange={(e) => setMinuteInput(e.target.value)}
                        onBlur={commitMinute}
                        onKeyDown={(e) => e.key === "Enter" && commitMinute()}
                        className="w-11 h-11 text-center bg-background rounded-xl text-lg font-bold border border-border/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={decMin}>
                        <ChevronDown className="h-5 w-5" />
                      </Button>
                    </div>

                    {/* AM/PM */}
                    <div className="flex flex-col items-center gap-1 ml-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={toggleAmPm}>
                        <ChevronUp className="h-5 w-5" />
                      </Button>
                      <div className="w-11 h-11 flex items-center justify-center bg-muted/40 rounded-xl text-sm font-bold border border-border/50 shadow-inner">
                        {ampm}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={toggleAmPm}>
                        <ChevronDown className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Quick Time Chips */}
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Quick Times</span>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_TIMES.map((qt, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => applyQuickTime(qt.h, qt.m)}
                        className="h-7 text-xs px-2.5 rounded-lg border-border/60 hover:border-blue-500 hover:text-blue-600 font-medium transition-colors"
                      >
                        {qt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="mt-auto">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Globe className="h-3 w-3" />
                    <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border/40 bg-muted/10 flex items-center justify-between">
              <div className="text-[13px] font-medium text-foreground/80 px-2">
                {internalDate ? format(internalDate, "EEEE, d MMMM yyyy • hh:mm a") : "No date selected"}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleCancel} className="h-8 rounded-lg text-xs font-semibold px-4 hover:bg-muted">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleApply} className="h-8 rounded-lg text-xs font-semibold px-5 bg-blue-500 hover:bg-blue-600 text-white shadow-md">
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
