export interface SnippetResult {
  text: string;
  highlights: [number, number][];
}

export interface SearchHit {
  name: string;
  path: string;
  isDir: boolean;
  sizeBytes: number;
  modified: number | null;
  category: string;
  snippet: SnippetResult | null;
  matchedNameRanges: [number, number][];
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  tookMs: number;
}

export type SearchStreamEvent =
  | {
      type: 'batch';
      hits: SearchHit[];
      total: number;
      tookMs: number;
    }
  | {
      type: 'done';
      total: number;
      tookMs: number;
    };

export type SearchSortOption =
  | 'score'
  | 'size_desc'
  | 'size_asc'
  | 'date_desc'
  | 'date_asc'
  | 'name_asc'
  | 'name_desc';

export interface SearchParams extends Record<string, unknown> {
  query: string;
  scope: 'computer' | 'folder';
  currentPath?: string;
  mode: 'both' | 'names' | 'contents';
  filterType?: 'all' | 'files' | 'folders';
  filterCategory?: string;
  extensions?: string[];
  modifiedFrom?: number;
  modifiedTo?: number;
  sortBy?: SearchSortOption;
  limit?: number;
  offset?: number;
}

export interface IndexStatus {
  docCount: number;
  sizeBytes: number;
  lastUpdated: number | null;
  isIndexing: boolean;
  isPaused: boolean;
  indexedFolders?: string[];
}

export interface IndexRoot {
  path: string;
  indexContent: boolean;
}

export interface SearchSettings {
  roots: IndexRoot[];
  exclusions: string[];
  maxContentSizeMb: number;
  writerMemoryBudgetMb: number;
  contentExtensions: string[];
  searchBatchSize: number;
  autoRebuildIndex?: boolean;
}

export type IndexEvent =
  | { type: 'started' }
  | {
      type: 'progress';
      filesSeen: number;
      filesIndexed: number;
      contentIndexed: number;
      skipped: number;
      currentPath: string;
    }
  | {
      type: 'finished';
      totalDocs: number;
      elapsedMs: number;
    }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };
