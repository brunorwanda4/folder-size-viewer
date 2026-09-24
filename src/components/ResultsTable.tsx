import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Search,
  AlertTriangle,
  Loader2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FolderChildEntry,
  ItemTypeFilter,
  ScanStatus,
  ScanSummary,
  SortField,
  SortOrder,
  ViewMode,
} from "@/types/scan";
import { formatBytes, formatNumber } from "@/lib/format";
import { ResultsTable as TableComponent } from "./results-table";
import { ResultsCards } from "./results-cards";
import { ViewToggle } from "./view-toggle";
import { SortControl } from "./sort-control";
import { FileIcon } from "./file-icon";

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

  // Deletion modal state
  const [itemToDelete, setItemToDelete] = useState<FolderChildEntry | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

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
          comparison = a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          });
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
    setItemToDelete(entry);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await invoke("delete_item", { path: itemToDelete.path });
      toast.success(
        `${itemToDelete.isDir ? "Folder" : "File"} deleted successfully`,
        {
          description: `"${itemToDelete.name}" was permanently removed.`,
        }
      );
      onItemDeleted?.(itemToDelete.path, itemToDelete.sizeBytes);
      setItemToDelete(null);
    } catch (err: unknown) {
      const errorMsg =
        typeof err === "string"
          ? err
          : err instanceof Error
          ? err.message
          : String(err);
      toast.error(
        `Failed to delete ${itemToDelete.isDir ? "folder" : "file"}`,
        {
          description: errorMsg,
        }
      );
    } finally {
      setIsDeleting(false);
    }
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

          {/* Shared Sort control */}
          <SortControl
            sortField={sortField}
            sortOrder={sortOrder}
            onSortFieldChange={setSortField}
            onSortOrderToggle={handleToggleSortDirection}
          />

          {/* Table / Cards view toggle */}
          <ViewToggle
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />

          {/* Item Count */}
          <span className="text-xs text-muted-foreground font-mono pl-1 hidden sm:inline-block">
            {displayedEntries.length}{" "}
            {displayedEntries.length === 1 ? "item" : "items"}
          </span>
        </div>
      </div>

      {/* Live Scanning Progress Header Bar */}
      {isScanning && (
        <div className="bg-primary/5 px-4 py-2 border-b border-primary/20 flex flex-col gap-1.5 animate-fadeIn">
          <div className="flex items-center justify-between text-xs text-primary font-medium">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Scanning in progress ({entries.length} of{" "}
              {totalChildrenExpected || "..."} items processed)
            </span>
            <span className="font-mono">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
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

      {/* Confirmation Dialog to Prevent Mistakes */}
      <AlertDialog
        open={!!itemToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setItemToDelete(null);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 text-destructive shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-base sm:text-lg">
                  Delete {itemToDelete?.isDir ? "Folder" : "File"}?
                </AlertDialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Please verify this is not a mistake
                </p>
              </div>
            </div>

            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-foreground">
                <p className="text-sm">
                  Are you sure you want to delete this{" "}
                  <span className="font-semibold text-foreground">
                    {itemToDelete?.isDir ? "folder" : "file"}
                  </span>
                  ? This action is permanent and cannot be undone.
                </p>

                {itemToDelete && (
                  <div className="rounded-lg border border-border/80 bg-muted/40 p-3 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-medium truncate">
                        <FileIcon
                          name={itemToDelete.name}
                          isDir={itemToDelete.isDir}
                          size={18}
                        />
                        <span className="truncate font-semibold text-foreground">
                          {itemToDelete.name}
                        </span>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {formatBytes(itemToDelete.sizeBytes)}
                      </Badge>
                    </div>

                    <div className="text-muted-foreground font-mono text-[11px] break-all bg-background/60 p-2 rounded border border-border/50 max-h-20 overflow-y-auto select-text">
                      {itemToDelete.path}
                    </div>

                    {itemToDelete.isDir && itemToDelete.fileCount > 0 && (
                      <div className="text-muted-foreground text-[11px]">
                        Contains{" "}
                        <span className="font-semibold text-foreground">
                          {formatNumber(itemToDelete.fileCount)}
                        </span>{" "}
                        files
                      </div>
                    )}
                  </div>
                )}

                <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Warning: This item will be permanently removed from disk.
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="gap-2 sm:gap-0 mt-2">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Yes, Delete</span>
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
