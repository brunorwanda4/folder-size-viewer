import { useState } from "react";
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Maximize2,
  X,
  Timer,
  Clock,
  HardDrive,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useDeletion } from "@/context/DeletionContext";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileIcon } from "./file-icon";
import { formatBytes, formatNumber, formatSecondsLeft } from "@/lib/format";

export function BackgroundDeletionsWidget() {
  const { minimizedTasks, maximizeTask, dismissTask } = useDeletion();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (minimizedTasks.length === 0) {
    return null;
  }

  const activeCount = minimizedTasks.filter((t) => t.status === "deleting").length;
  const avgPercentage =
    minimizedTasks.length > 0
      ? Math.round(
          minimizedTasks.reduce((acc, t) => acc + t.percentage, 0) /
            minimizedTasks.length
        )
      : 0;

  return (
    <aside
      aria-label="Background Deletions"
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end pointer-events-auto select-none"
    >
      {/* Collapsed Pill Button */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-card/95 hover:bg-card border border-border/80 shadow-xl backdrop-blur-md text-foreground transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <div className="relative flex items-center justify-center">
            {activeCount > 0 ? (
              <Trash2 className="w-4 h-4 text-destructive animate-pulse" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
              </span>
            )}
          </div>
          <span className="text-xs font-semibold">
            {activeCount > 0
              ? `${activeCount} ${
                  activeCount === 1 ? "task" : "tasks"
                } deleting (${avgPercentage}%)`
              : "Deletions completed"}
          </span>
          <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-transform" />
        </button>
      ) : (
        /* Expanded Floating Card */
        <div className="w-[360px] sm:w-[390px] rounded-2xl bg-card/95 border border-border/80 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/60 bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive/15 text-destructive">
                {activeCount > 0 ? (
                  <Trash2 className="w-3.5 h-3.5 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </div>
              <span className="text-xs font-bold text-foreground">
                Background Deletions
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {minimizedTasks.length}
              </Badge>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setIsExpanded(false)}
              title="Collapse to pill"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>

          {/* Task List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40 p-2 space-y-2">
            {minimizedTasks.map((task) => {
              const isDeleting = task.status === "deleting";
              const isDone = task.status === "done";
              const isError = task.status === "error";

              return (
                <div
                  key={task.id}
                  className="p-2.5 rounded-xl bg-background/80 border border-border/50 space-y-2 text-xs hover:border-border transition-colors"
                >
                  {/* Task Top Row: Icon, Name, Maximize/Dismiss Buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileIcon
                        name={task.name}
                        isDir={task.isDir}
                        size={16}
                      />
                      <span
                        className="truncate font-semibold text-foreground text-xs"
                        title={task.path}
                      >
                        {task.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px] px-1.5 py-0 h-4 font-mono"
                      >
                        {formatBytes(task.totalSize)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isDeleting && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => maximizeTask(task.id)}
                          title="Open dialog"
                        >
                          <Maximize2 className="w-3 h-3" />
                        </Button>
                      )}
                      {(isDone || isError) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => dismissTask(task.id)}
                          title="Dismiss"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar & Percentage */}
                  {isDeleting && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin text-destructive" />
                          Deleting in background...
                        </span>
                        <span className="font-mono font-bold text-destructive">
                          {task.percentage}%
                        </span>
                      </div>
                      <Progress
                        value={task.percentage}
                        className="h-2 w-full bg-secondary"
                      />
                    </div>
                  )}

                  {/* Status Banner for Done or Error */}
                  {isDone && (
                    <div className="flex items-center gap-1.5 text-emerald-500 font-medium text-[11px] bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Deleted in {task.elapsedSeconds.toFixed(1)}s</span>
                    </div>
                  )}
                  {isError && (
                    <div className="flex items-center gap-1.5 text-destructive font-medium text-[11px] bg-destructive/10 p-1.5 rounded border border-destructive/20 truncate">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {task.error || "Deletion failed"}
                      </span>
                    </div>
                  )}

                  {/* 4-Metric Grid */}
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    {/* Time Taken in seconds */}
                    <div className="flex items-center gap-1.5 p-1.5 rounded bg-muted/40 border border-border/30">
                      <Timer className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] text-muted-foreground uppercase font-medium">
                          Time Taken
                        </p>
                        <p className="text-[11px] font-mono font-bold text-foreground">
                          {task.elapsedSeconds.toFixed(1)}s
                        </p>
                      </div>
                    </div>

                    {/* Time Left (ETA) */}
                    <div className="flex items-center gap-1.5 p-1.5 rounded bg-muted/40 border border-border/30">
                      <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] text-muted-foreground uppercase font-medium">
                          Time Left
                        </p>
                        <p className="text-[11px] font-mono font-bold text-foreground">
                          {isDone
                            ? "Done"
                            : formatSecondsLeft(task.estimatedSecondsLeft)}
                        </p>
                      </div>
                    </div>

                    {/* Storage Left */}
                    <div className="flex items-center gap-1.5 p-1.5 rounded bg-muted/40 border border-border/30">
                      <HardDrive className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] text-muted-foreground uppercase font-medium">
                          Storage Left
                        </p>
                        <p className="text-[11px] font-mono font-bold text-foreground">
                          {formatBytes(task.bytesLeft)}
                        </p>
                      </div>
                    </div>

                    {/* Files Left */}
                    <div className="flex items-center gap-1.5 p-1.5 rounded bg-muted/40 border border-border/30">
                      <FileText className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] text-muted-foreground uppercase font-medium">
                          Files Left
                        </p>
                        <p className="text-[11px] font-mono font-bold text-foreground">
                          {formatNumber(task.filesLeft)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Current File Activity */}
                  {isDeleting && task.currentName && (
                    <div className="text-[10px] text-muted-foreground font-mono truncate px-1.5 py-0.5 rounded bg-muted/30 border border-border/20">
                      <span className="text-muted-foreground/70">Deleting: </span>
                      <span className="text-foreground">{task.currentName}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
