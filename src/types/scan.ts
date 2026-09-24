export interface FolderChildEntry {
  name: string;
  path: string;
  isDir: boolean;
  sizeBytes: number;
  fileCount: number;
  modified: number | null;
  error?: string | null;
}

export type ScanEvent =
  | { type: "started"; totalChildren: number }
  | { type: "childDone"; entry: FolderChildEntry }
  | { type: "finished"; totalSize: number; elapsedMs: number; skippedCount: number }
  | { type: "cancelled" }
  | { type: "error"; message: string };

export interface ScanResult {
  path: string;
  totalSize: number;
  elapsedMs: number;
  skippedCount: number;
  entries: FolderChildEntry[];
}

export interface DefaultPaths {
  localAppData?: string | null;
  appData?: string | null;
  temp?: string | null;
  home?: string | null;
  downloads?: string | null;
}

export interface ScanSummary {
  totalSize: number;
  totalChildren: number;
  elapsedMs: number;
  skippedCount: number;
}

export type ScanStatus = "idle" | "scanning" | "done" | "error";

export type SortField = "size" | "name" | "modified";
export type SortOrder = "asc" | "desc";
export type ItemTypeFilter = "all" | "folders" | "files";
