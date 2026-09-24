import {
  Trash2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Timer,
  Clock,
  HardDrive,
  FileText,
  Minimize2,
  Square,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileIcon } from "@/components/file-icon";
import { formatBytes, formatNumber, formatSecondsLeft } from "@/lib/format";
import { useDeletion } from "@/context/DeletionContext";

export interface DeletionDialogProps {
  onItemDeleted?: (path: string, sizeBytes: number) => void;
}

export function DeletionDialog({ onItemDeleted }: DeletionDialogProps) {
  const {
    pendingCandidate,
    activeModalTask,
    cancelPendingDelete,
    confirmDelete,
    stopDeleting,
    minimizeTask,
  } = useDeletion();

  const isDeletingModal = activeModalTask?.status === "deleting";
  const activeItem =
    pendingCandidate ||
    (activeModalTask
      ? {
          name: activeModalTask.name,
          path: activeModalTask.path,
          isDir: activeModalTask.isDir,
          sizeBytes: activeModalTask.totalSize,
          fileCount: activeModalTask.totalFiles,
        }
      : null);

  const isDialogActive = !!pendingCandidate || !!activeModalTask;

  const handleConfirmDelete = async () => {
    await confirmDelete(onItemDeleted);
  };

  return (
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

                  {activeItem.isDir && typeof activeItem.fileCount === "number" && activeItem.fileCount > 0 && (
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
              <div className="flex items-center gap-2 order-2 sm:order-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    activeModalTask && minimizeTask(activeModalTask.id)
                  }
                  className="gap-1.5"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span>Minimize</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => stopDeleting(activeModalTask?.id)}
                  className="gap-1.5 shadow-sm"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Deleting</span>
                </Button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled
                className="gap-1.5 min-w-[130px] order-1 sm:order-2"
              >
                <Loader2 className="w-4 h-4 animate-spin text-destructive" />
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
  );
}
