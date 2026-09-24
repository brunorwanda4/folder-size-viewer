import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Pause, Play, X, Loader2 } from 'lucide-react';
import type { IndexStatus } from '@/types/search';

interface IndexingStatusBarProps {
  status: IndexStatus | null;
  activeProgress: {
    filesSeen: number;
    filesIndexed: number;
    contentIndexed: number;
    skipped: number;
    currentPath: string;
  } | null;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

export function IndexingStatusBar({
  status,
  activeProgress,
  isPaused,
  onPause,
  onResume,
  onCancel,
}: IndexingStatusBarProps) {
  if (!status?.isIndexing) {
    return null;
  }

  const filesIndexed = activeProgress?.filesIndexed ?? 0;
  const contentIndexed = activeProgress?.contentIndexed ?? 0;
  const currentPath = activeProgress?.currentPath ?? 'Scanning...';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 py-2 shadow-lg transition-all animate-in slide-in-from-bottom-2">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Loader2 className={`h-3.5 w-3.5 text-primary shrink-0 ${isPaused ? '' : 'animate-spin'}`} />
          <div className="font-medium text-foreground shrink-0">
            {isPaused ? (
              <span className="text-amber-500 font-semibold">Indexing Paused</span>
            ) : (
              <span>Indexing files...</span>
            )}
          </div>
          <span className="text-muted-foreground shrink-0">
            ({filesIndexed.toLocaleString()} files
            {contentIndexed > 0 && `, ${contentIndexed.toLocaleString()} content`})
          </span>
          <span className="text-muted-foreground/60 truncate font-mono hidden md:inline" title={currentPath}>
            — {currentPath}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isPaused ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onResume}
              className="h-7 text-xs px-2.5 gap-1.5 border-amber-500/50 hover:bg-amber-500/10"
            >
              <Play className="h-3 w-3 fill-current" />
              Resume
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onPause}
              className="h-7 text-xs px-2.5 gap-1.5"
            >
              <Pause className="h-3 w-3" />
              Pause
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive gap-1"
          >
            <X className="h-3 w-3" />
            Cancel
          </Button>
        </div>
      </div>
      <Progress value={undefined} className="h-0.5 mt-1.5 bg-muted" />
    </div>
  );
}
