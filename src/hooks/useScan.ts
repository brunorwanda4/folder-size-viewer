import { useState, useRef, useCallback, useEffect } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";
import {
  FolderChildEntry,
  ScanEvent,
  ScanResult,
  ScanStatus,
  ScanSummary,
} from "@/types/scan";

export function useScan() {
  const [state, setState] = useState<ScanStatus>("idle");
  const [entries, setEntries] = useState<FolderChildEntry[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [totalChildrenExpected, setTotalChildrenExpected] = useState<number>(0);

  // Active scan ID to prevent race conditions when rapid scanning occurs
  const currentScanIdRef = useRef<number>(0);

  const cancel = useCallback(async () => {
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
            });
            break;

          case "childDone":
            setEntries((prev) => {
              const updated = [...prev, event.entry];
              // Live update running total
              const runningTotal = updated.reduce((acc, e) => acc + e.sizeBytes, 0);
              setSummary((prevSummary) => ({
                totalSize: runningTotal,
                totalChildren: prevSummary?.totalChildren || updated.length,
                elapsedMs: prevSummary?.elapsedMs || 0,
                skippedCount: prevSummary?.skippedCount || 0,
              }));
              return updated;
            });
            break;

          case "finished":
            setSummary((prevSummary) => ({
              totalSize: event.totalSize,
              totalChildren: prevSummary?.totalChildren || 0,
              elapsedMs: event.elapsedMs,
              skippedCount: event.skippedCount,
            }));
            setState("done");
            break;

          case "cancelled":
            setState("idle");
            break;

          case "error":
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
          setEntries(result.entries);
          setSummary({
            totalSize: result.totalSize,
            totalChildren: result.entries.length,
            elapsedMs: result.elapsedMs,
            skippedCount: result.skippedCount,
          });
          setState("done");
        }
      } catch (err: unknown) {
        if (scanId === currentScanIdRef.current) {
          const message = typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
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
    []
  );

  // Clean up ongoing scan when unmounting
  useEffect(() => {
    return () => {
      currentScanIdRef.current++;
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
