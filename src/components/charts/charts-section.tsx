import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopFoldersChart } from "./top-folders-chart";
import { FileTypesChart } from "./file-types-chart";
import { FolderChildEntry, ScanStatus, ScanSummary } from "@/types/scan";

interface ChartsSectionProps {
  entries: FolderChildEntry[];
  summary: ScanSummary | null;
  scanState: ScanStatus;
  onDrillDown: (path: string) => void;
}

export function ChartsSection({
  entries,
  summary,
  scanState,
  onDrillDown,
}: ChartsSectionProps) {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("fsv_charts_open");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("fsv_charts_open", String(next));
      } catch {
        // Ignore local storage write errors
      }
      return next;
    });
  };

  // Throttled data during active scan (at most once every 250ms)
  const [throttledEntries, setThrottledEntries] = useState(entries);
  const [throttledSummary, setThrottledSummary] = useState(summary);
  const lastUpdateRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (scanState !== "scanning") {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setThrottledEntries(entries);
      setThrottledSummary(summary);
      lastUpdateRef.current = Date.now();
      return;
    }

    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;

    if (elapsed >= 250) {
      lastUpdateRef.current = now;
      setThrottledEntries(entries);
      setThrottledSummary(summary);
    } else if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        lastUpdateRef.current = Date.now();
        setThrottledEntries(entries);
        setThrottledSummary(summary);
        timeoutRef.current = null;
      }, 250 - elapsed);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [entries, summary, scanState]);

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleOpen}
          className="h-7 px-2 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse charts" : "Expand charts"}
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span>Storage Visualization</span>
        </Button>
      </div>

      {isOpen && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 animate-fadeIn">
          <div className="lg:col-span-7">
            <TopFoldersChart
              entries={throttledEntries}
              scanState={scanState}
              onDrillDown={onDrillDown}
            />
          </div>
          <div className="lg:col-span-5">
            <FileTypesChart
              summary={throttledSummary}
              scanState={scanState}
            />
          </div>
        </div>
      )}
    </div>
  );
}
