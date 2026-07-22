"use client";

import * as React from "react";
import { format, addDays, endOfWeek, nextMonday, addMonths } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", className }: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(value);

  // Sync internal state when popover opens
  React.useEffect(() => {
    if (isOpen) {
      setInternalDate(value);
    }
  }, [isOpen, value]);

  const SHORTCUTS = [
    { label: "Today", date: new Date() },
    { label: "Tomorrow", date: addDays(new Date(), 1) },
    { label: "Next Week", date: addDays(new Date(), 7) },
    { label: "End of Week", date: endOfWeek(new Date(), { weekStartsOn: 1 }) },
    { label: "Next Monday", date: nextMonday(new Date()) },
    { label: "Next Month", date: addMonths(new Date(), 1) },
  ];

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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger render={
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-medium bg-background hover:bg-muted/40 rounded-xl h-9 border-border/60 shadow-sm transition-all duration-200",
            !value && "text-muted-foreground font-normal",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
          {value ? format(value, "MMM d, yyyy") : <span>{placeholder}</span>}
        </Button>
      } />
      <PopoverContent
        side="bottom"
        sideOffset={8}
        className="w-auto p-0 rounded-2xl shadow-2xl border-border/50 bg-background overflow-hidden animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 duration-150"
        align="start"
      >
        <div className="flex">
          {/* Shortcuts Sidebar */}
          <div className="flex flex-col border-r border-border/40 p-3 gap-1 bg-muted/10 w-40">
            <span className="text-xs font-semibold text-muted-foreground px-2 pb-1.5 pt-1 uppercase tracking-wider">
              Shortcuts
            </span>
            {SHORTCUTS.map((s, i) => (
              <Button
                key={i}
                variant="ghost"
                onClick={() => setInternalDate(s.date)}
                className="justify-start text-[13px] font-medium h-8 rounded-lg text-foreground/80 hover:bg-primary/10 hover:text-blue-600 transition-colors px-3"
              >
                {s.label}
              </Button>
            ))}
            <div className="mt-auto pt-4">
              <Button
                variant="ghost"
                onClick={handleClear}
                className="w-full justify-start text-[13px] text-muted-foreground hover:text-red-500 hover:bg-red-50 h-8 rounded-lg px-3"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Calendar */}
          <div className="flex flex-col">
            <div className="p-4">
              <Calendar
                mode="single"
                selected={internalDate}
                onSelect={setInternalDate}
                captionLayout="dropdown"
                className="p-0"
                classNames={{
                  today:
                    "bg-blue-500/10 text-blue-600 border border-blue-200 font-bold dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:border-transparent",
                }}
                modifiers={{ weekend: { dayOfWeek: [0, 6] } }}
                modifiersClassNames={{ weekend: "text-muted-foreground opacity-70" }}
              />
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border/40 bg-muted/10 flex items-center justify-between">
              <div className="text-[13px] font-medium text-foreground/80 px-2">
                {internalDate ? format(internalDate, "EEEE, d MMMM yyyy") : "No date selected"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-8 rounded-lg text-xs font-semibold px-4 hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="h-8 rounded-lg text-xs font-semibold px-5 bg-blue-500 hover:bg-blue-600 text-white shadow-md"
                >
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
