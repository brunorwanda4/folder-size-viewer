import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  FolderPlus,
  Trash2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  HardDrive,
  FileText,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/format';
import type { SearchSettings, IndexStatus } from '@/types/search';

interface SearchSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: IndexStatus | null;
  isIndexing: boolean;
  onStartIndexing: (rebuild?: boolean) => void;
  onClearIndex: () => void;
  onRefreshStatus: () => void;
}

export function SearchSettingsSheet({
  open,
  onOpenChange,
  status,
  isIndexing,
  onStartIndexing,
  onClearIndex,
  onRefreshStatus,
}: SearchSettingsSheetProps) {
  const [settings, setSettings] = useState<SearchSettings | null>(null);
  const [newExclusion, setNewExclusion] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const s = await invoke<SearchSettings>('get_search_settings');
      setSettings(s);
    } catch (err) {
      console.error('Failed to load search settings:', err);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadSettings();
      onRefreshStatus();
    }
  }, [open, loadSettings, onRefreshStatus]);

  const saveSettings = async (newSettings: SearchSettings) => {
    setSettings(newSettings);
    try {
      await invoke('save_search_settings', { settings: newSettings });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to save settings', { description: msg });
    }
  };

  const handleAddFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select Folder to Index',
      });

      if (!selected || typeof selected !== 'string' || !settings) return;

      if (settings.roots.some((r) => r.path.toLowerCase() === selected.toLowerCase())) {
        toast.info('Folder is already in the index list');
        return;
      }

      const updated: SearchSettings = {
        ...settings,
        roots: [...settings.roots, { path: selected, indexContent: true }],
      };
      await saveSettings(updated);
      toast.success('Folder added to search index');
    } catch (err) {
      console.error('Failed to pick folder:', err);
    }
  };

  const handleRemoveFolder = async (pathToRemove: string) => {
    if (!settings) return;
    const updated: SearchSettings = {
      ...settings,
      roots: settings.roots.filter((r) => r.path !== pathToRemove),
    };
    await saveSettings(updated);
  };

  const handleToggleContent = async (path: string, checked: boolean) => {
    if (!settings) return;
    const updated: SearchSettings = {
      ...settings,
      roots: settings.roots.map((r) =>
        r.path === path ? { ...r, indexContent: checked } : r
      ),
    };
    await saveSettings(updated);
  };

  const handleAddExclusion = async () => {
    const val = newExclusion.trim();
    if (!val || !settings) return;

    if (settings.exclusions.includes(val)) {
      setNewExclusion('');
      return;
    }

    const updated: SearchSettings = {
      ...settings,
      exclusions: [...settings.exclusions, val],
    };
    await saveSettings(updated);
    setNewExclusion('');
  };

  const handleRemoveExclusion = async (valToRemove: string) => {
    if (!settings) return;
    const updated: SearchSettings = {
      ...settings,
      exclusions: settings.exclusions.filter((e) => e !== valToRemove),
    };
    await saveSettings(updated);
  };

  const handleMaxContentSizeChange = async (mb: number) => {
    if (!settings || isNaN(mb) || mb < 1) return;
    const updated: SearchSettings = {
      ...settings,
      maxContentSizeMb: mb,
    };
    await saveSettings(updated);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-bold flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            Search & Index Settings
          </SheetTitle>
          <SheetDescription>
            Configure index roots, file content indexing, and exclusions.
          </SheetDescription>
        </SheetHeader>

        {/* Index Stats Card */}
        <Card className="mb-6 bg-muted/40 border-muted">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Indexed Files
                </div>
                <div className="text-lg font-semibold mt-1">
                  {status ? status.docCount.toLocaleString() : '0'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Index Size
                </div>
                <div className="text-lg font-semibold mt-1">
                  {status ? formatBytes(status.sizeBytes) : '0 B'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Last Updated
                </div>
                <div className="text-sm font-medium mt-1 truncate">
                  {status?.lastUpdated ? formatDate(status.lastUpdated) : 'Never'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Index Actions */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Button
            size="sm"
            onClick={() => onStartIndexing(false)}
            disabled={isIndexing}
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isIndexing ? 'animate-spin' : ''}`} />
            Update Now
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onStartIndexing(true)}
            disabled={isIndexing}
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Rebuild Index
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={isIndexing}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Clear Search Index?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the Tantivy search index from your disk. You will need to
                  rebuild the index to search across files and content again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onClearIndex}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear Index
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Indexed Folders Section */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              Indexed Locations
            </h3>
            <Button size="sm" variant="outline" onClick={handleAddFolder} className="h-8">
              <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
              Add Folder
            </Button>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {settings?.roots.map((root) => (
              <div
                key={root.path}
                className="flex items-center justify-between p-2.5 rounded-md border bg-card text-xs gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate font-mono text-foreground" title={root.path}>
                    {root.path}
                  </div>
                  <label className="flex items-center gap-1.5 mt-1.5 text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={root.indexContent}
                      onChange={(e) => handleToggleContent(root.path, e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>Index file contents</span>
                  </label>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleRemoveFolder(root.path)}
                  title="Remove folder"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            {(!settings || settings.roots.length === 0) && (
              <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-md">
                No indexed locations configured. Click &ldquo;Add Folder&rdquo; above.
              </div>
            )}
          </div>
        </div>

        {/* Exclusions Editor */}
        <div className="space-y-4 mb-6">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Excluded Folder Names
          </h3>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. node_modules, .git, target..."
              value={newExclusion}
              onChange={(e) => setNewExclusion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddExclusion();
                }
              }}
              className="h-8 text-xs font-mono"
            />
            <Button size="sm" onClick={handleAddExclusion} className="h-8 shrink-0">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 border rounded-md bg-muted/20">
            {settings?.exclusions.map((ex) => (
              <Badge
                key={ex}
                variant="secondary"
                className="text-xs font-mono py-0.5 px-2 flex items-center gap-1"
              >
                {ex}
                <button
                  type="button"
                  onClick={() => handleRemoveExclusion(ex)}
                  className="hover:text-destructive ml-0.5"
                  title="Remove exclusion"
                >
                  &times;
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Max content file size */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="max-content-size" className="font-semibold text-foreground">
              Max Content File Size (MB)
            </label>
            <span className="text-muted-foreground">Files above this size will only index names</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="max-content-size"
              type="number"
              min={1}
              max={100}
              value={settings?.maxContentSizeMb ?? 2}
              onChange={(e) => handleMaxContentSizeChange(parseInt(e.target.value, 10))}
              className="h-8 w-24 text-xs"
            />
            <span className="text-xs text-muted-foreground">MB (default 2 MB)</span>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 dark:text-emerald-200 text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Privacy First</div>
            <div className="text-[11px] opacity-90 mt-0.5">
              Everything stays on this computer. The Tantivy search index is stored locally in
              your application data directory and never connects to any external server.
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
