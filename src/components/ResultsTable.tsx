const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' as const });
import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  FolderChildEntry,
  ItemTypeFilter,
  ScanStatus,
  ScanSummary,
  SortField,
  SortOrder,
  ViewMode,
} from "@/types/scan";
import { useDeletion } from "@/context/DeletionContext";
import { DeletionDialog } from "@/components/deletion/DeletionDialog";
import { ResultsTable as TableComponent } from "./results-table";
import { ResultsCards } from "./results-cards";
import { ViewToggle } from "./view-toggle";
import { SortControl } from "./sort-control";
import { invoke } from "@tauri-apps/api/core";

interface ResultsTableProps {
  entries: FolderChildEntry[];
  summary: ScanSummary | null;
  scanState: ScanStatus;
  totalChildrenExpected: number;
  onDrillDown: (folderPath: string) => void;
  onItemDeleted?: (path: string, sizeBytes: number) => void;
}

export function ResultsTable({
  entries,
  summary,
  scanState,
  totalChildrenExpected,
  onDrillDown,
  onItemDeleted,
}: ResultsTableProps) {
  // Global deletion manager
  const { requestDelete } = useDeletion();

  // View mode (table vs cards) persisted in localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem("fsv_view_mode");
      return saved === "cards" ? "cards" : "table";
    } catch {
      return "table";
    }
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("fsv_view_mode", mode);
    } catch {
      // Ignore localStorage error
    }
  };

  const [filterType, setFilterType] = useState<ItemTypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("size");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const isScanning = scanState === "scanning";
  const totalSize = summary?.totalSize ?? 0;

  // Identify top 3 largest items globally (across all entries)
  const topThreePaths = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.sizeBytes - a.sizeBytes);
    return new Map<string, number>(
      sorted.slice(0, 3).map((item, index) => [item.path, index + 1])
    );
  }, [entries]);

  // Filter and sort entries (shared by both views)
  const displayedEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        // Type filter
        if (filterType === "folders" && !entry.isDir) return false;
        if (filterType === "files" && entry.isDir) return false;

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            entry.name.toLowerCase().includes(q) ||
            entry.path.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === "size") {
          comparison = a.sizeBytes - b.sizeBytes;
        } else if (sortField === "name") {
          comparison = nameCollator.compare(a.name, b.name);
        } else if (sortField === "modified") {
          comparison = (a.modified ?? 0) - (b.modified ?? 0);
        }
        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [entries, filterType, searchQuery, sortField, sortOrder]);

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
  };

  const handleToggleSortDirection = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const handleCopyPath = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(path);
      toast.success("Path copied to clipboard", {
        description: path,
        duration: 2500,
      });
    } catch {
      toast.error("Failed to copy path");
    }
  };

  const handleReveal = async (
    e: React.MouseEvent,
    path: string,
    isDir?: boolean
  ) => {
    e.stopPropagation();
    try {
      await invoke("reveal_in_explorer", { path, isDir });
    } catch (err) {
      toast.error(isDir ? "Failed to open folder" : "Failed to open Explorer", {
        description: String(err),
      });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, entry: FolderChildEntry) => {
    e.stopPropagation();
    requestDelete(entry);
  };

  // Progress percentage during active scan
  const progressPercent =
    totalChildrenExpected > 0
      ? Math.min(
          100,
          Math.round((entries.length / totalChildrenExpected) * 100)
        )
      : 0;

  return (
    <div className="flex flex-col flex-1 min-h-[480px] lg:min-h-[520px] border border-border/70 rounded-xl bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
      {/* Controls Bar: Search, Type Filters, Sort Control, View Toggle */}
      <div className="p-3 border-b border-border/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-muted/20">
        {/* Left: Search input */}
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Filter by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-background/80"
            />
          </div>
        </div>

        {/* Right: Controls & Switchers */}
        <div className="flex flex-wrap items-center gap-2.5 justify-between md:justify-end">
          {/* Item Type filter */}
          <ToggleGroup
            type="single"
            value={filterType}
            onValueChange={(val) => val && setFilterType(val as ItemTypeFilter)}
            className="border rounded-md p-0.5 bg-background/50 h-8"
          >
            <ToggleGroupItem value="all" className="text-xs px-2.5 h-7">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="folders" className="text-xs px-2.5 h-7">
              Folders
            </ToggleGroupItem>
            <ToggleGroupItem value="files" className="text-xs px-2.5 h-7">
              Files
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Sort Control */}
          <SortControl
            sortField={sortField}
            sortOrder={sortOrder}
            onSortFieldChange={setSortField}
            onSortOrderToggle={handleToggleSortDirection}
          />

          {/* View Toggle */}
          <ViewToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />
        </div>
      </div>

      {/* Progress Bar (during active scan) */}
      {isScanning && (
        <div className="px-4 py-2 border-b border-border/40 bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Scanning directory contents...</span>
            <span className="font-medium text-foreground">
              {progressPercent}%
            </span>
          </div>
          <Progress value={progressPercent} className="h-1.5 w-full" />
        </div>
      )}

      {/* View Switch: Table vs Cards */}
      {viewMode === "table" ? (
        <TableComponent
          entries={displayedEntries}
          totalSize={totalSize}
          isScanning={isScanning}
          sortField={sortField}
          sortOrder={sortOrder}
          onSortChange={handleHeaderSort}
          topThreePaths={topThreePaths}
          searchQuery={searchQuery}
          onDrillDown={onDrillDown}
          onCopyPath={handleCopyPath}
          onReveal={handleReveal}
          onDeleteClick={handleDeleteClick}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <ResultsCards
            entries={displayedEntries}
            totalSize={totalSize}
            isScanning={isScanning}
            topThreePaths={topThreePaths}
            searchQuery={searchQuery}
            onDrillDown={onDrillDown}
            onCopyPath={handleCopyPath}
            onReveal={handleReveal}
            onDeleteClick={handleDeleteClick}
          />
        </div>
      )}

      {/* Confirmation & Active Deletion Dialog */}
      <DeletionDialog onItemDeleted={onItemDeleted} />
    </div>
  );
}
