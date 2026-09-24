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

export type DeleteProgressEvent =
  | {
      type: "progress";
      deletedFiles: number;
      deletedBytes: number;
      filesLeft: number;
      bytesLeft: number;
      percentage: number;
      currentName: string;
      elapsedSeconds: number;
      estimatedSecondsLeft: number | null;
    }
  | {
      type: "finished";
      totalFiles: number;
      totalBytes: number;
      elapsedSeconds: number;
    };

export interface DeletionTask {
  id: string;
  name: string;
  path: string;
  isDir: boolean;
  totalSize: number;
  totalFiles: number;
  status: "deleting" | "done" | "error" | "cancelled";
  percentage: number;
  filesLeft: number;
  bytesLeft: number;
  elapsedSeconds: number;
  estimatedSecondsLeft: number | null;
  currentName: string;
  error?: string;
  isMinimized: boolean;
  startTime: number;
}

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
