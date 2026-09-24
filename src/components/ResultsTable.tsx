import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Folder,
  FolderOpen,
  File,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Loader2,
  Search,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
} from "@/types/scan";
import { formatBytes, formatDate, formatNumber } from "@/lib/format";

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
  const [filterType, setFilterType] = useState<ItemTypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("size");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Deletion modal state
  const [itemToDelete, setItemToDelete] = useState<FolderChildEntry | null>(null);
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

  // Filter and sort entries
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

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
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

  const handleReveal = async (e: React.MouseEvent, path: string, isDir?: boolean) => {
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

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40 group-hover:opacity-80" />
      );
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 ml-1 text-primary" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 ml-1 text-primary" />
    );
  };

  // Progress percentage during active scan
  const progressPercent =
    totalChildrenExpected > 0
      ? Math.min(100, Math.round((entries.length / totalChildrenExpected) * 100))
      : 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-border/70 rounded-xl bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
      {/* Controls Bar: Search & Filter */}
      <div className="p-3 border-b border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20">
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

        <div className="flex items-center gap-2 justify-between sm:justify-end">
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

          <span className="text-xs text-muted-foreground font-mono pl-1">
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

      {/* Table with Sticky Header inside ScrollArea */}
      <ScrollArea className="flex-1 relative">
        <Table className="relative select-text">
          <TableHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-center">Type</TableHead>
              <TableHead
                className="cursor-pointer group select-none text-foreground font-semibold"
                onClick={() => toggleSort("name")}
              >
                <div className="flex items-center">
                  <span>Name</span>
                  {renderSortIndicator("name")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer group select-none text-right text-foreground font-semibold w-32"
                onClick={() => toggleSort("size")}
              >
                <div className="flex items-center justify-end">
                  <span>Size</span>
                  {renderSortIndicator("size")}
                </div>
              </TableHead>
              <TableHead className="w-36 text-foreground font-semibold text-center">
                % of Total
              </TableHead>
              <TableHead className="w-24 text-right text-foreground font-semibold">
                Files
              </TableHead>
              <TableHead
                className="cursor-pointer group select-none text-foreground font-semibold w-40"
                onClick={() => toggleSort("modified")}
              >
                <div className="flex items-center">
                  <span>Modified</span>
                  {renderSortIndicator("modified")}
                </div>
              </TableHead>
              <TableHead className="w-28 text-center text-foreground font-semibold">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {displayedEntries.length === 0 && !isScanning ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-48 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="w-8 h-8 opacity-40" />
                    <p className="font-medium text-sm">No items found</p>
                    <p className="text-xs text-muted-foreground">
                      {searchQuery
                        ? "Try clearing your search query"
                        : "Enter a folder path and click Scan to analyze directory contents"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayedEntries.map((entry) => {
                const rank = topThreePaths.get(entry.path);
                const percent =
                  totalSize > 0
                    ? Math.min(100, (entry.sizeBytes / totalSize) * 100)
                    : 0;

                return (
                  <TableRow
                    key={entry.path}
                    onClick={() => entry.isDir && onDrillDown(entry.path)}
                    className={`transition-colors group ${
                      entry.isDir
                        ? "cursor-pointer hover:bg-muted/70"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    {/* Icon column */}
                    <TableCell className="text-center p-2.5">
                      {entry.isDir ? (
                        <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20 mx-auto" />
                      ) : (
                        <File className="w-4 h-4 text-blue-500 mx-auto" />
                      )}
                    </TableCell>

                    {/* Name + Rank badge column */}
                    <TableCell className="font-medium max-w-xs md:max-w-md truncate p-2.5">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`truncate ${
                            entry.isDir
                              ? "font-semibold text-foreground group-hover:text-primary transition-colors"
                              : "text-foreground/90"
                          }`}
                          title={entry.path}
                        >
                          {entry.name}
                        </span>

                        {rank === 1 && (
                          <Badge
                            variant="rank1"
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            #1 Largest
                          </Badge>
                        )}
                        {rank === 2 && (
                          <Badge
                            variant="rank2"
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            #2 Largest
                          </Badge>
                        )}
                        {rank === 3 && (
                          <Badge
                            variant="rank3"
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            #3 Largest
                          </Badge>
                        )}

                        {entry.error && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{entry.error}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>

                    {/* Size column */}
                    <TableCell className="text-right font-mono font-medium text-xs p-2.5">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              {formatBytes(entry.sizeBytes)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-mono text-xs">
                              {formatNumber(entry.sizeBytes)} bytes
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>

                    {/* % of Total column */}
                    <TableCell className="p-2.5">
                      <div className="flex items-center gap-2">
                        <Progress value={percent} className="h-2 flex-1" />
                        <span className="text-[11px] font-mono text-muted-foreground w-11 text-right shrink-0">
                          {percent < 0.1 && percent > 0
                            ? "<0.1%"
                            : `${percent.toFixed(1)}%`}
                        </span>
                      </div>
                    </TableCell>

                    {/* Files count column */}
                    <TableCell className="text-right font-mono text-xs text-muted-foreground p-2.5">
                      {entry.isDir ? formatNumber(entry.fileCount) : "-"}
                    </TableCell>

                    {/* Modified column */}
                    <TableCell className="text-xs text-muted-foreground p-2.5 whitespace-nowrap">
                      {formatDate(entry.modified)}
                    </TableCell>

                    {/* Actions column */}
                    <TableCell
                      className="text-center p-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground"
                                onClick={(e) => handleCopyPath(e, entry.path)}
                                aria-label="Copy path"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Copy full path</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground"
                                onClick={(e) =>
                                  handleReveal(e, entry.path, entry.isDir)
                                }
                                aria-label={
                                  entry.isDir
                                    ? "Open folder in Explorer"
                                    : "Reveal in Explorer"
                                }
                              >
                                {entry.isDir ? (
                                  <FolderOpen className="w-3.5 h-3.5" />
                                ) : (
                                  <ExternalLink className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                {entry.isDir
                                  ? "Open folder in Explorer"
                                  : "Reveal in Explorer"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                                onClick={(e) => handleDeleteClick(e, entry)}
                                aria-label={
                                  entry.isDir ? "Delete folder" : "Delete file"
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs text-destructive font-medium">
                                {entry.isDir ? "Delete folder" : "Delete file"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}

            {/* Skeleton rows when initial entries are waiting or loading */}
            {isScanning && displayedEntries.length === 0 && (
              <>
                {[...Array(6)].map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell className="p-2.5 text-center">
                      <Skeleton className="w-4 h-4 mx-auto rounded" />
                    </TableCell>
                    <TableCell className="p-2.5">
                      <Skeleton className="h-4 w-48 rounded" />
                    </TableCell>
                    <TableCell className="p-2.5 text-right">
                      <Skeleton className="h-4 w-16 ml-auto rounded" />
                    </TableCell>
                    <TableCell className="p-2.5">
                      <Skeleton className="h-2 w-full rounded" />
                    </TableCell>
                    <TableCell className="p-2.5 text-right">
                      <Skeleton className="h-4 w-10 ml-auto rounded" />
                    </TableCell>
                    <TableCell className="p-2.5">
                      <Skeleton className="h-4 w-24 rounded" />
                    </TableCell>
                    <TableCell className="p-2.5 text-center">
                      <Skeleton className="h-6 w-20 mx-auto rounded" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </ScrollArea>

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
                      <div className="flex items-center gap-1.5 font-medium truncate">
                        {itemToDelete.isDir ? (
                          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <File className="w-4 h-4 text-blue-500 shrink-0" />
                        )}
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
