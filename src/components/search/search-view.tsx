import { useVirtualizer } from "@tanstack/react-virtual";
import { invoke } from "@tauri-apps/api/core";
import {
	AlertCircle,
	Copy,
	ExternalLink,
	Folder,
	FolderSearch,
	HardDrive,
	LayoutGrid,
	LayoutList,
	Loader2,
	PieChart,
	Search,
	Settings,
	Sparkles,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileIcon } from "@/components/file-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useSearch } from "@/hooks/useSearch";
import { formatBytes, formatDate } from "@/lib/format";
import type { IndexStatus } from "@/types/search";

interface SearchViewProps {
	currentFolderPath?: string;
	status: IndexStatus | null;
	onStartIndexing: (rebuild?: boolean) => void;
	onOpenSettings: () => void;
	onAnalyzeFolder: (folderPath: string) => void;
	inputRef?: React.RefObject<HTMLInputElement>;
}

export function SearchView({
	currentFolderPath,
	status,
	onStartIndexing,
	onOpenSettings,
	onAnalyzeFolder,
	inputRef: externalInputRef,
}: SearchViewProps) {
	const internalInputRef = useRef<HTMLInputElement>(null);
	const inputRef = externalInputRef || internalInputRef;

	const {
		query,
		setQuery,
		scope,
		setScope,
		mode,
		setMode,
		filterType,
		setFilterType,
		filterCategory,
		setFilterCategory,
		hits,
		total,
		tookMs,
		isSearching,
		isLoadingMore,
		loadMore,
		clearSearch,
	} = useSearch(currentFolderPath);

	const [selectedIndex, setSelectedIndex] = useState<number>(-1);
	const [viewMode, setViewMode] = useState<"list" | "cards">(() => {
		return (
			(localStorage.getItem("search_view_mode") as "list" | "cards") || "list"
		);
	});

	useEffect(() => {
		localStorage.setItem("search_view_mode", viewMode);
	}, [viewMode]);

	const listContainerRef = useRef<HTMLDivElement>(null);
	const cardsContainerRef = useRef<HTMLDivElement>(null);

	const handleOpen = async (path: string) => {
		try {
			await invoke("open_path", { path });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error("Could not open file", { description: msg });
		}
	};

	const handleReveal = async (path: string, isDir: boolean) => {
		try {
			await invoke("reveal_in_explorer", { path, isDir });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error("Could not reveal in Explorer", { description: msg });
		}
	};

	const handleCopyPath = (path: string) => {
		navigator.clipboard.writeText(path);
		toast.success("Path copied to clipboard");
	};

	// Keyboard navigation across search results: Up/Down, Enter, Ctrl+Enter
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (hits.length === 0) return;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((prev) => (prev < hits.length - 1 ? prev + 1 : prev));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
			} else if (e.key === "Enter") {
				if (selectedIndex >= 0 && selectedIndex < hits.length) {
					e.preventDefault();
					const hit = hits[selectedIndex];
					if (e.ctrlKey) {
						handleReveal(hit.path, hit.isDir);
					} else {
						handleOpen(hit.path);
					}
				}
			}
		},
		[hits, selectedIndex],
	);

	// Virtualizer setup for List View
	const totalCount = hits.length + (hits.length < total ? 1 : 0);
	const rowVirtualizer = useVirtualizer({
		count: totalCount,
		getScrollElement: () => listContainerRef.current,
		estimateSize: (index) => {
			const hit = hits[index];
			return hit?.snippet ? 84 : 56;
		},
		overscan: 10,
	});

	// Scroll active item into view in list view
	useEffect(() => {
		if (viewMode === "list" && selectedIndex >= 0 && selectedIndex < hits.length) {
			rowVirtualizer.scrollToIndex(selectedIndex, { align: "auto" });
		}
	}, [selectedIndex, hits.length, rowVirtualizer, viewMode]);

	// Load more items when scrolling near the end in list view
	useEffect(() => {
		if (viewMode !== "list") return;
		const items = rowVirtualizer.getVirtualItems();
		if (!items.length) return;
		const lastItem = items[items.length - 1];
		if (
			lastItem.index >= hits.length - 2 &&
			hits.length < total &&
			!isSearching &&
			!isLoadingMore
		) {
			loadMore();
		}
	}, [
		viewMode,
		rowVirtualizer,
		hits.length,
		total,
		isSearching,
		isLoadingMore,
		loadMore,
	]);

	// Infinite scroll in cards view
	const handleCardsScroll = useCallback(() => {
		const el = cardsContainerRef.current;
		if (!el || isSearching || isLoadingMore || hits.length >= total) return;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 350) {
			loadMore();
		}
	}, [isSearching, isLoadingMore, hits.length, total, loadMore]);

	const folderName = useMemo(() => {
		if (!currentFolderPath) return "";
		const parts = currentFolderPath
			.replace(/\\/g, "/")
			.split("/")
			.filter(Boolean);
		return parts[parts.length - 1] || currentFolderPath;
	}, [currentFolderPath]);

	const isIndexEmpty = status && status.docCount === 0 && !status.isIndexing;

	return (
		<div
			className="flex flex-col h-full w-full max-w-7xl mx-auto px-4 py-3 gap-3 overflow-hidden outline-none"
			onKeyDown={handleKeyDown}
			tabIndex={-1}
		>
			{/* Search Input Bar */}
			<div className="flex items-center gap-2">
				<div className="relative flex-1">
					<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
					<Input
						ref={inputRef}
						placeholder="Search files, folders, and contents... (e.g. report ext:pdf or exact &quot;phrases&quot;)"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelectedIndex(-1);
						}}
						className="pl-10 pr-20 h-11 text-sm bg-background border-input shadow-sm focus-visible:ring-1"
					/>
					<div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
						{query ? (
							<Button
								size="icon"
								variant="ghost"
								className="h-6 w-6 text-muted-foreground hover:text-foreground"
								onClick={clearSearch}
								title="Clear query"
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						) : (
							<kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
								<span className="text-xs">Ctrl</span>K
							</kbd>
						)}
					</div>
				</div>

				<Button
					variant="outline"
					size="icon"
					onClick={onOpenSettings}
					className="h-11 w-11 shrink-0"
					title="Search & Index Settings"
				>
					<Settings className="h-4 w-4" />
				</Button>
			</div>

			{/* Empty Index Alert Banner */}
			{isIndexEmpty && (
				<div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs">
					<div className="flex items-center gap-2">
						<AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
						<span>
							Search index has not been built yet (0 files indexed). Build your search index to search files across your computer.
						</span>
					</div>
					<Button
						size="sm"
						onClick={() => onStartIndexing(false)}
						className="h-7 text-xs px-3 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shrink-0"
					>
						<HardDrive className="h-3.5 w-3.5" />
						Build Index Now
					</Button>
				</div>
			)}

			{/* Indexing In Progress Banner */}
			{status?.isIndexing && (
				<div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20 text-foreground text-xs">
					<div className="flex items-center gap-2">
						<Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
						<span>
							Search index is building in background ({status.docCount.toLocaleString()} files indexed so far). Results will appear as items are indexed.
						</span>
					</div>
					<Button
						size="sm"
						variant="ghost"
						onClick={onOpenSettings}
						className="h-6 text-[11px] px-2 text-primary hover:bg-primary/20"
					>
						Details
					</Button>
				</div>
			)}

			{/* Scope, Mode & Filter Toolbar */}
			<div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b text-xs">
				<div className="flex flex-wrap items-center gap-2">
					{/* Scope Toggle */}
					<div className="flex items-center bg-muted/60 p-0.5 rounded-lg border">
						<button
							type="button"
							onClick={() => setScope("computer")}
							className={`px-2.5 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 ${
								scope === "computer"
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<HardDrive className="h-3.5 w-3.5" />
							This Computer
						</button>
						<button
							type="button"
							onClick={() => {
								if (currentFolderPath) {
									setScope("folder");
								} else {
									toast.info("Select a folder in Disk Usage view first");
								}
							}}
							disabled={!currentFolderPath}
							className={`px-2.5 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 ${
								scope === "folder"
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground disabled:opacity-40"
							}`}
							title={currentFolderPath || "No folder currently viewed"}
						>
							<FolderSearch className="h-3.5 w-3.5" />
							Current Folder
							{folderName && (
								<span className="font-normal opacity-70 max-w-24 truncate">
									({folderName})
								</span>
							)}
						</button>
					</div>

					{/* Search Mode Toggle */}
					<div className="flex items-center bg-muted/60 p-0.5 rounded-lg border">
						{(["both", "names", "contents"] as const).map((m) => (
							<button
								key={m}
								type="button"
								onClick={() => setMode(m)}
								className={`px-2.5 py-1 rounded-md transition-colors font-medium capitalize ${
									mode === m
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								{m}
							</button>
						))}
					</div>

					{/* Type Filter */}
					<div className="flex items-center bg-muted/60 p-0.5 rounded-lg border">
						{(["all", "files", "folders"] as const).map((t) => (
							<button
								key={t}
								type="button"
								onClick={() => setFilterType(t)}
								className={`px-2.5 py-1 rounded-md transition-colors font-medium capitalize ${
									filterType === t
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								{t}
							</button>
						))}
					</div>

					{/* Category Select */}
					<Select value={filterCategory} onValueChange={setFilterCategory}>
						<SelectTrigger className="h-8 w-32 text-xs">
							<SelectValue placeholder="Category" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Categories</SelectItem>
							<SelectItem value="Documents">Documents</SelectItem>
							<SelectItem value="Code">Code</SelectItem>
							<SelectItem value="Images">Images</SelectItem>
							<SelectItem value="Video">Video</SelectItem>
							<SelectItem value="Audio">Audio</SelectItem>
							<SelectItem value="Archives">Archives</SelectItem>
							<SelectItem value="Other">Other</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Right: Results summary & View mode switcher */}
				<div className="flex items-center gap-3 shrink-0 ml-auto">
					<div className="text-muted-foreground">
						{isSearching ? (
							<span className="flex items-center gap-1.5 text-primary">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Searching...
							</span>
						) : query.trim() ? (
							<span>
								<strong className="text-foreground">
									{total.toLocaleString()}
								</strong>{" "}
								results in{" "}
								<strong className="text-foreground">{tookMs} ms</strong>
							</span>
						) : null}
					</div>

					{/* View Toggle: List vs Cards */}
					<div className="flex items-center bg-muted/60 p-0.5 rounded-lg border">
						<button
							type="button"
							onClick={() => setViewMode("list")}
							className={`p-1.5 rounded-md transition-colors ${
								viewMode === "list"
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
							title="List view"
							aria-label="List view"
						>
							<LayoutList className="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							onClick={() => setViewMode("cards")}
							className={`p-1.5 rounded-md transition-colors ${
								viewMode === "cards"
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
							title="Cards view"
							aria-label="Cards view"
						>
							<LayoutGrid className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			</div>

			{/* Main Results / Empty States Area */}
			<div className="flex-1 min-h-0 relative">
				{/* State 1: Index Not Built Yet (Show even if query entered, instead of misleading "No matches") */}
				{isIndexEmpty ? (
					<div className="h-full flex items-center justify-center p-6">
						<Card className="max-w-lg w-full text-center border-dashed">
							<CardContent className="pt-8 pb-8 px-6 space-y-4">
								<div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
									<HardDrive className="h-6 w-6" />
								</div>
								<div>
									<h3 className="text-lg font-bold">Search Index Not Built Yet</h3>
									<p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
										{query.trim() ? (
											<>
												You searched for <strong className="text-foreground">&ldquo;{query}&rdquo;</strong>, but your computer has not been indexed yet (0 files indexed).
											</>
										) : (
											<>
												Fast full-text search powered by Tantivy in Rust. Search your computer by file name and instant text search inside files.
											</>
										)}
										{" "}Build the index once, and all your future searches across your computer will be instant!
									</p>
								</div>
								<div className="pt-2">
									<Button
										onClick={() => onStartIndexing(false)}
										className="w-full gap-2 shadow-sm"
									>
										<Sparkles className="h-4 w-4" />
										Build Search Index Now
									</Button>
								</div>
								<p className="text-[11px] text-muted-foreground">
									Default locations: User home folder (Downloads, Documents, Desktop, etc.).
								</p>
							</CardContent>
						</Card>
					</div>
				) : !query.trim() ? (
					/* State 2: Ready to search (prompt to type) */
					<div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
						<FolderSearch className="h-12 w-12 stroke-[1.25] text-muted-foreground/40 mb-3" />
						<h4 className="text-sm font-semibold text-foreground">
							Search files and text content
						</h4>
						<p className="text-xs max-w-sm mt-1">
							Type to search by name or file contents across{" "}
							{status?.docCount.toLocaleString() ?? "all"} indexed items.
						</p>
						<div className="flex flex-wrap justify-center gap-1.5 mt-4 text-[11px] font-mono">
							<span className="px-2 py-0.5 rounded bg-muted">ext:png</span>
							<span className="px-2 py-0.5 rounded bg-muted">
								&quot;exact phrase&quot;
							</span>
							<span className="px-2 py-0.5 rounded bg-muted">ChatGPT Image</span>
						</div>
					</div>
				) : hits.length === 0 && !isSearching ? (
					/* State 3: No Results Found */
					<div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
						{status?.isIndexing ? (
							<>
								<Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
								<h4 className="text-sm font-semibold text-foreground">
									Indexing in progress...
								</h4>
								<p className="text-xs mt-1 max-w-sm">
									Your computer is currently being indexed. Results for &ldquo;{query}&rdquo; will appear as soon as matching files are indexed.
								</p>
							</>
						) : (
							<>
								<Search className="h-10 w-10 stroke-[1.25] text-muted-foreground/30 mb-2" />
								<h4 className="text-sm font-medium text-foreground">
									No matches found
								</h4>
								<p className="text-xs mt-1 max-w-sm">
									No files or content found for &ldquo;{query}&rdquo;
									{scope === "folder" ? " in the current folder." : ` across ${status?.docCount.toLocaleString() ?? 0} indexed files.`}
								</p>
								<div className="flex items-center gap-2 mt-3">
									{scope === "folder" ? (
										<Button
											variant="outline"
											size="sm"
											onClick={() => setScope("computer")}
											className="text-xs"
										>
											Search whole computer instead
										</Button>
									) : (
										<Button
											variant="outline"
											size="sm"
											onClick={onOpenSettings}
											className="text-xs"
										>
											Manage Indexed Folders
										</Button>
									)}
								</div>
							</>
						)}
					</div>
				) : viewMode === "list" ? (
					/* State 4A: Virtualized List View */
					<div
						ref={listContainerRef}
						className="h-full overflow-y-auto pr-1 select-none"
						tabIndex={0}
					>
						<div
							style={{
								height: `${rowVirtualizer.getTotalSize()}px`,
								width: "100%",
								position: "relative",
							}}
						>
							{rowVirtualizer.getVirtualItems().map((virtualRow) => {
								const index = virtualRow.index;
								const isLoadMoreRow = index >= hits.length;

								if (isLoadMoreRow) {
									return (
										<div
											key="load-more"
											style={{
												position: "absolute",
												top: 0,
												left: 0,
												width: "100%",
												transform: `translateY(${virtualRow.start}px)`,
											}}
											className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2"
										>
											<Loader2 className="h-4 w-4 animate-spin text-primary" />
											Loading more results...
										</div>
									);
								}

								const hit = hits[index];
								const isSelected = selectedIndex === index;

								return (
									<div
										key={hit.path}
										data-index={index}
										ref={rowVirtualizer.measureElement}
										style={{
											position: "absolute",
											top: 0,
											left: 0,
											width: "100%",
											transform: `translateY(${virtualRow.start}px)`,
										}}
										onClick={() => setSelectedIndex(index)}
										onDoubleClick={() => handleOpen(hit.path)}
										className={`group px-3 py-2 border-b transition-colors cursor-pointer rounded-sm flex flex-col justify-center ${
											isSelected
												? "bg-primary/10 border-primary/30"
												: "hover:bg-muted/50 border-border/40"
										}`}
									>
										<div className="flex items-center justify-between gap-3 min-w-0">
											{/* Left: Icon & Name & Path */}
											<div className="flex items-center gap-2.5 min-w-0 flex-1">
												<FileIcon name={hit.name} isDir={hit.isDir} size={18} />

												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2">
														<span className="font-medium text-xs truncate text-foreground">
															{renderHighlightedName(
																hit.name,
																hit.matchedNameRanges,
															)}
														</span>
														{hit.isDir ? (
															<Badge
																variant="outline"
																className="text-[10px] px-1 py-0 h-4"
															>
																Folder
															</Badge>
														) : (
															<span className="text-[10px] text-muted-foreground uppercase font-mono">
																{hit.category}
															</span>
														)}
													</div>

													<div
														className="text-[11px] text-muted-foreground/80 truncate font-mono mt-0.5"
														title={hit.path}
													>
														{hit.path}
													</div>
												</div>
											</div>

											{/* Right: Meta & Action buttons */}
											<div className="flex items-center gap-3 shrink-0">
												<div className="text-right text-[11px] text-muted-foreground hidden sm:block">
													<div>
														{!hit.isDir ? formatBytes(hit.sizeBytes) : "—"}
													</div>
													<div className="text-[10px] opacity-70">
														{hit.modified ? formatDate(hit.modified) : ""}
													</div>
												</div>

												{/* Quick actions hover toolbar */}
												<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
													{hit.isDir && (
														<Button
															size="sm"
															variant="ghost"
															className="h-7 text-xs px-2 gap-1 text-primary hover:text-primary hover:bg-primary/10"
															onClick={(e) => {
																e.stopPropagation();
																onAnalyzeFolder(hit.path);
															}}
															title="Analyze disk usage of this folder"
														>
															<PieChart className="h-3.5 w-3.5" />
															Analyze
														</Button>
													)}

													<Button
														size="icon"
														variant="ghost"
														className="h-7 w-7 text-muted-foreground hover:text-foreground"
														onClick={(e) => {
															e.stopPropagation();
															handleOpen(hit.path);
														}}
														title="Open with default app (Enter)"
													>
														<ExternalLink className="h-3.5 w-3.5" />
													</Button>

													<Button
														size="icon"
														variant="ghost"
														className="h-7 w-7 text-muted-foreground hover:text-foreground"
														onClick={(e) => {
															e.stopPropagation();
															handleReveal(hit.path, hit.isDir);
														}}
														title="Reveal in Explorer (Ctrl+Enter)"
													>
														<Folder className="h-3.5 w-3.5" />
													</Button>

													<Button
														size="icon"
														variant="ghost"
														className="h-7 w-7 text-muted-foreground hover:text-foreground"
														onClick={(e) => {
															e.stopPropagation();
															handleCopyPath(hit.path);
														}}
														title="Copy path"
													>
														<Copy className="h-3.5 w-3.5" />
													</Button>
												</div>
											</div>
										</div>

										{/* Snippet for Content Match */}
										{hit.snippet && (
											<div className="mt-1.5 pl-7 text-[11px] text-muted-foreground bg-muted/30 rounded px-2 py-1 font-mono leading-relaxed line-clamp-2">
												&hellip;{" "}
												{renderHighlightedSnippet(
													hit.snippet.text,
													hit.snippet.highlights,
												)}{" "}
												&hellip;
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				) : (
					/* State 4B: Responsive Card Grid View */
					<div
						ref={cardsContainerRef}
						onScroll={handleCardsScroll}
						className="h-full overflow-y-auto pr-1 select-none"
						tabIndex={0}
					>
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 p-1 pb-6">
							{hits.map((hit, index) => {
								const isSelected = selectedIndex === index;

								return (
									<Card
										key={hit.path}
										onClick={() => setSelectedIndex(index)}
										onDoubleClick={() => handleOpen(hit.path)}
										className={`group flex flex-col justify-between p-3.5 border transition-all cursor-pointer rounded-lg relative overflow-hidden select-text ${
											isSelected
												? "border-primary ring-1 ring-primary bg-primary/5 shadow-sm"
												: "hover:border-primary/40 hover:shadow-md hover:bg-card/90 bg-card"
										}`}
									>
										<div>
											{/* Top: Icon + Name + Category & Size */}
											<div className="flex items-start gap-3">
												<div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-muted/50 p-1 border border-border/50 group-hover:scale-105 transition-transform">
													<FileIcon name={hit.name} isDir={hit.isDir} size={28} />
												</div>

												<div className="min-w-0 flex-1">
													<span
														className="font-medium text-xs truncate text-foreground block group-hover:text-primary transition-colors"
														title={hit.name}
													>
														{renderHighlightedName(hit.name, hit.matchedNameRanges)}
													</span>

													<div className="flex items-center gap-1.5 mt-1">
														{hit.isDir ? (
															<Badge
																variant="outline"
																className="text-[9px] px-1 py-0 h-4"
															>
																Folder
															</Badge>
														) : (
															<Badge
																variant="secondary"
																className="text-[9px] px-1.5 py-0 h-4 uppercase font-mono font-normal"
															>
																{hit.category}
															</Badge>
														)}

														<span className="text-[10px] text-muted-foreground ml-auto">
															{!hit.isDir ? formatBytes(hit.sizeBytes) : "—"}
														</span>
													</div>
												</div>
											</div>

											{/* Path Row */}
											<div
												className="text-[10px] text-muted-foreground/80 truncate font-mono mt-2.5 px-2 py-1 rounded bg-muted/40"
												title={hit.path}
											>
												{hit.path}
											</div>

											{/* Snippet for Content Match */}
											{hit.snippet && (
												<div className="mt-2 text-[10px] text-muted-foreground bg-muted/30 rounded p-1.5 font-mono leading-relaxed line-clamp-3 border border-border/30">
													&hellip;{" "}
													{renderHighlightedSnippet(
														hit.snippet.text,
														hit.snippet.highlights,
													)}{" "}
													&hellip;
												</div>
											)}
										</div>

										{/* Bottom Row: Modified Date & Quick Action Buttons */}
										<div className="flex items-center justify-between mt-3 pt-2 border-t text-[10px] text-muted-foreground">
											<span>{hit.modified ? formatDate(hit.modified) : ""}</span>

											<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
												{hit.isDir && (
													<Button
														size="icon"
														variant="ghost"
														className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10"
														onClick={(e) => {
															e.stopPropagation();
															onAnalyzeFolder(hit.path);
														}}
														title="Analyze disk usage"
													>
														<PieChart className="h-3 w-3" />
													</Button>
												)}

												<Button
													size="icon"
													variant="ghost"
													className="h-6 w-6 text-muted-foreground hover:text-foreground"
													onClick={(e) => {
														e.stopPropagation();
														handleOpen(hit.path);
													}}
													title="Open with default app (Enter)"
												>
													<ExternalLink className="h-3 w-3" />
												</Button>

												<Button
													size="icon"
													variant="ghost"
													className="h-6 w-6 text-muted-foreground hover:text-foreground"
													onClick={(e) => {
														e.stopPropagation();
														handleReveal(hit.path, hit.isDir);
													}}
													title="Reveal in Explorer (Ctrl+Enter)"
												>
													<Folder className="h-3 w-3" />
												</Button>

												<Button
													size="icon"
													variant="ghost"
													className="h-6 w-6 text-muted-foreground hover:text-foreground"
													onClick={(e) => {
														e.stopPropagation();
														handleCopyPath(hit.path);
													}}
													title="Copy path"
												>
													<Copy className="h-3 w-3" />
												</Button>
											</div>
										</div>
									</Card>
								);
							})}

							{/* Load more row in Cards view */}
							{hits.length < total && (
								<div className="col-span-full py-4 text-center">
									<Button
										variant="outline"
										size="sm"
										disabled={isLoadingMore}
										onClick={loadMore}
										className="gap-2 text-xs"
									>
										{isLoadingMore ? (
											<>
												<Loader2 className="h-3.5 w-3.5 animate-spin" />
												Loading more...
											</>
										) : (
											`Load more results (${hits.length} of ${total.toLocaleString()})`
										)}
									</Button>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Footer shortcut hints */}
			<div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
				<div className="flex items-center gap-3">
					<span>
						<kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">
							↑
						</kbd>{" "}
						<kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">
							↓
						</kbd>{" "}
						Navigate
					</span>
					<span>
						<kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">
							Enter
						</kbd>{" "}
						Open
					</span>
					<span>
						<kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">
							Ctrl
						</kbd>
						+
						<kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">
							Enter
						</kbd>{" "}
						Explorer
					</span>
				</div>
				<div>
					{status && (
						<span>{status.docCount.toLocaleString()} items indexed</span>
					)}
				</div>
			</div>
		</div>
	);
}

/**
 * Builds React span elements with highlighted ranges for filename matching.
 * Never uses dangerouslySetInnerHTML.
 */
function renderHighlightedName(name: string, ranges: [number, number][]) {
	if (!ranges || ranges.length === 0) {
		return name;
	}

	const elements: React.ReactNode[] = [];
	let lastIndex = 0;

	ranges.forEach(([start, end], idx) => {
		const s = Math.max(0, Math.min(start, name.length));
		const e = Math.max(s, Math.min(end, name.length));

		if (s > lastIndex) {
			elements.push(<span key={`un-${idx}`}>{name.slice(lastIndex, s)}</span>);
		}
		if (e > s) {
			elements.push(
				<span
					key={`hl-${idx}`}
					className="font-bold text-primary underline underline-offset-2"
				>
					{name.slice(s, e)}
				</span>,
			);
		}
		lastIndex = e;
	});

	if (lastIndex < name.length) {
		elements.push(<span key="tail">{name.slice(lastIndex)}</span>);
	}

	return elements;
}

/**
 * Builds React span elements with highlighted ranges for text snippet matching.
 * Never uses dangerouslySetInnerHTML.
 */
function renderHighlightedSnippet(
	text: string,
	highlights: [number, number][],
) {
	if (!highlights || highlights.length === 0) {
		return text;
	}

	const elements: React.ReactNode[] = [];
	let lastIndex = 0;

	highlights.forEach(([start, end], idx) => {
		const s = Math.max(0, Math.min(start, text.length));
		const e = Math.max(s, Math.min(end, text.length));

		if (s > lastIndex) {
			elements.push(
				<span key={`sn-un-${idx}`}>{text.slice(lastIndex, s)}</span>,
			);
		}
		if (e > s) {
			elements.push(
				<mark
					key={`sn-hl-${idx}`}
					className="bg-amber-400/40 text-foreground font-semibold rounded px-0.5"
				>
					{text.slice(s, e)}
				</mark>,
			);
		}
		lastIndex = e;
	});

	if (lastIndex < text.length) {
		elements.push(<span key="sn-tail">{text.slice(lastIndex)}</span>);
	}

	return elements;
}
