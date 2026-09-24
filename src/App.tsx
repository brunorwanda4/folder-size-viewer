import { AlertCircle, PieChart, Search } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BackgroundDeletionsWidget } from "@/components/BackgroundDeletionsWidget";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { ChartsSection } from "@/components/charts/charts-section";
import { Header } from "@/components/Header";
import { PathInputCard } from "@/components/PathInputCard";
import { ResultsTable } from "@/components/ResultsTable";
import { SummaryCards } from "@/components/SummaryCards";
import { IndexingStatusBar } from "@/components/search/indexing-status-bar";
import { SearchSettingsSheet } from "@/components/search/search-settings-sheet";
import { SearchView } from "@/components/search/search-view";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeletionProvider } from "@/context/DeletionContext";
import { useIndexing } from "@/hooks/useIndexing";
import { useScan } from "@/hooks/useScan";
import {
	ensureNotificationPermission,
	notifyScanComplete,
	notifyScanError,
} from "@/lib/notifications";

export default function App() {
	const [activeTab, setActiveTab] = useState<"disk-usage" | "search">(
		"disk-usage",
	);
	const [searchSettingsOpen, setSearchSettingsOpen] = useState(false);
	const searchInputRef = useRef<HTMLInputElement>(null);

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

	const indexing = useIndexing();

	// Request notification permission on startup
	useEffect(() => {
		ensureNotificationPermission().catch(() => {});
	}, []);

	// Global Ctrl+K / Cmd+K shortcut
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setActiveTab("search");
				setTimeout(() => {
					searchInputRef.current?.focus();
					searchInputRef.current?.select();
				}, 50);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
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

	const handleAnalyzeFolder = (folderPath: string) => {
		setActiveTab("disk-usage");
		start(folderPath);
	};

	return (
		<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
			<DeletionProvider>
				<div className="flex flex-col h-screen bg-background text-foreground antialiased overflow-hidden p-4 md:p-6 gap-3 select-none">
					{/* Top Header */}
					<Header onOpenSearchSettings={() => setSearchSettingsOpen(true)} />

					{/* Workspace with Tabs */}
					<Tabs
						value={activeTab}
						onValueChange={(val) =>
							setActiveTab(val as "disk-usage" | "search")
						}
						className="flex-1 flex flex-col min-h-0"
					>
						<div className="flex items-center justify-between pb-1 shrink-0">
							<TabsList className="grid w-64 grid-cols-2">
								<TabsTrigger
									value="disk-usage"
									className="flex items-center gap-1.5"
								>
									<PieChart className="h-4 w-4" />
									Disk Usage
								</TabsTrigger>
								<TabsTrigger
									value="search"
									className="flex items-center gap-1.5"
								>
									<Search className="h-4 w-4" />
									Search
									<kbd className="ml-1 hidden sm:inline-flex h-4 items-center rounded border bg-muted/60 px-1 font-mono text-[9px] text-muted-foreground">
										Ctrl+K
									</kbd>
								</TabsTrigger>
							</TabsList>
						</div>

						{/* Disk Usage Tab */}
						<TabsContent
							value="disk-usage"
							className="flex-1 flex flex-col min-h-0 overflow-hidden mt-0 gap-3 data-[state=inactive]:hidden"
						>
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
						</TabsContent>

						{/* Search Tab */}
						<TabsContent
							value="search"
							className="flex-1 flex flex-col min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden"
						>
							<SearchView
								currentFolderPath={currentPath}
								status={indexing.status}
								onStartIndexing={indexing.startIndexing}
								onOpenSettings={() => setSearchSettingsOpen(true)}
								onAnalyzeFolder={handleAnalyzeFolder}
								inputRef={searchInputRef}
							/>
						</TabsContent>
					</Tabs>

					{/* Slim Bottom Status Bar while Indexing */}
					<IndexingStatusBar
						status={indexing.status}
						activeProgress={indexing.activeProgress}
						isPaused={indexing.isPaused}
						onPause={indexing.pauseIndexing}
						onResume={indexing.resumeIndexing}
						onCancel={indexing.cancelIndexing}
					/>

					{/* Search Settings Sheet */}
					<SearchSettingsSheet
						open={searchSettingsOpen}
						onOpenChange={setSearchSettingsOpen}
						status={indexing.status}
						isIndexing={indexing.isIndexing}
						onStartIndexing={indexing.startIndexing}
						onClearIndex={indexing.clearIndex}
						onRefreshStatus={indexing.refreshStatus}
					/>

					{/* Toast Container */}
					<Toaster position="bottom-right" />

					{/* Background Deletions Floating Widget */}
					<BackgroundDeletionsWidget />
				</div>
			</DeletionProvider>
		</ThemeProvider>
	);
}
