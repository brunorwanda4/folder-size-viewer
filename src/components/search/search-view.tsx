import { useVirtualizer } from "@tanstack/react-virtual";
import { invoke } from "@tauri-apps/api/core";
import {
	Copy,
	ExternalLink,
	Folder,
	FolderSearch,
	HardDrive,
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
	const listContainerRef = useRef<HTMLDivElement>(null);

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

	// Virtualizer setup
	const totalCount = hits.length + (hits.length < total ? 1 : 0);
	const rowVirtualizer = useVirtualizer({
		count: totalCount,
		getScrollElement: () => listContainerRef.current,
		estimateSize: (index) => {
			const hit = hits[index];
			// Snippets make the row taller
			return hit?.snippet ? 84 : 56;
		},
		overscan: 10,
	});

	// Scroll active item into view
	useEffect(() => {
		if (selectedIndex >= 0 && selectedIndex < hits.length) {
			rowVirtualizer.scrollToIndex(selectedIndex, { align: "auto" });
		}
	}, [selectedIndex, hits.length, rowVirtualizer]);

	// Load more items when scrolling near the end
	useEffect(() => {
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
		rowVirtualizer,
		hits.length,
		total,
		isSearching,
		isLoadingMore,
		loadMore,
	]);

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

				{/* Results summary & status */}
				<div className="flex items-center gap-2 text-muted-foreground shrink-0 ml-auto">
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
			</div>

			{/* Indexing In Progress Banner */}
			{status?.isIndexing && (
				<div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs">
					<div className="flex items-center gap-2">
						<Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
						<span>
							Search index is updating in the background. Search results may be
							incomplete until finished.
						</span>
					</div>
					<Button
						size="sm"
						variant="ghost"
						onClick={onOpenSettings}
						className="h-6 text-[11px] px-2 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
					>
						Details
					</Button>
				</div>
			)}

			{/* Main Results / Empty States Area */}
			<div className="flex-1 min-h-0 relative">
				{/* State 1: Index Not Built Yet */}
				{isIndexEmpty && !query ? (
					<div className="h-full flex items-center justify-center p-6">
						<Card className="max-w-md w-full text-center border-dashed">
							<CardContent className="pt-8 pb-8 px-6 space-y-4">
								<div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
									<Sparkles className="h-6 w-6" />
								</div>
								<div>
									<h3 className="text-lg font-bold">Fast Full-Text Search</h3>
									<p className="text-xs text-muted-foreground mt-1">
										Powered by Tantivy in Rust. Search your computer by file
										name and instant text search inside files. Everything is
										indexed locally.
									</p>
								</div>
								<div className="pt-2">
									<Button
										onClick={() => onStartIndexing(false)}
										className="w-full gap-2"
									>
										<HardDrive className="h-4 w-4" />
										Build Search Index
									</Button>
								</div>
								<p className="text-[11px] text-muted-foreground">
									Default locations: Windows fixed drives and user home folder.
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
							<span className="px-2 py-0.5 rounded bg-muted">ext:pdf</span>
							<span className="px-2 py-0.5 rounded bg-muted">
								&quot;exact phrase&quot;
							</span>
							<span className="px-2 py-0.5 rounded bg-muted">invoice 2024</span>
						</div>
					</div>
				) : hits.length === 0 && !isSearching ? (
					/* State 3: No Results Found */
					<div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
						<Search className="h-10 w-10 stroke-[1.25] text-muted-foreground/30 mb-2" />
						<h4 className="text-sm font-medium text-foreground">
							No matches found
						</h4>
						<p className="text-xs mt-1 max-w-sm">
							No files or content found for &ldquo;{query}&rdquo;
							{scope === "folder" ? " in the current folder." : "."}
						</p>
						{scope === "folder" && (
							<Button
								variant="link"
								size="sm"
								onClick={() => setScope("computer")}
								className="mt-2 text-xs"
							>
								Search whole computer instead
							</Button>
						)}
					</div>
				) : (
					/* State 4: Virtualized Results List */
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
												{/* Size & Date */}
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

										{/* Snippet for Content Match (with React highlighted spans, NO dangerouslySetInnerHTML) */}
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
