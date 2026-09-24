import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { invoke, Channel } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  FolderChildEntry,
  DeletionTask,
  DeleteProgressEvent,
} from "@/types/scan";
import { notifyDeleteComplete } from "@/lib/notifications";
import { formatBytes } from "@/lib/format";

interface DeletionContextType {
  tasks: DeletionTask[];
  minimizedTasks: DeletionTask[];
  pendingCandidate: FolderChildEntry | null;
  activeModalTask: DeletionTask | null;
  requestDelete: (entry: FolderChildEntry) => void;
  cancelPendingDelete: () => void;
  confirmDelete: (
    onItemDeleted?: (path: string, sizeBytes: number) => void
  ) => Promise<void>;
  minimizeTask: (taskId: string) => void;
  maximizeTask: (taskId: string) => void;
  dismissTask: (taskId: string) => void;
}

const DeletionContext = createContext<DeletionContextType | null>(null);

export function DeletionProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<DeletionTask[]>([]);
  const [pendingCandidate, setPendingCandidate] =
    useState<FolderChildEntry | null>(null);
  const [activeModalTaskId, setActiveModalTaskId] = useState<string | null>(
    null
  );

  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const activeModalTask =
    tasks.find((t) => t.id === activeModalTaskId && t.status === "deleting") ||
    null;

  const minimizedTasks = tasks.filter((t) => t.isMinimized);

  const requestDelete = useCallback(
    (entry: FolderChildEntry) => {
      const existing = tasks.find(
        (t) => t.id === entry.path && t.status === "deleting"
      );
      if (existing) {
        toast.info(`"${entry.name}" is already being deleted in the background.`);
        return;
      }
      setPendingCandidate(entry);
    },
    [tasks]
  );

  const cancelPendingDelete = useCallback(() => {
    setPendingCandidate(null);
  }, []);

  const minimizeTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isMinimized: true } : t))
    );
    setActiveModalTaskId((prev) => (prev === taskId ? null : prev));

    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      toast.info(`Deleting "${task.name}" in background`, {
        description: "You can keep browsing, searching, or delete other folders.",
        duration: 3500,
      });
    }
  }, [tasks]);

  const maximizeTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isMinimized: false } : t))
    );
    setActiveModalTaskId(taskId);
  }, []);

  const dismissTask = useCallback((taskId: string) => {
    const timer = timersRef.current.get(taskId);
    if (timer) {
      clearInterval(timer);
      timersRef.current.delete(taskId);
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setActiveModalTaskId((prev) => (prev === taskId ? null : prev));
  }, []);

  const confirmDelete = useCallback(
    async (onItemDeleted?: (path: string, sizeBytes: number) => void) => {
      if (!pendingCandidate) return;
      const candidate = pendingCandidate;
      const taskId = candidate.path;
      const totalFiles = candidate.isDir ? candidate.fileCount || 1 : 1;
      const totalBytes = candidate.sizeBytes;
      const startMs = performance.now();

      // Immediately notify parent to remove entry from results view
      onItemDeleted?.(candidate.path, candidate.sizeBytes);

      // Create new active deletion task
      const newTask: DeletionTask = {
        id: taskId,
        name: candidate.name,
        path: candidate.path,
        isDir: candidate.isDir,
        totalSize: totalBytes,
        totalFiles,
        status: "deleting",
        percentage: 0,
        filesLeft: totalFiles,
        bytesLeft: totalBytes,
        elapsedSeconds: 0,
        estimatedSecondsLeft: null,
        currentName: candidate.name,
        isMinimized: false,
        startTime: startMs,
      };

      setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== taskId)]);
      setActiveModalTaskId(taskId);
      setPendingCandidate(null);

      // Start elapsed timer for this task
      const interval = setInterval(() => {
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id === taskId && t.status === "deleting") {
              const elapsed = (performance.now() - t.startTime) / 1000;
              let eta = t.estimatedSecondsLeft;

              if (eta === null && elapsed > 0.6) {
                const bytesDeleted = t.totalSize - t.bytesLeft;
                if (bytesDeleted > 0 && t.bytesLeft > 0) {
                  const bytesPerSec = bytesDeleted / elapsed;
                  if (bytesPerSec > 0) {
                    eta = t.bytesLeft / bytesPerSec;
                  }
                }
              }

              return {
                ...t,
                elapsedSeconds: elapsed,
                estimatedSecondsLeft: eta,
              };
            }
            return t;
          })
        );
      }, 100);

      timersRef.current.set(taskId, interval);

      // Set up Tauri Channel for streaming progress
      const channel = new Channel<DeleteProgressEvent>();
      channel.onmessage = (event) => {
        if (event.type === "progress") {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id === taskId && t.status === "deleting") {
                return {
                  ...t,
                  percentage: Math.min(
                    100,
                    Math.max(0, Math.round(event.percentage))
                  ),
                  filesLeft: event.filesLeft,
                  bytesLeft: event.bytesLeft,
                  currentName: event.currentName || t.currentName,
                  estimatedSecondsLeft:
                    event.estimatedSecondsLeft !== null &&
                    event.estimatedSecondsLeft !== undefined
                      ? event.estimatedSecondsLeft
                      : t.estimatedSecondsLeft,
                };
              }
              return t;
            })
          );
        } else if (event.type === "finished") {
          const finalSecs = event.elapsedSeconds;
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id === taskId) {
                return {
                  ...t,
                  status: "done",
                  percentage: 100,
                  filesLeft: 0,
                  bytesLeft: 0,
                  elapsedSeconds: finalSecs,
                };
              }
              return t;
            })
          );
        }
      };

      try {
        await invoke("delete_item", {
          path: candidate.path,
          totalFiles,
          totalBytes,
          onProgress: channel,
        });

        const finalSecs = Math.max(
          0.1,
          (performance.now() - startMs) / 1000
        );

        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: "done",
                  percentage: 100,
                  filesLeft: 0,
                  bytesLeft: 0,
                  elapsedSeconds: finalSecs,
                }
              : t
          )
        );

        toast.success(
          `${candidate.isDir ? "Folder" : "File"} deleted in ${finalSecs.toFixed(
            1
          )}s`,
          {
            description: `"${candidate.name}" (${formatBytes(
              candidate.sizeBytes
            )}) was permanently removed.`,
            duration: 5000,
          }
        );

        notifyDeleteComplete(
          {
            name: candidate.name,
            path: candidate.path,
            isDir: candidate.isDir,
            sizeBytes: candidate.sizeBytes,
            elapsedSeconds: finalSecs,
          },
          true
        ).catch(() => {});

        setTimeout(() => {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
          setActiveModalTaskId((prev) => (prev === taskId ? null : prev));
        }, 4000);
      } catch (err: unknown) {
        const errorMsg =
          typeof err === "string"
            ? err
            : err instanceof Error
            ? err.message
            : String(err);

        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: "error", error: errorMsg }
              : t
          )
        );

        toast.error(`Failed to delete ${candidate.isDir ? "folder" : "file"}`, {
          description: errorMsg,
          duration: 6000,
        });
      } finally {
        const timer = timersRef.current.get(taskId);
        if (timer) {
          clearInterval(timer);
          timersRef.current.delete(taskId);
        }
        setTimeout(() => {
          setActiveModalTaskId((prev) => (prev === taskId ? null : prev));
        }, 600);
      }
    },
    [pendingCandidate]
  );

  return (
    <DeletionContext.Provider
      value={{
        tasks,
        minimizedTasks,
        pendingCandidate,
        activeModalTask,
        requestDelete,
        cancelPendingDelete,
        confirmDelete,
        minimizeTask,
        maximizeTask,
        dismissTask,
      }}
    >
      {children}
    </DeletionContext.Provider>
  );
}

export function useDeletion() {
  const context = useContext(DeletionContext);
  if (!context) {
    throw new Error("useDeletion must be used within a DeletionProvider");
  }
  return context;
}
