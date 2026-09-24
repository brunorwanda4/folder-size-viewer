import {
  MoreVertical,
  FolderOpen,
  Copy,
  ExternalLink,
  Trash2,
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
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground">
        <Inbox className="w-10 h-10 opacity-40 mb-3" />
        <p className="font-semibold text-sm text-foreground">No items found</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
          {searchQuery
            ? "Try changing your search query or switching filters"
            : "Enter a valid path and click Scan to explore directory contents"}
        </p>
      </div>
    );
  }

  return (
    <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
      {/* Skeleton cards during initial scan */}
      {isScanning && entries.length === 0 && (
        <>
          {[...Array(8)].map((_, i) => (
            <Card
              key={`skeleton-card-${i}`}
              className="p-4 flex flex-col gap-3 border-border/60 bg-card/50"
            >
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="w-11 h-11 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>
              <Skeleton className="h-6 w-1/3 rounded mt-1" />
              <Skeleton className="h-2 w-full rounded" />
              <div className="flex justify-between items-center pt-1">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            </Card>
          ))}
        </>
      )}

      {/* Actual Entries Cards */}
      {entries.map((entry) => {
        const rank = topThreePaths.get(entry.path);
        const percent =
          totalSize > 0 ? Math.min(100, (entry.sizeBytes / totalSize) * 100) : 0;

        const rankBorderClass =
          rank === 1
            ? "border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.12)]"
            : rank === 2
            ? "border-slate-400/50 shadow-[0_0_12px_rgba(148,163,184,0.12)]"
            : rank === 3
            ? "border-amber-700/50 shadow-[0_0_12px_rgba(180,83,9,0.12)]"
            : "border-border/60 hover:border-border";

        return (
          <Card
            key={entry.path}
            tabIndex={0}
            role={entry.isDir ? "button" : "region"}
            aria-label={`${entry.name}, ${formatBytes(entry.sizeBytes)}`}
            onClick={() => {
              if (entry.isDir) {
                onDrillDown(entry.path);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && entry.isDir) {
                e.preventDefault();
                onDrillDown(entry.path);
              }
            }}
            className={`group relative flex flex-col justify-between p-3.5 transition-all duration-200 select-none bg-card/60 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              entry.isDir
                ? "cursor-pointer hover:bg-muted/40 hover:shadow-md"
                : "hover:bg-muted/20"
            } ${rankBorderClass}`}
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
                    <TooltipProvider>
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
                    </TooltipProvider>

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

              {/* Large Bold Size */}
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-foreground">
                  {formatBytes(entry.sizeBytes)}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {percent < 0.1 && percent > 0
                    ? "<0.1%"
                    : `${percent.toFixed(1)}%`}{" "}
                  of total
                </span>
              </div>

              {/* Progress bar */}
              <Progress value={percent} className="h-1.5" />

              {/* Muted line: file count (folders only) & last modified */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                <span className="truncate">
                  {entry.isDir ? `${formatNumber(entry.fileCount)} files` : "File"}
                </span>
                <span className="shrink-0">{formatDate(entry.modified)}</span>
              </div>

              {/* Error note if present */}
              {entry.error && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-500 pt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span className="truncate">{entry.error}</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
