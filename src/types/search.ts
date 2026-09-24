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

export interface SearchParams extends Record<string, unknown> {
  query: string;
  scope: 'computer' | 'folder';
  currentPath?: string;
  mode: 'both' | 'names' | 'contents';
  filterType?: 'all' | 'files' | 'folders';
  filterCategory?: string;
  limit?: number;
  offset?: number;
}

export interface IndexStatus {
  docCount: number;
  sizeBytes: number;
  lastUpdated: number | null;
  isIndexing: boolean;
  isPaused: boolean;
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
