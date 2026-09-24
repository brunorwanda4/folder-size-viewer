import { useMemo } from "react";
import { Pie, PieChart, Cell } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { ScanStatus, ScanSummary } from "@/types/scan";
import { buildTypeBreakdown, FileTypeSlice } from "@/lib/chart-data";
import { formatBytes, formatNumber } from "@/lib/format";
import { HardDrive } from "lucide-react";

interface FileTypesChartProps {
  summary: ScanSummary | null;
  scanState: ScanStatus;
}

const chartConfig: ChartConfig = {
  Images: { label: "Images", color: "var(--chart-1)" },
  Video: { label: "Video", color: "var(--chart-2)" },
  Audio: { label: "Audio", color: "var(--chart-3)" },
  Documents: { label: "Documents", color: "var(--chart-4)" },
  Archives: { label: "Archives", color: "var(--chart-5)" },
  Code: { label: "Code", color: "var(--chart-6)" },
  "Apps & Executables": {
    label: "Apps & Executables",
    color: "var(--chart-7)",
  },
  Databases: { label: "Databases", color: "var(--chart-8)" },
  "System & Logs": { label: "System & Logs", color: "var(--chart-9)" },
  Other: { label: "Other", color: "var(--chart-10)" },
};

export function FileTypesChart({ summary, scanState }: FileTypesChartProps) {
  const data: FileTypeSlice[] = useMemo(() => {
    return buildTypeBreakdown(summary);
  }, [summary]);

  const isScanning = scanState === "scanning";
  const totalSize = summary?.totalSize ?? 0;

  if (isScanning && data.length === 0) {
    return (
      <Card className="h-full flex flex-col border-border/70 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Storage by File Type
          </CardTitle>
          <CardDescription className="text-xs">
            Analyzing file categories...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center py-4">
          <Skeleton className="w-36 h-36 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0 || totalSize === 0) {
    return (
      <Card className="h-full flex flex-col border-border/70 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Storage by File Type
          </CardTitle>
          <CardDescription className="text-xs">
            Breakdown across media, documents, code, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
          <HardDrive className="w-8 h-8 opacity-40 mb-2" />
          <p className="text-xs">No file category data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col border-border/70 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Storage by File Type
        </CardTitle>
        <CardDescription className="text-xs">
          Categorized disk usage breakdown
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-2 sm:p-4 pt-0 flex flex-col">
        <div className="relative flex-1 flex items-center justify-center">
          <ChartContainer
            config={chartConfig}
            className="h-[210px] w-full aspect-auto"
          >
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as FileTypeSlice;
                  return (
                    <div className="rounded-lg border border-border/60 bg-popover p-2.5 shadow-md text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span>{item.category}</span>
                      </div>
                      <p className="font-mono text-muted-foreground">
                        Size: {formatBytes(item.bytes)}
                      </p>
                      <p className="font-mono text-muted-foreground">
                        Files: {formatNumber(item.files)}
                      </p>
                      <p className="font-mono text-primary font-medium">
                        {item.percent < 0.1 && item.percent > 0
                          ? "<0.1%"
                          : `${item.percent.toFixed(1)}%`}{" "}
                        of total
                      </p>
                    </div>
                  );
                }}
              />
              <Pie
                data={data}
                dataKey="bytes"
                nameKey="category"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((slice) => (
                  <Cell key={slice.category} fill={slice.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>

          {/* Centered Total Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Total
            </span>
            <span className="text-sm font-bold font-mono text-foreground">
              {formatBytes(totalSize)}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-2 text-[11px] text-muted-foreground">
          {data.map((slice) => (
            <div key={slice.category} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: slice.fill }}
              />
              <span>{slice.category}</span>
              <span className="font-mono text-[10px] opacity-75">
                ({slice.percent.toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
