import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
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
import { FolderChildEntry, ScanStatus } from "@/types/scan";
import { buildTopFolders, TopFolderBarItem } from "@/lib/chart-data";
import { formatBytes, formatNumber } from "@/lib/format";
import { Folder } from "lucide-react";

interface TopFoldersChartProps {
  entries: FolderChildEntry[];
  scanState: ScanStatus;
  onDrillDown: (path: string) => void;
}

const chartConfig = {
  sizeBytes: {
    label: "Storage Size",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function TopFoldersChart({
  entries,
  scanState,
  onDrillDown,
}: TopFoldersChartProps) {
  const data: TopFolderBarItem[] = useMemo(() => {
    return buildTopFolders(entries, 8);
  }, [entries]);

  const isScanning = scanState === "scanning";

  if (isScanning && data.length === 0) {
    return (
      <Card className="h-full flex flex-col border-border/70 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Top Folders by Size
          </CardTitle>
          <CardDescription className="text-xs">
            Calculating folder storage distribution...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-around py-4 gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton
                className="h-5 rounded flex-1"
                style={{ width: `${90 - i * 12}%` }}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="h-full flex flex-col border-border/70 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Top Folders by Size
          </CardTitle>
          <CardDescription className="text-xs">
            Largest folders in the current directory
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
          <Folder className="w-8 h-8 opacity-40 mb-2" />
          <p className="text-xs">No folder data to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col border-border/70 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Top Folders by Size
        </CardTitle>
        <CardDescription className="text-xs">
          Click any folder bar to drill down
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-2 sm:p-4 pt-0">
        <ChartContainer
          config={chartConfig}
          className="h-[240px] w-full aspect-auto"
        >
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 24, left: 0, bottom: 5 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              type="number"
              tickFormatter={(val: number) => formatBytes(val, 0)}
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={100}
              fontSize={11}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const item = payload[0].payload as TopFolderBarItem;
                return (
                  <div className="rounded-lg border border-border/60 bg-popover p-2.5 shadow-md text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <p className="break-all">{item.fullName}</p>
                    </div>
                    <p className="font-mono text-muted-foreground">
                      Size: {formatBytes(item.sizeBytes)} ({formatNumber(item.sizeBytes)} bytes)
                    </p>
                    <p className="font-mono text-primary font-medium">
                      {item.percent < 0.1 && item.percent > 0
                        ? "<0.1%"
                        : `${item.percent.toFixed(1)}%`}{" "}
                      of total
                    </p>
                    {item.clickable && (
                      <p className="text-[10px] text-muted-foreground italic pt-0.5">
                        Click bar to drill down
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Bar
              dataKey="sizeBytes"
              radius={[0, 4, 4, 0]}
              onClick={(entry) => {
                const item = entry as unknown as TopFolderBarItem;
                if (item?.clickable && item.path) {
                  onDrillDown(item.path);
                }
              }}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.id}
                  fill={entry.color}
                  className={
                    entry.clickable
                      ? "cursor-pointer hover:opacity-80 transition-opacity"
                      : "opacity-80"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
