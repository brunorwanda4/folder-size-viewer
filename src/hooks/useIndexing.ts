import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type { IndexStatus, IndexEvent } from '@/types/search';

export function useIndexing() {
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [activeProgress, setActiveProgress] = useState<{
    filesSeen: number;
    filesIndexed: number;
    contentIndexed: number;
    skipped: number;
    currentPath: string;
  } | null>(null);

  const isIndexing = status?.isIndexing ?? false;
  const isPaused = status?.isPaused ?? false;
  const isMounted = useRef(true);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await invoke<IndexStatus>('get_index_status');
      if (isMounted.current) {
        setStatus(s);
        if (!s.isIndexing) {
          setActiveProgress(null);
        }
      }
    } catch (err) {
      console.error('Failed to get index status:', err);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    refreshStatus();
    const interval = setInterval(refreshStatus, 3000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [refreshStatus]);

  const startIndexing = useCallback(
    async (rebuild: boolean = false) => {
      try {
        setStatus((prev) => (prev ? { ...prev, isIndexing: true, isPaused: false } : null));

        const channel = new Channel<IndexEvent>();
        channel.onmessage = (event) => {
          if (!isMounted.current) return;

          switch (event.type) {
            case 'started':
              setStatus((prev) => (prev ? { ...prev, isIndexing: true, isPaused: false } : null));
              break;
            case 'progress':
              setActiveProgress({
                filesSeen: event.filesSeen,
                filesIndexed: event.filesIndexed,
                contentIndexed: event.contentIndexed,
                skipped: event.skipped,
                currentPath: event.currentPath,
              });
              break;
            case 'finished':
              setStatus((prev) => (prev ? { ...prev, isIndexing: false, isPaused: false } : null));
              setActiveProgress(null);
              toast.success(
                rebuild ? 'Search index rebuilt successfully' : 'Search index updated',
                {
                  description: `${event.totalDocs.toLocaleString()} files indexed in ${(
                    event.elapsedMs / 1000
                  ).toFixed(1)}s`,
                }
              );
              refreshStatus();
              break;
            case 'cancelled':
              setStatus((prev) => (prev ? { ...prev, isIndexing: false, isPaused: false } : null));
              setActiveProgress(null);
              toast.info('Search indexing cancelled');
              refreshStatus();
              break;
            case 'error':
              setStatus((prev) => (prev ? { ...prev, isIndexing: false, isPaused: false } : null));
              setActiveProgress(null);
              toast.error('Search indexing failed', {
                description: event.message,
              });
              refreshStatus();
              break;
          }
        };

        await invoke('start_indexing', {
          rebuild,
          onEvent: channel,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error('Could not start indexing', { description: msg });
        refreshStatus();
      }
    },
    [refreshStatus]
  );

  const pauseIndexing = useCallback(async () => {
    try {
      await invoke('pause_indexing');
      setStatus((prev) => (prev ? { ...prev, isPaused: true } : null));
    } catch (err) {
      console.error('Failed to pause indexing:', err);
    }
  }, []);

  const resumeIndexing = useCallback(async () => {
    try {
      await invoke('resume_indexing');
      setStatus((prev) => (prev ? { ...prev, isPaused: false } : null));
    } catch (err) {
      console.error('Failed to resume indexing:', err);
    }
  }, []);

  const cancelIndexing = useCallback(async () => {
    try {
      await invoke('cancel_indexing');
      setStatus((prev) => (prev ? { ...prev, isIndexing: false, isPaused: false } : null));
      setActiveProgress(null);
    } catch (err) {
      console.error('Failed to cancel indexing:', err);
    }
  }, []);

  const clearIndex = useCallback(async () => {
    try {
      await invoke('clear_index');
      toast.success('Search index cleared');
      await refreshStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to clear index', { description: msg });
    }
  }, [refreshStatus]);

  return {
    status,
    activeProgress,
    isIndexing,
    isPaused,
    startIndexing,
    pauseIndexing,
    resumeIndexing,
    cancelIndexing,
    clearIndex,
    refreshStatus,
  };
}
