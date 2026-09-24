import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  ExternalLink,
  Trash2,
  FolderOpen,
  AlertCircle,
  Inbox,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileIcon } from "@/components/file-icon";
import { FolderChildEntry, SortField, SortOrder } from "@/types/scan";
import { formatBytes, formatDate, formatNumber } from "@/lib/format";

interface ResultsTableProps {
  entries: FolderChildEntry[];
  totalSize: number;
  isScanning: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField) => void;
  topThreePaths: Map<string, number>;
  searchQuery: string;
  onDrillDown: (folderPath: string) => void;
  onCopyPath: (e: React.MouseEvent, path: string) => void;
  onReveal: (e: React.MouseEvent, path: string, isDir?: boolean) => void;
  onDeleteClick: (e: React.MouseEvent, entry: FolderChildEntry) => void;
}

export function ResultsTable({
  entries,
  totalSize,
  isScanning,
  sortField,
  sortOrder,
  onSortChange,
  topThreePaths,
  searchQuery,
  onDrillDown,
  onCopyPath,
  onReveal,
  onDeleteClick,
}: ResultsTableProps) {
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

  return (
    <Table
      containerClassName="flex-1 overflow-auto relative select-text"
      className="relative select-text"
    >
      <TableHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur-md shadow-sm border-b [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-background/95 [&_th]:backdrop-blur-md [&_th]:border-b [&_th]:shadow-[0_1px_0_0_hsl(var(--border))]">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-12 text-center">Type</TableHead>
          <TableHead
            className="cursor-pointer group select-none text-foreground font-semibold"
            onClick={() => onSortChange("name")}
          >
            <div className="flex items-center">
              <span>Name</span>
              {renderSortIndicator("name")}
            </div>
          </TableHead>
          <TableHead
            className="cursor-pointer group select-none text-right text-foreground font-semibold w-32"
            onClick={() => onSortChange("size")}
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
            onClick={() => onSortChange("modified")}
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
        {entries.length === 0 && !isScanning ? (
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
          entries.map((entry) => {
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
                {/* Material Icon Theme icon column */}
                <TableCell className="text-center p-2.5">
                  <div className="flex items-center justify-center">
                    <FileIcon
                      name={entry.name}
                      isDir={entry.isDir}
                      size={18}
                    />
                  </div>
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
                            onClick={(e) => onCopyPath(e, entry.path)}
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
                              onReveal(e, entry.path, entry.isDir)
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
                            onClick={(e) => onDeleteClick(e, entry)}
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
        {isScanning && entries.length === 0 && (
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
  );
}
