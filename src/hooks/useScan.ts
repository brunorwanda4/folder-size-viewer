import { useState, useRef, useCallback, useEffect } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";
import {
  CategoryStat,
  FolderChildEntry,
  ScanEvent,
  ScanResult,
  ScanStatus,
  ScanSummary,
} from "@/types/scan";

function mergeCategories(
  target: Record<string, CategoryStat>,
  incoming?: Record<string, CategoryStat>
): Record<string, CategoryStat> {
  if (!incoming) return target;
  const next = { ...target };
  for (const [cat, stat] of Object.entries(incoming)) {
    if (!next[cat]) {
      next[cat] = { bytes: stat.bytes, files: stat.files };
    } else {
      next[cat] = {
        bytes: next[cat].bytes + stat.bytes,
        files: next[cat].files + stat.files,
      };
    }
  }
  return next;
}

export function useScan() {
  const [state, setState] = useState<ScanStatus>("idle");
  const [entries, setEntries] = useState<FolderChildEntry[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [totalChildrenExpected, setTotalChildrenExpected] = useState<number>(0);

  // Active scan ID to prevent race conditions when rapid scanning occurs
  const currentScanIdRef = useRef<number>(0);
  const pendingEntriesRef = useRef<FolderChildEntry[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingEntries = useCallback(() => {
    if (pendingEntriesRef.current.length === 0) return;
    const batch = pendingEntriesRef.current;
    pendingEntriesRef.current = [];

    setEntries((prev) => [...prev, ...batch]);
    setSummary((prevSummary) => {
      let addedSize = 0;
      let nextCategories = { ...(prevSummary?.categories || {}) };
      for (const item of batch) {
        addedSize += item.sizeBytes;
        nextCategories = mergeCategories(nextCategories, item.categories);
      }
      return {
        totalSize: (prevSummary?.totalSize || 0) + addedSize,
        totalChildren: prevSummary?.totalChildren || 0,
        elapsedMs: prevSummary?.elapsedMs || 0,
        skippedCount: prevSummary?.skippedCount || 0,
        categories: nextCategories,
      };
    });
  }, []);

  const cancel = useCallback(async () => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    pendingEntriesRef.current = [];
    try {
      await invoke("cancel_scan");
    } catch (err) {
      console.warn("Failed to cancel scan:", err);
    }
    setState((prev) => (prev === "scanning" ? "idle" : prev));
  }, []);

  const removeEntry = useCallback((targetPath: string, sizeBytes: number) => {
    setEntries((prev) => prev.filter((e) => e.path !== targetPath));
    setSummary((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        totalSize: Math.max(0, prev.totalSize - sizeBytes),
        totalChildren: Math.max(0, prev.totalChildren - 1),
      };
    });
  }, []);

  const start = useCallback(
    async (targetPath: string) => {
      const trimmed = targetPath.trim();
      if (!trimmed) {
        setError("Please enter a valid directory path.");
        setState("error");
        return;
      }

      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      pendingEntriesRef.current = [];

      // Increment scan ID to discard events from any in-flight previous scan
      const scanId = ++currentScanIdRef.current;

      // Cancel any ongoing scan on the backend
      try {
        await invoke("cancel_scan");
      } catch {
        // Ignore errors if no scan was active
      }

      // Check if another scan has started in the meantime
      if (scanId !== currentScanIdRef.current) return;

      setCurrentPath(trimmed);
      setState("scanning");
      setError(null);
      setEntries([]);
      setSummary(null);
      setTotalChildrenExpected(0);

      // Create Tauri IPC channel for streaming events
      const channel = new Channel<ScanEvent>();

      channel.onmessage = (event: ScanEvent) => {
        if (scanId !== currentScanIdRef.current) return;

        switch (event.type) {
          case "started":
            setTotalChildrenExpected(event.totalChildren);
            setSummary({
              totalSize: 0,
              totalChildren: event.totalChildren,
              elapsedMs: 0,
              skippedCount: 0,
              categories: {},
            });
            break;

          case "childDone": {
            pendingEntriesRef.current.push(event.entry);
            // Throttle UI updates to every 60ms to prevent browser lockup on folders with many items
            if (!batchTimerRef.current) {
              batchTimerRef.current = setTimeout(() => {
                batchTimerRef.current = null;
                flushPendingEntries();
              }, 60);
            }
            break;
          }

          case "finished":
            if (batchTimerRef.current) {
              clearTimeout(batchTimerRef.current);
              batchTimerRef.current = null;
            }
            flushPendingEntries();
            setSummary((prevSummary) => ({
              totalSize: event.totalSize,
              totalChildren: prevSummary?.totalChildren || 0,
              elapsedMs: event.elapsedMs,
              skippedCount: event.skippedCount,
              categories: event.categories,
            }));
            setState("done");
            break;

          case "cancelled":
            if (batchTimerRef.current) {
              clearTimeout(batchTimerRef.current);
              batchTimerRef.current = null;
            }
            pendingEntriesRef.current = [];
            setState("idle");
            break;

          case "error":
            if (batchTimerRef.current) {
              clearTimeout(batchTimerRef.current);
              batchTimerRef.current = null;
            }
            pendingEntriesRef.current = [];
            setError(event.message);
            setState("error");
            break;
        }
      };

      try {
        const result = await invoke<ScanResult>("scan_dir", {
          path: trimmed,
          onEvent: channel,
        });

        if (scanId === currentScanIdRef.current) {
          if (batchTimerRef.current) {
            clearTimeout(batchTimerRef.current);
            batchTimerRef.current = null;
          }
          pendingEntriesRef.current = [];
          setEntries(result.entries);
          setSummary({
            totalSize: result.totalSize,
            totalChildren: result.entries.length,
            elapsedMs: result.elapsedMs,
            skippedCount: result.skippedCount,
            categories: result.categories,
          });
          setState("done");
        }
      } catch (err: unknown) {
        if (scanId === currentScanIdRef.current) {
          const message =
            typeof err === "string"
              ? err
              : err instanceof Error
              ? err.message
              : String(err);
          // If cancelled, do not treat as a hard error
          if (message.toLowerCase().includes("cancelled")) {
            setState("idle");
          } else {
            setError(message);
            setState("error");
          }
        }
      }
    },
    [flushPendingEntries]
  );

  // Clean up ongoing scan when unmounting
  useEffect(() => {
    return () => {
      currentScanIdRef.current++;
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      invoke("cancel_scan").catch(() => {});
    };
  }, []);

  return {
    state,
    entries,
    summary,
    error,
    currentPath,
    totalChildrenExpected,
    start,
    cancel,
    removeEntry,
  };
}
