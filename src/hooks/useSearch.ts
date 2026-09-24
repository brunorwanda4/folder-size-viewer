import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SearchHit, SearchResult, SearchParams } from '@/types/search';

const PAGE_SIZE = 50;

export function useSearch(currentFolderPath?: string) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'computer' | 'folder'>('computer');
  const [mode, setMode] = useState<'both' | 'names' | 'contents'>('both');
  const [filterType, setFilterType] = useState<'all' | 'files' | 'folders'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [tookMs, setTookMs] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request ID to ignore responses from stale queries
  const latestRequestId = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(
    async (
      q: string,
      sc: 'computer' | 'folder',
      m: 'both' | 'names' | 'contents',
      ft: 'all' | 'files' | 'folders',
      fc: string,
      offset: number = 0,
      append: boolean = false
    ) => {
      const cleanQuery = q.trim();
      if (!cleanQuery) {
        setHits([]);
        setTotal(0);
        setTookMs(0);
        setIsSearching(false);
        setIsLoadingMore(false);
        setError(null);
        return;
      }

      const reqId = ++latestRequestId.current;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsSearching(true);
      }
      setError(null);

      try {
        const params: SearchParams = {
          query: cleanQuery,
          scope: sc,
          currentPath: sc === 'folder' ? currentFolderPath : undefined,
          mode: m,
          filterType: ft === 'all' ? undefined : ft,
          filterCategory: fc === 'all' ? undefined : fc,
          limit: PAGE_SIZE,
          offset,
        };

        const res = await invoke<SearchResult>('search', params as unknown as Record<string, unknown>);

        // Discard if superseded by a newer query
        if (reqId !== latestRequestId.current) {
          return;
        }

        if (append) {
          setHits((prev) => [...prev, ...res.hits]);
        } else {
          setHits(res.hits);
        }
        setTotal(res.total);
        setTookMs(res.tookMs);
      } catch (err: unknown) {
        if (reqId === latestRequestId.current) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
        }
      } finally {
        if (reqId === latestRequestId.current) {
          setIsSearching(false);
          setIsLoadingMore(false);
        }
      }
    },
    [currentFolderPath]
  );

  // Trigger search when query or filters change (debounced 250ms for smooth typing)
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      performSearch(query, scope, mode, filterType, filterCategory, 0, false);
    }, 250);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, scope, mode, filterType, filterCategory, performSearch]);

  const loadMore = useCallback(() => {
    if (isSearching || isLoadingMore || hits.length >= total) {
      return;
    }
    performSearch(query, scope, mode, filterType, filterCategory, hits.length, true);
  }, [isSearching, isLoadingMore, hits.length, total, query, scope, mode, filterType, filterCategory, performSearch]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setHits([]);
    setTotal(0);
    setTookMs(0);
  }, []);

  return {
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
    error,
    loadMore,
    clearSearch,
  };
}
