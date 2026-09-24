import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import type { SearchHit, SearchStreamEvent } from '@/types/search';

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

  // Request ID to ignore events from stale queries
  const latestRequestId = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(
    async (
      q: string,
      sc: 'computer' | 'folder',
      m: 'both' | 'names' | 'contents',
      ft: 'all' | 'files' | 'folders',
      fc: string
    ) => {
      const cleanQuery = q.trim();
      if (!cleanQuery) {
        setHits([]);
        setTotal(0);
        setTookMs(0);
        setIsSearching(false);
        setIsLoadingMore(false);
        setError(null);
        invoke('cancel_search').catch(() => {});
        return;
      }

      const reqId = ++latestRequestId.current;
      invoke('cancel_search').catch(() => {});

      setIsSearching(true);
      setError(null);

      // Create Tauri IPC streaming channel
      const onEvent = new Channel<SearchStreamEvent>();
      onEvent.onmessage = (event) => {
        if (latestRequestId.current !== reqId) return;

        if (event.type === 'batch') {
          setHits((prev) => [...prev, ...event.hits]);
          setTotal(event.total);
          setTookMs(event.tookMs);
        } else if (event.type === 'done') {
          setTotal(event.total);
          setTookMs(event.tookMs);
          setIsSearching(false);
          setIsLoadingMore(false);
        }
      };

      try {
        setHits([]);
        await invoke('stream_search', {
          query: cleanQuery,
          scope: sc,
          folderPath: sc === 'folder' ? currentFolderPath : undefined,
          mode: m,
          filterType: ft,
          category: fc !== 'all' ? fc : undefined,
          onEvent,
        });
      } catch (err: unknown) {
        if (latestRequestId.current === reqId) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          setIsSearching(false);
        }
      }
    },
    [currentFolderPath]
  );

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      performSearch(query, scope, mode, filterType, filterCategory);
    }, 250);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, scope, mode, filterType, filterCategory, performSearch]);

  const loadMore = useCallback(() => {
    // Streaming search automatically searches and streams in the background
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setHits([]);
    setTotal(0);
    setTookMs(0);
    invoke('cancel_search').catch(() => {});
  }, []);

  const removeHit = useCallback((path: string) => {
    setHits((prev) => prev.filter((h) => h.path !== path));
    setTotal((prev) => Math.max(0, prev - 1));
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
    removeHit,
  };
}
