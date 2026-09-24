const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' as const });
import { useState, useMemo } from "react";
import {
  Search,
  AlertTriangle,
  Loader2,
  AlertCircle,
  Trash2,
  Timer,
  Clock,
  HardDrive,
  FileText,
  Minimize2,
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
import { formatBytes, formatNumber, formatSecondsLeft } from "@/lib/format";
import { useDeletion } from "@/context/DeletionContext";
import { ResultsTable as TableComponent } from "./results-table";
import { ResultsCards } from "./results-cards";
import { ViewToggle } from "./view-toggle";
import { SortControl } from "./sort-control";
import { FileIcon } from "./file-icon";
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
  const {
    pendingCandidate,
    activeModalTask,
    requestDelete,
    cancelPendingDelete,
    confirmDelete,
    minimizeTask,
  } = useDeletion();

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

  const handleConfirmDelete = async () => {
    await confirmDelete(onItemDeleted);
  };

  // Progress percentage during active scan
  const progressPercent =
    totalChildrenExpected > 0
      ? Math.min(
          100,
          Math.round((entries.length / totalChildrenExpected) * 100)
        )
      : 0;

  // Active item in the dialog (either candidate pending confirmation or active task deleting)
  const isDialogActive = !!pendingCandidate || !!activeModalTask;
  const isDeletingModal = !!activeModalTask;

  const activeItem = pendingCandidate
    ? {
        name: pendingCandidate.name,
        path: pendingCandidate.path,
        isDir: pendingCandidate.isDir,
        sizeBytes: pendingCandidate.sizeBytes,
        fileCount: pendingCandidate.fileCount,
      }
    : activeModalTask
    ? {
        name: activeModalTask.name,
        path: activeModalTask.path,
        isDir: activeModalTask.isDir,
        sizeBytes: activeModalTask.totalSize,
        fileCount: activeModalTask.totalFiles,
      }
    : null;

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
      <AlertDialog
        open={isDialogActive}
        onOpenChange={(open) => {
          if (!open) {
            if (activeModalTask) {
              // Minimize running deletion to background
              minimizeTask(activeModalTask.id);
            } else {
              cancelPendingDelete();
            }
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
                  isDeletingModal
                    ? "bg-destructive/15 text-destructive animate-pulse"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {isDeletingModal ? (
                  <Trash2 className="w-5 h-5 animate-pulse" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <AlertDialogTitle className="text-base sm:text-lg flex items-center justify-between">
                  <span>
                    {isDeletingModal
                      ? `Deleting ${activeItem?.isDir ? "Folder" : "File"}...`
                      : `Delete ${activeItem?.isDir ? "Folder" : "File"}?`}
                  </span>
                  {isDeletingModal && activeModalTask && (
                    <span className="font-mono text-sm font-bold text-destructive">
                      {activeModalTask.percentage}%
                    </span>
                  )}
                </AlertDialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isDeletingModal
                    ? "Deletion in progress. You can minimize to delete in background."
                    : "Please verify this is not a mistake"}
                </p>
              </div>
            </div>

            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-foreground">
                {!isDeletingModal ? (
                  <p className="text-sm">
                    Are you sure you want to delete this{" "}
                    <span className="font-semibold text-foreground">
                      {activeItem?.isDir ? "folder" : "file"}
                    </span>
                    ? This action is permanent and cannot be undone.
                  </p>
                ) : (
                  activeModalTask && (
                    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/30 p-3.5">
                      {/* Progress Bar & Percentage */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-destructive" />
                            Deletion Progress
                          </span>
                          <span className="font-mono font-bold text-destructive">
                            {activeModalTask.percentage}%
                          </span>
                        </div>
                        <Progress
                          value={activeModalTask.percentage}
                          className="h-2.5 w-full bg-secondary"
                        />
                      </div>

                      {/* Stats Grid: Time Taken, Time Left, Storage Left, Files Left */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {/* Time Taken in seconds */}
                        <div className="flex items-center gap-2 p-2 rounded-md bg-background/80 border border-border/50">
                          <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500 shrink-0">
                            <Timer className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                              Time Taken
                            </p>
                            <p className="text-xs font-mono font-bold text-foreground truncate">
                              {activeModalTask.elapsedSeconds.toFixed(1)}s
                            </p>
                          </div>
                        </div>

                        {/* Time Left (ETA) */}
                        <div className="flex items-center gap-2 p-2 rounded-md bg-background/80 border border-border/50">
                          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500 shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                              Time Left
                            </p>
                            <p className="text-xs font-mono font-bold text-foreground truncate">
                              {formatSecondsLeft(
                                activeModalTask.estimatedSecondsLeft
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Storage Left */}
                        <div className="flex items-center gap-2 p-2 rounded-md bg-background/80 border border-border/50">
                          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500 shrink-0">
                            <HardDrive className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                              Storage Left
                            </p>
                            <p className="text-xs font-mono font-bold text-foreground truncate">
                              {formatBytes(activeModalTask.bytesLeft)}
                            </p>
                          </div>
                        </div>

                        {/* Files Left */}
                        <div className="flex items-center gap-2 p-2 rounded-md bg-background/80 border border-border/50">
                          <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-500 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                              Files Left
                            </p>
                            <p className="text-xs font-mono font-bold text-foreground truncate">
                              {formatNumber(activeModalTask.filesLeft)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Current File Activity */}
                      {activeModalTask.currentName && (
                        <div className="text-[11px] text-muted-foreground font-mono truncate px-2 py-1 rounded bg-background/50 border border-border/40">
                          <span className="text-muted-foreground/70">Deleting: </span>
                          <span className="text-foreground">
                            {activeModalTask.currentName}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                )}

                {activeItem && (
                  <div className="rounded-lg border border-border/80 bg-muted/40 p-3 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-medium truncate">
                        <FileIcon
                          name={activeItem.name}
                          isDir={activeItem.isDir}
                          size={18}
                        />
                        <span className="truncate font-semibold text-foreground">
                          {activeItem.name}
                        </span>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {formatBytes(activeItem.sizeBytes)}
                      </Badge>
                    </div>

                    <div className="text-muted-foreground font-mono text-[11px] break-all bg-background/60 p-2 rounded border border-border/50 max-h-20 overflow-y-auto select-text">
                      {activeItem.path}
                    </div>

                    {activeItem.isDir && activeItem.fileCount > 0 && (
                      <div className="text-muted-foreground text-[11px]">
                        Contains{" "}
                        <span className="font-semibold text-foreground">
                          {formatNumber(activeItem.fileCount)}
                        </span>{" "}
                        files
                      </div>
                    )}
                  </div>
                )}

                {!isDeletingModal && (
                  <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Warning: This item will be permanently removed from disk.
                    </span>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="gap-2 sm:gap-2 mt-2 flex flex-col sm:flex-row justify-between items-stretch sm:items-center">
            {isDeletingModal ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    activeModalTask && minimizeTask(activeModalTask.id)
                  }
                  className="gap-1.5 order-2 sm:order-1"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span>Minimize to Background</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled
                  className="gap-1.5 min-w-[130px] order-1 sm:order-2"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting ({activeModalTask?.percentage}%)...</span>
                </Button>
              </>
            ) : (
              <div className="flex items-center justify-end gap-2 w-full">
                <AlertDialogCancel onClick={cancelPendingDelete}>
                  Cancel
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  className="gap-1.5 min-w-[130px]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Yes, Delete</span>
                </Button>
              </div>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
