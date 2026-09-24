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
import { useAppErrors } from "@/context/ErrorContext";

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
  stopDeleting: (taskId?: string) => Promise<void>;
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

  const { addError, openErrorPage } = useAppErrors();
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const activeModalTask =
    tasks.find((t) => t.id === activeModalTaskId && t.status === "deleting") ||
    null;

  const minimizedTasks = tasks.filter((t) => t.isMinimized);

  const requestDelete = useCallback((entry: FolderChildEntry) => {
    setPendingCandidate(entry);
  }, []);

  const cancelPendingDelete = useCallback(() => {
    setPendingCandidate(null);
  }, []);

  const stopDeleting = useCallback(async (taskId?: string) => {
    try {
      await invoke("cancel_delete");
      if (taskId) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "cancelled" } : t))
        );
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.status === "deleting" ? { ...t, status: "cancelled" } : t
          )
        );
      }
      setActiveModalTaskId(null);
      toast.info("Deletion stopped");
    } catch (err) {
      console.error("Failed to stop deletion:", err);
    }
  }, []);

  const dismissTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setActiveModalTaskId((prev) => (prev === taskId ? null : prev));
    const timer = timersRef.current.get(taskId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(taskId);
    }
  }, []);

  const minimizeTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isMinimized: true } : t))
    );
    setActiveModalTaskId((prev) => (prev === taskId ? null : prev));
  }, []);

  const maximizeTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isMinimized: false } : t))
    );
    setActiveModalTaskId(taskId);
  }, []);

  const confirmDelete = useCallback(
    async (onItemDeleted?: (path: string, sizeBytes: number) => void) => {
      if (!pendingCandidate) return;

      const entryToDelete = pendingCandidate;
      setPendingCandidate(null);

      const taskId = `del-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const newTask: DeletionTask = {
        id: taskId,
        name: entryToDelete.name,
        path: entryToDelete.path,
        isDir: entryToDelete.isDir,
        totalSize: entryToDelete.sizeBytes,
        totalFiles: 0,
        status: "deleting",
        percentage: 0,
        filesLeft: 0,
        bytesLeft: entryToDelete.sizeBytes,
        elapsedSeconds: 0,
        estimatedSecondsLeft: null,
        currentName: entryToDelete.name,
        isMinimized: false,
        startTime: Date.now(),
      };

      setTasks((prev) => [newTask, ...prev]);
      setActiveModalTaskId(taskId);

      const channel = new Channel<DeleteProgressEvent>();
      channel.onmessage = (event) => {
        if (event.type === "progress") {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    percentage: event.percentage,
                    filesLeft: event.filesLeft,
                    bytesLeft: event.bytesLeft,
                    currentName: event.currentName,
                    elapsedSeconds: event.elapsedSeconds,
                    estimatedSecondsLeft: event.estimatedSecondsLeft,
                  }
                : t
            )
          );
        } else if (event.type === "finished") {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    status: "done",
                    percentage: 100,
                    elapsedSeconds: event.elapsedSeconds,
                    totalFiles: event.totalFiles,
                    totalSize: event.totalBytes,
                    filesLeft: 0,
                    bytesLeft: 0,
                  }
                : t
            )
          );

          toast.success("Deletion Complete", {
            description: `Permanently removed "${
              entryToDelete.name
            }" (${formatBytes(event.totalBytes)}) in ${event.elapsedSeconds.toFixed(
              1
            )}s`,
          });

          notifyDeleteComplete({
            name: entryToDelete.name,
            path: entryToDelete.path,
            isDir: entryToDelete.isDir,
            sizeBytes: event.totalBytes,
            elapsedSeconds: event.elapsedSeconds,
          }).catch(() => {});

          if (onItemDeleted) {
            onItemDeleted(entryToDelete.path, entryToDelete.sizeBytes);
          }

          // Auto dismiss after 10s if minimized
          const timer = setTimeout(() => {
            dismissTask(taskId);
          }, 10000);
          timersRef.current.set(taskId, timer);
        }
      };

      try {
        await invoke("delete_item", {
          path: entryToDelete.path,
        });

        // If command finished and was not caught as an error, mark as done
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId && t.status === "deleting"
              ? {
                  ...t,
                  status: "done",
                  percentage: 100,
                  elapsedSeconds: (Date.now() - t.startTime) / 1000,
                }
              : t
          )
        );

        toast.success("Deleted Successfully", {
          description: `Permanently removed "${entryToDelete.name}" (${formatBytes(
            entryToDelete.sizeBytes
          )})`,
        });

        if (onItemDeleted) {
          onItemDeleted(entryToDelete.path, entryToDelete.sizeBytes);
        }
      } catch (err: unknown) {
        const errorMsg =
          typeof err === "string"
            ? err
            : err instanceof Error
            ? err.message
            : "An error occurred during deletion";

        const isCancelled =
          errorMsg.toLowerCase().includes("stopped") ||
          errorMsg.toLowerCase().includes("cancelled");

        if (isCancelled) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, status: "cancelled" } : t
            )
          );
          toast.info("Deletion Stopped", {
            description: `Deletion of "${entryToDelete.name}" was cancelled.`,
          });
        } else {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    status: "error",
                    error: errorMsg,
                  }
                : t
            )
          );

          addError({
            title: `Failed to delete "${entryToDelete.name}"`,
            message: errorMsg,
            source: "deletion",
            path: entryToDelete.path,
            isDir: entryToDelete.isDir,
          });

          toast.error("Deletion Failed", {
            description: errorMsg,
            action: {
              label: "View & Fix",
              onClick: () => openErrorPage(),
            },
            duration: 8000,
          });
        }
      }
    },
    [pendingCandidate, dismissTask, addError, openErrorPage]
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
        stopDeleting,
        minimizeTask,
        maximizeTask,
        dismissTask,
      }}
    >
      {children}
    </DeletionContext.Provider>
  );
}

const defaultDeletionContext: DeletionContextType = {
  tasks: [],
  minimizedTasks: [],
  pendingCandidate: null,
  activeModalTask: null,
  requestDelete: () => {},
  cancelPendingDelete: () => {},
  confirmDelete: async () => {},
  stopDeleting: async () => {},
  minimizeTask: () => {},
  maximizeTask: () => {},
  dismissTask: () => {},
};

export function useDeletion() {
  const context = useContext(DeletionContext);
  return context || defaultDeletionContext;
}
