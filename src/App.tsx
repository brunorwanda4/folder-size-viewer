import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { AlertCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { PathInputCard } from "@/components/PathInputCard";
import { SummaryCards } from "@/components/SummaryCards";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { ResultsTable } from "@/components/ResultsTable";
import { Toaster } from "@/components/ui/sonner";
import { useScan } from "@/hooks/useScan";
import { toast } from "sonner";

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

  // Toast on scan completion or error
  useEffect(() => {
    if (state === "error" && error) {
      toast.error("Scan Failed", {
        description: error,
      });
    } else if (state === "done" && summary) {
      toast.success("Scan Completed", {
        description: `Found ${entries.length} items (${summary.skippedCount} skipped)`,
      });
    }
  }, [state, error, summary, entries.length]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="flex flex-col h-screen max-h-screen bg-background text-foreground antialiased overflow-hidden p-4 md:p-6 gap-3.5 select-none">
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

        {/* Summary Metrics Row */}
        <SummaryCards
          summary={summary}
          scanState={state}
          itemsCount={entries.length}
        />

        {/* Breadcrumb Navigation for Parent Folders */}
        {currentPath && (
          <BreadcrumbNav
            currentPath={currentPath}
            onNavigate={start}
            disabled={state === "scanning"}
          />
        )}

        {/* Results Table */}
        <ResultsTable
          entries={entries}
          summary={summary}
          scanState={state}
          totalChildrenExpected={totalChildrenExpected}
          onDrillDown={start}
          onItemDeleted={removeEntry}
        />

        {/* Toast Container */}
        <Toaster position="bottom-right" />
      </div>
    </ThemeProvider>
  );
}
