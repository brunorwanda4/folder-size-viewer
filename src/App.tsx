import { useEffect, useRef } from "react";
import { ThemeProvider } from "next-themes";
import { AlertCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { PathInputCard } from "@/components/PathInputCard";
import { SummaryCards } from "@/components/SummaryCards";
import { ChartsSection } from "@/components/charts/charts-section";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { ResultsTable } from "@/components/ResultsTable";
import { Toaster } from "@/components/ui/sonner";
import { useScan } from "@/hooks/useScan";
import { toast } from "sonner";
import {
  notifyScanComplete,
  notifyScanError,
  ensureNotificationPermission,
} from "@/lib/notifications";

export default function App() {
  const {
    state,
    entries,
    summary,
    error,
    currentPath,
    totalChildrenExpected,
    start,
    cancel,
    removeEntry,
  } = useScan();

  // Request notification permission on startup
  useEffect(() => {
    ensureNotificationPermission().catch(() => {});
  }, []);

  // Notifications on scan completion or error
  const prevScanStateRef = useRef(state);
  useEffect(() => {
    if (prevScanStateRef.current === "scanning") {
      if (state === "error" && error) {
        toast.error("Scan Failed", {
          description: error,
        });
        notifyScanError(currentPath, error).catch(() => {});
      } else if (state === "done" && summary) {
        toast.success("Scan Completed", {
          description: `Found ${entries.length} items (${summary.skippedCount} skipped)`,
        });
        notifyScanComplete({
          path: currentPath,
          totalSize: summary.totalSize,
          itemsCount: entries.length,
          skippedCount: summary.skippedCount,
          elapsedMs: summary.elapsedMs,
        }).catch(() => {});
      }
    }
    prevScanStateRef.current = state;
  }, [state, error, summary, entries.length, currentPath]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="flex flex-col bg-background text-foreground antialiased overflow-hidden p-4 md:p-6 gap-3.5 select-none">
        {/* Top Header */}
        <Header />

        {/* Path Input Card */}
        <PathInputCard
          currentPath={currentPath}
          scanState={state}
          onScan={start}
          onCancel={cancel}
        />

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1 font-medium">{error}</span>
          </div>
        )}

        {/* Scrollable Main Workspace to accommodate Charts and Results */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto gap-3.5 pr-0.5">
          {/* Summary Metrics Row */}
          <SummaryCards
            summary={summary}
            scanState={state}
            itemsCount={entries.length}
          />

          {/* Collapsible Charts Section */}
          <ChartsSection
            entries={entries}
            summary={summary}
            scanState={state}
            onDrillDown={start}
          />

          {/* Breadcrumb Navigation for Parent Folders */}
          {currentPath && (
            <BreadcrumbNav
              currentPath={currentPath}
              onNavigate={start}
              disabled={state === "scanning"}
            />
          )}

          {/* Results Table / Cards View with Controls */}
          <ResultsTable
            entries={entries}
            summary={summary}
            scanState={state}
            totalChildrenExpected={totalChildrenExpected}
            onDrillDown={start}
            onItemDeleted={removeEntry}
          />
        </div>

        {/* Toast Container */}
        <Toaster position="bottom-right" />
      </div>
    </ThemeProvider>
  );
}
