"use client";

import * as React from "react";
import { format, addDays } from "date-fns";
import { Calendar as CalendarIcon, ChevronUp, ChevronDown } from "lucide-react";

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

export function DateTimePicker({ value, onChange, placeholder = "Pick your date & time", className }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Internal time state for 12-hour format
  const [hour, setHour] = React.useState(12);
  const [minute, setMinute] = React.useState(0);
  const [ampm, setAmpm] = React.useState<"AM" | "PM">("AM");

  // Sync internal state with external value
  React.useEffect(() => {
    if (value) {
      const h24 = value.getHours();
      setHour(h24 % 12 || 12);
      setMinute(value.getMinutes());
      setAmpm(h24 >= 12 ? "PM" : "AM");
    }
  }, [value]);

  const updateExternalValue = (newHour: number, newMinute: number, newAmpm: "AM" | "PM") => {
    let h24 = newHour;
    if (newAmpm === "AM" && h24 === 12) h24 = 0;
    if (newAmpm === "PM" && h24 !== 12) h24 += 12;

    if (value) {
      const newDate = new Date(value);
      newDate.setHours(h24, newMinute, 0, 0);
      onChange?.(newDate);
    } else {
      // If no date selected yet, default to today when they change time
      const newDate = new Date();
      newDate.setHours(h24, newMinute, 0, 0);
      onChange?.(newDate);
    }
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange?.(undefined);
      return;
    }
    const newDate = new Date(date);
    let h24 = hour;
    if (ampm === "AM" && h24 === 12) h24 = 0;
    if (ampm === "PM" && h24 !== 12) h24 += 12;
    
    newDate.setHours(h24, minute, 0, 0);
    onChange?.(newDate);
  };

  const setQuickDate = (days: number) => {
    const targetDate = addDays(new Date(), days);
    let h24 = hour;
    if (ampm === "AM" && h24 === 12) h24 = 0;
    if (ampm === "PM" && h24 !== 12) h24 += 12;

    targetDate.setHours(h24, minute, 0, 0);
    onChange?.(targetDate);
  };

  // Time controls
  const incrementHour = () => {
    const newHour = hour === 12 ? 1 : hour + 1;
    setHour(newHour);
    updateExternalValue(newHour, minute, ampm);
  };
  const decrementHour = () => {
    const newHour = hour === 1 ? 12 : hour - 1;
    setHour(newHour);
    updateExternalValue(newHour, minute, ampm);
  };
  const incrementMinute = () => {
    const newMinute = minute >= 55 ? 0 : minute + 5; // Jump by 5 mins for better UX, or 1? Let's do 1.
    setMinute(newMinute);
    updateExternalValue(hour, newMinute, ampm);
  };
  // Better to increment by 1 for exact precision
  const incMin = () => {
    const newMinute = minute === 59 ? 0 : minute + 1;
    setMinute(newMinute);
    updateExternalValue(hour, newMinute, ampm);
  };
  const decMin = () => {
    const newMinute = minute === 0 ? 59 : minute - 1;
    setMinute(newMinute);
    updateExternalValue(hour, newMinute, ampm);
  };
  const toggleAmpm = () => {
    const newAmpm = ampm === "AM" ? "PM" : "AM";
    setAmpm(newAmpm);
    updateExternalValue(hour, minute, newAmpm);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger render={
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal bg-muted/30 hover:bg-muted/50 rounded-xl h-11 border-border/50 shadow-sm",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "MMM do, yyyy - hh:mm a") : <span>{placeholder}</span>}
        </Button>
      } />
      <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl overflow-hidden border-border/60" align="start">
        
        {/* Top Quick Actions */}
        <div className="flex items-center justify-between p-1.5 border-b border-border/40 bg-muted/10">
          <Button variant="ghost" size="sm" onClick={() => setQuickDate(0)} className="flex-1 rounded-lg text-xs font-medium hover:bg-primary/10 hover:text-primary">Today</Button>
          <Button variant="ghost" size="sm" onClick={() => setQuickDate(1)} className="flex-1 rounded-lg text-xs font-medium hover:bg-primary/10 hover:text-primary">Tomorrow</Button>
          <Button variant="ghost" size="sm" onClick={() => setQuickDate(7)} className="flex-1 rounded-lg text-xs font-medium hover:bg-primary/10 hover:text-primary">Next Week</Button>
        </div>

        <div className="flex">
          {/* Left Calendar */}
          <div className="p-3">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleSelect}
              className="p-0 pointer-events-auto"
              classNames={{
                today: "bg-transparent border border-primary text-primary font-bold data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:border-none", 
              }}
            />
          </div>
          
          {/* Right Time Picker Controls */}
          <div className="p-3 flex items-center justify-center border-l border-border/40 bg-muted/5">
            <div className="flex items-center gap-1">
              {/* Hour */}
              <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={incrementHour}>
                  <ChevronUp className="h-5 w-5" />
                </Button>
                <div className="w-10 h-10 flex items-center justify-center bg-muted/50 rounded-lg text-sm font-semibold border border-border/50 shadow-inner">
                  {hour.toString().padStart(2, '0')}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={decrementHour}>
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </div>

              <span className="text-xl font-light text-muted-foreground/50 pb-1">:</span>

              {/* Minute */}
              <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={incMin}>
                  <ChevronUp className="h-5 w-5" />
                </Button>
                <div className="w-10 h-10 flex items-center justify-center bg-muted/50 rounded-lg text-sm font-semibold border border-border/50 shadow-inner">
                  {minute.toString().padStart(2, '0')}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={decMin}>
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </div>

              {/* AM/PM */}
              <div className="flex flex-col items-center gap-1 ml-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={toggleAmpm}>
                  <ChevronUp className="h-5 w-5" />
                </Button>
                <div className="w-10 h-10 flex items-center justify-center bg-muted/50 rounded-lg text-sm font-semibold border border-border/50 shadow-inner">
                  {ampm}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={toggleAmpm}>
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
