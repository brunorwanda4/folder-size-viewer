import * as React from "react";
import { format, subDays, startOfDay, endOfDay, startOfYear } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon, Clock, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface SearchDateFilterProps {
  modifiedFrom?: number;
  modifiedTo?: number;
  onChange: (from?: number, to?: number) => void;
}

export function SearchDateFilter({
  modifiedFrom,
  modifiedTo,
  onChange,
}: SearchDateFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"range" | "multiple">("range");

  const today = React.useMemo(() => new Date(), []);

  // State for Range Mode (comp-491)
  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    if (modifiedFrom || modifiedTo) {
      return {
        from: modifiedFrom ? new Date(modifiedFrom) : undefined,
        to: modifiedTo ? new Date(modifiedTo) : undefined,
      };
    }
    return undefined;
  });

  // State for Multiple Dates Mode (comp-493)
  const [multipleDates, setMultipleDates] = React.useState<Date[] | undefined>(undefined);

  // Sync internal state if external props clear
  React.useEffect(() => {
    if (!modifiedFrom && !modifiedTo) {
      setRange(undefined);
      setMultipleDates(undefined);
    }
  }, [modifiedFrom, modifiedTo]);

  const handleRangeSelect = (selectedRange: DateRange | undefined) => {
    if (!selectedRange) {
      setRange(undefined);
      onChange(undefined, undefined);
      return;
    }

    const now = new Date();
    // Clamp future dates to today
    let fromDate = selectedRange.from;
    if (fromDate && fromDate > now) {
      fromDate = now;
    }

    let toDate = selectedRange.to;
    if (toDate && toDate > now) {
      toDate = now;
    }

    const clampedRange = { from: fromDate, to: toDate };
    setRange(clampedRange);

    const fromMs = fromDate ? startOfDay(fromDate).getTime() : undefined;
    const toMs = toDate
      ? endOfDay(toDate).getTime()
      : fromDate
      ? endOfDay(fromDate).getTime()
      : undefined;

    onChange(fromMs, toMs);
  };

  const handleMultipleSelect = (selectedDates: Date[] | undefined) => {
    if (!selectedDates || selectedDates.length === 0) {
      setMultipleDates(undefined);
      onChange(undefined, undefined);
      return;
    }

    const now = new Date();
    // Exclude any future dates
    const validDates = selectedDates.filter((d) => d <= now);
    if (validDates.length === 0) {
      setMultipleDates(undefined);
      onChange(undefined, undefined);
      return;
    }

    setMultipleDates(validDates);

    const timestamps = validDates.map((d) => d.getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    onChange(startOfDay(minDate).getTime(), endOfDay(maxDate).getTime());
  };

  const handleApplyPreset = (preset: "today" | "yesterday" | "7days" | "30days" | "90days" | "year") => {
    const now = new Date();
    let from: Date;
    let to: Date = endOfDay(now);

    switch (preset) {
      case "today":
        from = startOfDay(now);
        break;
      case "yesterday": {
        const y = subDays(now, 1);
        from = startOfDay(y);
        to = endOfDay(y);
        break;
      }
      case "7days":
        from = startOfDay(subDays(now, 7));
        break;
      case "30days":
        from = startOfDay(subDays(now, 30));
        break;
      case "90days":
        from = startOfDay(subDays(now, 90));
        break;
      case "year":
        from = startOfYear(now);
        break;
    }

    setRange({ from, to });
    setActiveTab("range");
    onChange(from.getTime(), to.getTime());
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRange(undefined);
    setMultipleDates(undefined);
    onChange(undefined, undefined);
  };

  const isFiltered = Boolean(modifiedFrom || modifiedTo);

  // Label formatting for button
  const getFilterLabel = () => {
    if (activeTab === "multiple" && multipleDates && multipleDates.length > 0) {
      return `${multipleDates.length} days selected`;
    }
    if (modifiedFrom && modifiedTo) {
      const fromDate = new Date(modifiedFrom);
      const toDate = new Date(modifiedTo);
      if (format(fromDate, "yyyy-MM-dd") === format(toDate, "yyyy-MM-dd")) {
        return format(fromDate, "MMM d, yyyy");
      }
      return `${format(fromDate, "MMM d")} - ${format(toDate, "MMM d")}`;
    }
    if (modifiedFrom) {
      return `After ${format(new Date(modifiedFrom), "MMM d")}`;
    }
    if (modifiedTo) {
      return `Before ${format(new Date(modifiedTo), "MMM d")}`;
    }
    return "Date Modified";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 px-2.5 text-xs gap-1.5 border ${
            isFiltered
              ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/15"
              : "bg-muted/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{getFilterLabel()}</span>
          {isFiltered && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") handleClear(ev as unknown as React.MouseEvent);
              }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 text-primary"
              title="Clear date filter"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-3 text-xs" align="start">
        <div className="space-y-3">
          {/* Header & Mode Switcher */}
          <div className="flex items-center justify-between pb-2 border-b gap-3">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Modified Date</span>
            </div>

            <div className="flex items-center bg-muted/60 p-0.5 rounded-md border text-[11px]">
              <button
                type="button"
                onClick={() => setActiveTab("range")}
                className={`px-2 py-0.5 rounded transition-colors ${
                  activeTab === "range"
                    ? "bg-background text-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Date Range
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("multiple")}
                className={`px-2 py-0.5 rounded transition-colors ${
                  activeTab === "multiple"
                    ? "bg-background text-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Specific Dates
              </button>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1 max-w-[320px]">
            {[
              { id: "today" as const, label: "Today" },
              { id: "yesterday" as const, label: "Yesterday" },
              { id: "7days" as const, label: "Past 7 days" },
              { id: "30days" as const, label: "Past 30 days" },
              { id: "90days" as const, label: "Past 90 days" },
              { id: "year" as const, label: "This year" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyPreset(p.id)}
                className="px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground border border-transparent transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendars: Range (comp-491) vs Multiple (comp-493) */}
          <div className="flex justify-center border rounded-md p-1 bg-background">
            {activeTab === "range" ? (
              <Calendar
                mode="range"
                selected={range}
                onSelect={handleRangeSelect}
                numberOfMonths={1}
                disabled={{ after: today }}
                endMonth={today}
                className="p-1"
              />
            ) : (
              <Calendar
                mode="multiple"
                selected={multipleDates}
                onSelect={handleMultipleSelect}
                numberOfMonths={1}
                disabled={{ after: today }}
                endMonth={today}
                className="p-1"
              />
            )}
          </div>

          {/* Footer stats & clear */}
          {isFiltered && (
            <div className="flex items-center justify-between pt-1 border-t text-[11px]">
              <span className="text-muted-foreground">
                Filter active: <strong className="text-foreground">{getFilterLabel()}</strong>
              </span>
              <button
                type="button"
                onClick={(e) => handleClear(e)}
                className="text-destructive hover:underline text-[11px]"
              >
                Reset filter
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
