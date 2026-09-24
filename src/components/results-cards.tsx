import {
  FolderOpen,
  Copy,
  ExternalLink,
  Trash2,
  MoreVertical,
  Inbox,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileIcon } from "@/components/file-icon";
import { FolderChildEntry } from "@/types/scan";
import { formatBytes, formatDate, formatNumber } from "@/lib/format";

interface ResultsCardsProps {
  entries: FolderChildEntry[];
  totalSize: number;
  isScanning: boolean;
  topThreePaths: Map<string, number>;
  searchQuery: string;
  onDrillDown: (path: string) => void;
  onCopyPath: (e: React.MouseEvent, path: string) => void;
  onReveal: (e: React.MouseEvent, path: string, isDir?: boolean) => void;
  onDeleteClick: (e: React.MouseEvent, entry: FolderChildEntry) => void;
}

export function ResultsCards({
  entries,
  totalSize,
  isScanning,
  topThreePaths,
  searchQuery,
  onDrillDown,
  onCopyPath,
  onReveal,
  onDeleteClick,
}: ResultsCardsProps) {
  if (entries.length === 0 && !isScanning) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground border rounded-lg border-dashed bg-muted/10">
        <Inbox className="w-10 h-10 mb-2 opacity-40" />
        <p className="font-semibold text-sm">No items found</p>
        <p className="text-xs text-muted-foreground mt-1">
          {searchQuery
            ? "Try clearing your search query"
            : "Enter a folder path and click Scan to analyze directory contents"}
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex-1 overflow-auto p-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {entries.map((entry) => {
            const rank = topThreePaths.get(entry.path);
            const percent =
              totalSize > 0
                ? Math.min(100, (entry.sizeBytes / totalSize) * 100)
                : 0;

            return (
              <Card
                key={entry.path}
                onClick={() => entry.isDir && onDrillDown(entry.path)}
                className={`transition-all duration-200 select-text p-3.5 group border ${
                  entry.isDir
                    ? "cursor-pointer hover:border-primary/50 hover:shadow-md hover:bg-muted/40"
                    : "hover:border-border hover:shadow-sm bg-card"
                }`}
              >
                <CardContent className="p-0 flex flex-col gap-2.5">
                  {/* Top Row: Large Icon + Truncated Name with Tooltip + Three Dot Menu */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="shrink-0 flex items-center justify-center w-11 h-11 rounded-lg bg-muted/40 p-1">
                        <FileIcon
                          name={entry.name}
                          isDir={entry.isDir}
                          size={36}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {entry.name}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs break-all">
                            <p className="font-semibold text-xs">{entry.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              {entry.path}
                            </p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Rank badge */}
                        {rank && (
                          <div className="mt-0.5">
                            {rank === 1 && (
                              <Badge
                                variant="rank1"
                                className="text-[10px] px-1.5 py-0"
                              >
                                #1 Largest
                              </Badge>
                            )}
                            {rank === 2 && (
                              <Badge
                                variant="rank2"
                                className="text-[10px] px-1.5 py-0"
                              >
                                #2 Largest
                              </Badge>
                            )}
                            {rank === 3 && (
                              <Badge
                                variant="rank3"
                                className="text-[10px] px-1.5 py-0"
                              >
                                #3 Largest
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            aria-label="Item actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 text-xs">
                          {entry.isDir && (
                            <DropdownMenuItem
                              onClick={() => onDrillDown(entry.path)}
                              className="gap-2"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              <span>Open folder</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={(e) => onCopyPath(e, entry.path)}
                            className="gap-2"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy path</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => onReveal(e, entry.path, entry.isDir)}
                            className="gap-2"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Show in Explorer</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => onDeleteClick(e, entry)}
                            className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Size and Count Row */}
                  <div className="flex items-baseline justify-between pt-1 border-t border-border/50">
                    <div className="text-base font-bold font-mono text-foreground">
                      {formatBytes(entry.sizeBytes)}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {entry.isDir
                        ? `${formatNumber(entry.fileCount)} files`
                        : "File"}
                    </div>
                  </div>

                  {/* Progress Bar with % of Total */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                      <span>Share of folder</span>
                      <span>
                        {percent < 0.1 && percent > 0
                          ? "<0.1%"
                          : `${percent.toFixed(1)}%`}
                      </span>
                    </div>
                    <Progress value={percent} className="h-1.5" />
                  </div>

                  {/* Footer Row: Modified Date & Errors */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                    <span>{formatDate(entry.modified)}</span>

                    {entry.error && (
                      <span
                        className="inline-flex items-center text-amber-500 gap-1 text-[10px]"
                        title={entry.error}
                      >
                        <AlertCircle className="w-3 h-3" />
                        <span>Warning</span>
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Skeletons when scanning and no entries yet */}
          {isScanning && entries.length === 0 && (
            <>
              {[...Array(6)].map((_, i) => (
                <Card key={`card-skeleton-${i}`} className="p-3.5 border">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-11 h-11 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="w-3/4 h-4 rounded" />
                        <Skeleton className="w-1/2 h-3 rounded" />
                      </div>
                    </div>
                    <Skeleton className="w-1/3 h-5 rounded" />
                    <Skeleton className="w-full h-1.5 rounded" />
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
