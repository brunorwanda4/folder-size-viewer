import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	Search,
	FolderSearch,
	Settings,
	X,
	FileText,
	Folder,
	HardDrive,
	FolderOpen,
	ExternalLink,
	Copy,
	BarChart3,
	Sparkles,
	Loader2,
	LayoutList,
	LayoutGrid,
	Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useSearch } from "@/hooks/useSearch";
import { formatBytes } from "@/lib/format";
import type { IndexStatus } from "@/types/search";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface SearchViewProps {
	currentFolderPath?: string;
	onAnalyzeFolder?: (path: string) => void;
	onOpenSettings: () => void;
	status: IndexStatus | null;
	onStartIndexing: (rebuild?: boolean) => void;
	inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function SearchView({
	currentFolderPath,
	onAnalyzeFolder,
	onOpenSettings,
	status,
	onStartIndexing,
	inputRef: externalInputRef,
}: SearchViewProps) {
	const internalInputRef = useRef<HTMLInputElement>(null);
	const inputRef = (externalInputRef || internalInputRef) as React.RefObject<HTMLInputElement>;

	// Search state from hook
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

	// Navigation & View state
	const [selectedIndex, setSelectedIndex] = useState<number>(-1);
	const [viewMode, setViewMode] = useState<"list" | "cards">(() => {
		try {
			const saved = localStorage.getItem("search_view_mode");
			if (saved === "cards" || saved === "list") return saved;
		} catch {
			// ignore localStorage error
		}
		return "list";
	});

	const handleSetViewMode = (mode: "list" | "cards") => {
		setViewMode(mode);
		try {
			localStorage.setItem("search_view_mode", mode);
		} catch {
			// ignore
		}
	};

	const listContainerRef = useRef<HTMLDivElement>(null);
	const cardsContainerRef = useRef<HTMLDivElement>(null);

	const handleOpen = useCallback(async (path: string) => {
		try {
			await invoke("open_path", { path });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error("Failed to open item", { description: msg });
		}
	}, []);

	const handleReveal = useCallback(async (path: string) => {
		try {
			await invoke("reveal_in_explorer", { path });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error("Failed to reveal item", { description: msg });
		}
	}, []);

	const handleCopyPath = useCallback((path: string) => {
		navigator.clipboard.writeText(path);
		toast.success("Path copied to clipboard");
	}, []);

	// Keyboard navigation in results
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (hits.length === 0) return;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((prev) => Math.min(prev + 1, hits.length - 1));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((prev) => Math.max(prev - 1, 0));
			} else if (e.key === "Enter" && selectedIndex >= 0) {
				e.preventDefault();
				const hit = hits[selectedIndex];
				if (hit) {
					if (hit.isDir && onAnalyzeFolder) {
						onAnalyzeFolder(hit.path);
					} else {
						handleOpen(hit.path);
					}
				}
			}
		},
		[hits, selectedIndex, onAnalyzeFolder, handleOpen]
	);

	// Virtualized row list configuration
	const totalCount = hits.length + (isLoadingMore ? 1 : 0);
	const rowVirtualizer = useVirtualizer({
		count: totalCount,
		getScrollElement: () => listContainerRef.current,
		estimateSize: (index) => {
			if (index >= hits.length) return 40;
			const hit = hits[index];
			return hit.snippet ? 94 : 64;
		},
		overscan: 5,
	});

	// Auto-scroll list when selectedIndex changes
	useEffect(() => {
		if (selectedIndex >= 0 && viewMode === "list") {
			rowVirtualizer.scrollToIndex(selectedIndex, { align: "auto" });
		}
	}, [selectedIndex, rowVirtualizer, viewMode]);

	// Infinite scroll detection for list view
	const handleScroll = useCallback(() => {
		if (!listContainerRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = listContainerRef.current;
		if (
			scrollHeight - (scrollTop + clientHeight) < 200 &&
			!isSearching &&
			!isLoadingMore &&
			hits.length < total
		) {
			loadMore();
		}
	}, [isSearching, isLoadingMore, hits.length, total, loadMore]);

	useEffect(() => {
		const el = listContainerRef.current;
		if (!el || viewMode !== "list") return;
		el.addEventListener("scroll", handleScroll);
		return () => el.removeEventListener("scroll", handleScroll);
	}, [handleScroll, viewMode]);

	// Infinite scroll detection for cards view
	const handleCardsScroll = useCallback(() => {
		if (!cardsContainerRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = cardsContainerRef.current;
		if (
			scrollHeight - (scrollTop + clientHeight) < 300 &&
			!isSearching &&
			!isLoadingMore &&
			hits.length < total
		) {
			loadMore();
		}
	}, [isSearching, isLoadingMore, hits.length, total, loadMore]);

	useEffect(() => {
		const el = cardsContainerRef.current;
		if (!el || viewMode !== "cards") return;
		el.addEventListener("scroll", handleCardsScroll);
		return () => el.removeEventListener("scroll", handleCardsScroll);
	}, [handleCardsScroll, viewMode]);

	// Keyboard shortcut: focus search input on Ctrl+K / Cmd+K
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				inputRef.current?.focus();
				inputRef.current?.select();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [inputRef]);

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
						placeholder="Search any file across your computer... (e.g. ChatGPT Image, report ext:pdf, &quot;exact phrase&quot;)"
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

			{/* Indexing In Progress Banner */}
			{status?.isIndexing && (
				<div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20 text-foreground text-xs">
					<div className="flex items-center gap-2">
						<Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
						<span>
							Background indexing is active ({status.docCount.toLocaleString()} files indexed). Live disk search is running for any files not yet indexed.
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

			{/* Empty Index Notice (only shown when query is empty so it never blocks search results) */}
			{isIndexEmpty && !status?.isIndexing && !query.trim() && (
				<div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-foreground text-xs">
					<div className="flex items-center gap-2">
						<FolderSearch className="h-4 w-4 text-primary shrink-0" />
						<span>
							Live disk search is active across your computer. Background indexing will manage files automatically.
						</span>
					</div>
					<Button
						size="sm"
						onClick={() => onStartIndexing(false)}
						className="h-7 text-xs px-3 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
					>
						<Sparkles className="h-3.5 w-3.5" />
						Build Fast Index
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
									toast.info(
										"Navigate to a folder first to search within current folder"
									);
								}
							}}
							className={`px-2.5 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 ${
								scope === "folder"
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
							title={
								currentFolderPath
									? `Search inside: ${currentFolderPath}`
									: "Navigate to a folder first"
							}
						>
							<Folder className="h-3.5 w-3.5" />
							{folderName ? `Folder: ${folderName}` : "Current Folder"}
						</button>
					</div>

					{/* Search Mode Toggle */}
					<div className="flex items-center bg-muted/60 p-0.5 rounded-lg border">
						<button
							type="button"
							onClick={() => setMode("both")}
							className={`px-2 py-1 rounded-md transition-colors ${
								mode === "both"
									? "bg-background text-foreground shadow-sm font-medium"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							All
						</button>
						<button
							type="button"
							onClick={() => setMode("names")}
							className={`px-2 py-1 rounded-md transition-colors ${
								mode === "names"
									? "bg-background text-foreground shadow-sm font-medium"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Names
						</button>
						<button
							type="button"
							onClick={() => setMode("contents")}
							className={`px-2 py-1 rounded-md transition-colors ${
								mode === "contents"
									? "bg-background text-foreground shadow-sm font-medium"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Contents
						</button>
					</div>

					{/* Type Filter */}
					<div className="flex items-center bg-muted/60 p-0.5 rounded-lg border">
						<button
							type="button"
							onClick={() => setFilterType("all")}
							className={`px-2 py-1 rounded-md transition-colors ${
								filterType === "all"
									? "bg-background text-foreground shadow-sm font-medium"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							All Types
						</button>
						<button
							type="button"
							onClick={() => setFilterType("files")}
							className={`px-2 py-1 rounded-md transition-colors ${
								filterType === "files"
									? "bg-background text-foreground shadow-sm font-medium"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Files
						</button>
						<button
							type="button"
							onClick={() => setFilterType("folders")}
							className={`px-2 py-1 rounded-md transition-colors ${
								filterType === "folders"
									? "bg-background text-foreground shadow-sm font-medium"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Folders
						</button>
					</div>

					{/* Category Dropdown */}
					<select
						value={filterCategory}
						onChange={(e) => setFilterCategory(e.target.value)}
						className="h-7 px-2 text-xs rounded-md bg-muted/60 border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					>
						<option value="all">All Categories</option>
						<option value="Images">Images</option>
						<option value="Video">Video</option>
						<option value="Audio">Audio</option>
						<option value="Documents">Documents</option>
						<option value="Archives">Archives</option>
						<option value="Code">Code</option>
						<option value="Apps & Executables">Apps &amp; Executables</option>
						<option value="Other">Other</option>
					</select>
				</div>

				{/* Results Stats & Layout Toggle */}
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2 text-muted-foreground">
						{isSearching ? (
							<span className="flex items-center gap-1.5 text-primary">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Searching...
							</span>
						) : hits.length > 0 ? (
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
							onClick={() => handleSetViewMode("list")}
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
							onClick={() => handleSetViewMode("cards")}
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
				{!query.trim() ? (
					isIndexEmpty ? (
						/* Empty State when no query is typed and index not built yet */
						<div className="h-full flex items-center justify-center p-6">
							<Card className="max-w-lg w-full text-center border-dashed">
								<CardContent className="pt-8 pb-8 px-6 space-y-4">
									<div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
										<FolderSearch className="h-6 w-6" />
									</div>
									<div>
										<h3 className="text-lg font-bold">Search Across Your Computer</h3>
										<p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
											Live disk search is active. Type any file name or keyword above and find any file across your computer immediately!
										</p>
										<p className="text-xs text-muted-foreground mt-2 leading-relaxed">
											Default folders (User profile &amp; drives) are automatically searched, while ignore folders like node_modules and .git are skipped.
										</p>
									</div>
									<div className="pt-2">
										<Button
											onClick={() => onStartIndexing(false)}
											className="w-full gap-2 shadow-sm"
										>
											<Sparkles className="h-4 w-4" />
											Build Background Index
										</Button>
									</div>
									<p className="text-[11px] text-muted-foreground">
										Index runs in the background at low priority so it never slows down your PC.
									</p>
								</CardContent>
							</Card>
						</div>
					) : (
						/* Ready to search (prompt to type) */
						<div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
							<FolderSearch className="h-12 w-12 stroke-[1.25] text-muted-foreground/40 mb-3" />
							<h4 className="text-sm font-semibold text-foreground">
								Search files and text content
							</h4>
							<p className="text-xs max-w-sm mt-1">
								Type to search by name or file contents across{" "}
								{status?.docCount.toLocaleString() ?? "all"} indexed items + live disk search.
							</p>
							<div className="flex flex-wrap justify-center gap-1.5 mt-4 text-[11px] font-mono">
								<span className="px-2 py-0.5 rounded bg-muted">ext:png</span>
								<span className="px-2 py-0.5 rounded bg-muted">
									&quot;exact phrase&quot;
								</span>
								<span className="px-2 py-0.5 rounded bg-muted">ChatGPT Image</span>
							</div>
						</div>
					)
				) : hits.length === 0 && !isSearching ? (
					/* No Results Found */
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
									{scope === "folder" ? " in the current folder." : " across your computer."}
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
				) : hits.length === 0 && isSearching ? (
					/* First search loading spinner */
					<div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
						<Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
						<p className="text-xs">Searching disk and index for &ldquo;{query}&rdquo;...</p>
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
										onDoubleClick={() => {
											if (hit.isDir && onAnalyzeFolder) {
												onAnalyzeFolder(hit.path);
											} else {
												handleOpen(hit.path);
											}
										}}
										className={`group px-3 py-2 rounded-lg border transition-colors cursor-pointer flex flex-col gap-1.5 mb-1.5 ${
											isSelected
												? "bg-accent/70 border-primary/40 shadow-sm"
												: "bg-card hover:bg-muted/50 border-border/60"
										}`}
									>
										<div className="flex items-center justify-between gap-3">
											{/* Icon + Highlighted Name */}
											<div className="flex items-center gap-2.5 min-w-0 flex-1">
												{hit.isDir ? (
													<Folder className="h-4 w-4 text-amber-500 shrink-0" />
												) : (
													<FileText className="h-4 w-4 text-blue-500 shrink-0" />
												)}
												<span className="font-medium text-xs truncate text-foreground">
													<HighlightedText
														text={hit.name}
														ranges={hit.matchedNameRanges}
													/>
												</span>
												<Badge
													variant="outline"
													className="text-[10px] py-0 px-1.5 h-4 font-normal text-muted-foreground shrink-0"
												>
													{hit.category}
												</Badge>
											</div>

											{/* Size + Date + Quick Actions */}
											<div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
												{!hit.isDir && (
													<span className="font-mono">
														{formatBytes(hit.sizeBytes)}
													</span>
												)}
												{hit.modified && (
													<span>
														{new Date(hit.modified).toLocaleDateString()}
													</span>
												)}

												{/* Row Hover Actions */}
												<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
													<Button
														size="icon"
														variant="ghost"
														className="h-6 w-6"
														onClick={(e) => {
															e.stopPropagation();
															handleOpen(hit.path);
														}}
														title="Open item"
													>
														<ExternalLink className="h-3 w-3" />
													</Button>
													<Button
														size="icon"
														variant="ghost"
														className="h-6 w-6"
														onClick={(e) => {
															e.stopPropagation();
															handleReveal(hit.path);
														}}
														title="Reveal in File Explorer"
													>
														<FolderOpen className="h-3 w-3" />
													</Button>
													<Button
														size="icon"
														variant="ghost"
														className="h-6 w-6"
														onClick={(e) => {
															e.stopPropagation();
															handleCopyPath(hit.path);
														}}
														title="Copy path"
													>
														<Copy className="h-3 w-3" />
													</Button>
													{hit.isDir && onAnalyzeFolder && (
														<Button
															size="icon"
															variant="ghost"
															className="h-6 w-6 text-primary"
															onClick={(e) => {
																e.stopPropagation();
																onAnalyzeFolder(hit.path);
															}}
															title="Analyze folder in Tree View"
														>
															<BarChart3 className="h-3 w-3" />
														</Button>
													)}
												</div>
											</div>
										</div>

										{/* Truncated File Path */}
										<div className="text-[11px] text-muted-foreground/80 truncate font-mono pl-6">
											{hit.path}
										</div>

										{/* Content Snippet (if available) */}
										{hit.snippet && (
											<div className="text-xs bg-muted/40 p-2 rounded border border-border/40 text-foreground/90 font-mono mt-0.5 ml-6">
												<SnippetText
													text={hit.snippet.text}
													highlights={hit.snippet.highlights}
												/>
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				) : (
					/* State 4B: Cards Grid View */
					<div
						ref={cardsContainerRef}
						className="h-full overflow-y-auto pr-1 pb-4 select-none"
					>
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
							{hits.map((hit, index) => {
								const isSelected = selectedIndex === index;

								return (
									<Card
										key={hit.path}
										onClick={() => setSelectedIndex(index)}
										onDoubleClick={() => {
											if (hit.isDir && onAnalyzeFolder) {
												onAnalyzeFolder(hit.path);
											} else {
												handleOpen(hit.path);
											}
										}}
										className={`group flex flex-col justify-between transition-all duration-150 cursor-pointer overflow-hidden border ${
											isSelected
												? "border-primary shadow-sm bg-accent/40"
												: "bg-card hover:bg-muted/40 hover:border-border/80"
										}`}
									>
										<CardContent className="p-3 flex flex-col gap-2 flex-1">
											{/* Top Row: Icon + Category Badge */}
											<div className="flex items-center justify-between gap-1.5">
												<div className="flex items-center gap-1.5 min-w-0">
													{hit.isDir ? (
														<Folder className="h-4 w-4 text-amber-500 shrink-0" />
													) : (
														<FileText className="h-4 w-4 text-blue-500 shrink-0" />
													)}
													<Badge
														variant="outline"
														className="text-[9px] py-0 px-1 h-3.5 font-normal text-muted-foreground shrink-0"
													>
														{hit.category}
													</Badge>
												</div>

												{!hit.isDir && (
													<span className="text-[10px] font-mono text-muted-foreground shrink-0">
														{formatBytes(hit.sizeBytes)}
													</span>
												)}
											</div>

											{/* Filename with Highlight */}
											<div
												className="font-medium text-xs text-foreground line-clamp-2 leading-snug break-words"
												title={hit.name}
											>
												<HighlightedText
													text={hit.name}
													ranges={hit.matchedNameRanges}
												/>
											</div>

											{/* Truncated Path */}
											<div
												className="text-[10px] text-muted-foreground/75 font-mono line-clamp-1 break-all"
												title={hit.path}
											>
												{hit.path}
											</div>

											{/* Content Snippet (if available) */}
											{hit.snippet && (
												<div className="text-[11px] bg-muted/40 p-1.5 rounded border border-border/40 text-foreground/80 font-mono line-clamp-2 leading-tight">
													<SnippetText
														text={hit.snippet.text}
														highlights={hit.snippet.highlights}
													/>
												</div>
											)}
										</CardContent>

										{/* Card Footer: Date & Action Icons */}
										<div className="px-3 py-1.5 bg-muted/20 border-t flex items-center justify-between text-[10px] text-muted-foreground">
											<div className="flex items-center gap-1">
												{hit.modified ? (
													<>
														<Calendar className="h-3 w-3 shrink-0 opacity-70" />
														<span>
															{new Date(hit.modified).toLocaleDateString()}
														</span>
													</>
												) : (
													<span>-</span>
												)}
											</div>

											{/* Action Toolbar */}
											<div className="flex items-center gap-0.5">
												<Button
													size="icon"
													variant="ghost"
													className="h-5 w-5 text-muted-foreground hover:text-foreground"
													onClick={(e) => {
														e.stopPropagation();
														handleOpen(hit.path);
													}}
													title="Open item"
												>
													<ExternalLink className="h-2.5 w-2.5" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													className="h-5 w-5 text-muted-foreground hover:text-foreground"
													onClick={(e) => {
														e.stopPropagation();
														handleReveal(hit.path);
													}}
													title="Reveal in File Explorer"
												>
													<FolderOpen className="h-2.5 w-2.5" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													className="h-5 w-5 text-muted-foreground hover:text-foreground"
													onClick={(e) => {
														e.stopPropagation();
														handleCopyPath(hit.path);
													}}
													title="Copy path"
												>
													<Copy className="h-2.5 w-2.5" />
												</Button>
												{hit.isDir && onAnalyzeFolder && (
													<Button
														size="icon"
														variant="ghost"
														className="h-5 w-5 text-primary hover:text-primary"
														onClick={(e) => {
															e.stopPropagation();
															onAnalyzeFolder(hit.path);
														}}
														title="Analyze folder in Tree View"
													>
														<BarChart3 className="h-2.5 w-2.5" />
													</Button>
												)}
											</div>
										</div>
									</Card>
								);
							})}
						</div>

						{/* Infinite Scroll Loader for Cards */}
						{isLoadingMore && (
							<div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin text-primary" />
								Loading more results...
							</div>
						)}
					</div>
				)}
			</div>

			{/* Bottom Status & Key Hints Bar */}
			<div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
				<div className="flex items-center gap-4">
					<span>
						<strong>{hits.length}</strong> of{" "}
						<strong>{total.toLocaleString()}</strong> results loaded
					</span>
					{status && (
						<span className="hidden sm:inline">
							Index: <strong>{status.docCount.toLocaleString()}</strong> items (
							{formatBytes(status.sizeBytes)})
						</span>
					)}
				</div>

				<div className="hidden md:flex items-center gap-3">
					<span className="flex items-center gap-1">
						<kbd className="px-1 py-0.5 rounded bg-muted border font-mono text-[9px]">
							&uarr;&darr;
						</kbd>{" "}
						Navigate
					</span>
					<span className="flex items-center gap-1">
						<kbd className="px-1 py-0.5 rounded bg-muted border font-mono text-[9px]">
							Enter
						</kbd>{" "}
						Open / Analyze
					</span>
					<span className="flex items-center gap-1">
						<kbd className="px-1 py-0.5 rounded bg-muted border font-mono text-[9px]">
							Esc
						</kbd>{" "}
						Clear
					</span>
				</div>
			</div>
		</div>
	);
}

/// Helper component to highlight matched ranges in file name
function HighlightedText({
	text,
	ranges,
}: {
	text: string;
	ranges: [number, number][];
}) {
	if (!ranges || ranges.length === 0) {
		return <>{text}</>;
	}

	const elements: React.ReactNode[] = [];
	let lastIndex = 0;

	for (let i = 0; i < ranges.length; i++) {
		const [start, end] = ranges[i];

		// Text before highlight
		if (start > lastIndex) {
			elements.push(
				<span key={`unmatched-${lastIndex}`}>
					{text.slice(lastIndex, start)}
				</span>
			);
		}

		// Highlighted portion
		elements.push(
			<mark
				key={`match-${start}-${end}`}
				className="bg-amber-400/35 dark:bg-amber-500/30 text-foreground font-semibold rounded-xs px-0.5"
			>
				{text.slice(start, end)}
			</mark>
		);

		lastIndex = end;
	}

	// Remaining text
	if (lastIndex < text.length) {
		elements.push(
			<span key={`unmatched-${lastIndex}`}>{text.slice(lastIndex)}</span>
		);
	}

	return <>{elements}</>;
}

/// Helper component to render snippet text with highlighted ranges
function SnippetText({
	text,
	highlights,
}: {
	text: string;
	highlights: [number, number][];
}) {
	if (!highlights || highlights.length === 0) {
		return <>{text}</>;
	}

	const elements: React.ReactNode[] = [];
	let lastIndex = 0;

	for (let i = 0; i < highlights.length; i++) {
		const [start, end] = highlights[i];

		if (start > lastIndex) {
			elements.push(
				<span key={`snip-unmatched-${lastIndex}`}>
					{text.slice(lastIndex, start)}
				</span>
			);
		}

		elements.push(
			<mark
				key={`snip-match-${start}-${end}`}
				className="bg-yellow-400/40 dark:bg-yellow-500/40 text-foreground font-medium rounded-xs px-0.5"
			>
				{text.slice(start, end)}
			</mark>
		);

		lastIndex = end;
	}

	if (lastIndex < text.length) {
		elements.push(
			<span key={`snip-unmatched-${lastIndex}`}>{text.slice(lastIndex)}</span>
		);
	}

	return <>{elements}</>;
}
