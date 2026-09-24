import { HardDrive, FolderTree, ShieldAlert, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes, formatDuration, formatNumber } from "@/lib/format";
import { ScanStatus, ScanSummary } from "@/types/scan";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SummaryCardsProps {
  summary: ScanSummary | null;
  scanState: ScanStatus;
  itemsCount: number;
}

export function SummaryCards({
  summary,
  scanState,
  itemsCount,
}: SummaryCardsProps) {
  const isScanning = scanState === "scanning";
  const totalSize = summary?.totalSize ?? 0;
  const count = itemsCount > 0 ? itemsCount : summary?.totalChildren ?? 0;
  const skipped = summary?.skippedCount ?? 0;
  const elapsed = summary?.elapsedMs ?? 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Total Size Card */}
      <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Size
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xl font-bold tracking-tight text-foreground truncate cursor-help">
                    {formatBytes(totalSize)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-mono text-xs">{formatNumber(totalSize)} bytes</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Items Count Card */}
      <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <FolderTree className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Items Found
            </p>
            <p className="text-xl font-bold tracking-tight text-foreground truncate">
              {formatNumber(count)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Skipped / Access Denied Items Card */}
      <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 flex items-center gap-3">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-lg ${
              skipped > 0
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Skipped Files
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p
                    className={`text-xl font-bold tracking-tight truncate ${
                      skipped > 0
                        ? "text-amber-600 dark:text-amber-400 cursor-help"
                        : "text-foreground"
                    }`}
                  >
                    {formatNumber(skipped)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    Files or folders that could not be read due to locked state or Access Denied permissions
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Scan Duration Card */}
      <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Timer className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Scan Time
            </p>
            <p className="text-xl font-bold tracking-tight text-foreground truncate">
              {isScanning ? "Scanning..." : formatDuration(elapsed)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
