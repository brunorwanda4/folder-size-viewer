import { ArrowDown, ArrowUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SortField, SortOrder } from "@/types/scan";

interface SortControlProps {
  sortField: SortField;
  sortOrder: SortOrder;
  onSortFieldChange: (field: SortField) => void;
  onSortOrderToggle: () => void;
}

export function SortControl({
  sortField,
  sortOrder,
  onSortFieldChange,
  onSortOrderToggle,
}: SortControlProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={sortField}
        onValueChange={(val) => onSortFieldChange(val as SortField)}
      >
        <SelectTrigger
          className="h-8 w-28 text-xs bg-background/80"
          aria-label="Sort by field"
        >
          <span className="text-muted-foreground mr-1">Sort:</span>
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="size" className="text-xs">
            Size
          </SelectItem>
          <SelectItem value="name" className="text-xs">
            Name
          </SelectItem>
          <SelectItem value="modified" className="text-xs">
            Modified
          </SelectItem>
        </SelectContent>
      </Select>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground bg-background/80"
              onClick={onSortOrderToggle}
              aria-label={
                sortOrder === "asc"
                  ? "Sort ascending (click for descending)"
                  : "Sort descending (click for ascending)"
              }
            >
              {sortOrder === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              {sortOrder === "asc" ? "Ascending order" : "Descending order"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
