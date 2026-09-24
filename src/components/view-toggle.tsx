import { LayoutList, LayoutGrid } from "lucide-react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { ViewMode } from "@/types/scan";

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={(val) => {
        if (val) onViewModeChange(val as ViewMode);
      }}
      className="border rounded-md p-0.5 bg-background/50 h-8"
      aria-label="View layout switch"
    >
      <ToggleGroupItem
        value="table"
        className="h-7 px-2.5 data-[state=on]:bg-muted"
        aria-label="Table view"
      >
        <LayoutList className="w-3.5 h-3.5" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="cards"
        className="h-7 px-2.5 data-[state=on]:bg-muted"
        aria-label="Cards view"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
