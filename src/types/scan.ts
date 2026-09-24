export interface CategoryStat {
  bytes: number;
  files: number;
}

export interface FolderChildEntry {
  name: string;
  path: string;
  isDir: boolean;
  sizeBytes: number;
  fileCount: number;
  modified: number | null;
  error?: string | null;
  categories?: Record<string, CategoryStat>;
}

export type ScanEvent =
  | { type: "started"; totalChildren: number }
  | { type: "childDone"; entry: FolderChildEntry }
  | {
      type: "finished";
      totalSize: number;
      elapsedMs: number;
      skippedCount: number;
      categories: Record<string, CategoryStat>;
    }
  | { type: "cancelled" }
  | { type: "error"; message: string };

export interface ScanResult {
  path: string;
  totalSize: number;
  elapsedMs: number;
  skippedCount: number;
  entries: FolderChildEntry[];
  categories: Record<string, CategoryStat>;
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
  categories?: Record<string, CategoryStat>;
}

export type ScanStatus = "idle" | "scanning" | "done" | "error";

export type SortField = "size" | "name" | "modified";
export type SortOrder = "asc" | "desc";
export type ItemTypeFilter = "all" | "folders" | "files";
export type ViewMode = "table" | "cards";
