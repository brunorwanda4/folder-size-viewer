import { useState, useEffect, useCallback, KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Search, Square, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DefaultPaths, ScanStatus } from "@/types/scan";

interface PathInputCardProps {
  currentPath: string;
  scanState: ScanStatus;
  onScan: (path: string) => void;
  onCancel: () => void;
}

const STORAGE_KEY = "folder-size-viewer:last-path";

export function PathInputCard({
  currentPath,
  scanState,
  onScan,
  onCancel,
}: PathInputCardProps) {
  const [pathInput, setPathInput] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || "";
  });
  const [defaultPaths, setDefaultPaths] = useState<DefaultPaths | null>(null);

  // Sync external path changes (e.g. drill-down navigation)
  useEffect(() => {
    if (currentPath) {
      setPathInput(currentPath);
      localStorage.setItem(STORAGE_KEY, currentPath);
    }
  }, [currentPath]);

  // Load shortcuts on mount
  useEffect(() => {
    invoke<DefaultPaths>("get_default_paths")
      .then((paths) => setDefaultPaths(paths))
      .catch((err) => console.warn("Failed to get default paths:", err));
  }, []);

  const handleScan = useCallback(() => {
    const trimmed = pathInput.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    onScan(trimmed);
  }, [pathInput, onScan]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && scanState !== "scanning") {
      e.preventDefault();
      handleScan();
    }
  };

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Folder to Scan",
        defaultPath: pathInput || undefined,
      });

      if (selected && typeof selected === "string") {
        setPathInput(selected);
        localStorage.setItem(STORAGE_KEY, selected);
        onScan(selected);
      }
    } catch (err) {
      console.error("Browse directory dialog error:", err);
    }
  };

  const selectShortcut = (path: string | undefined | null) => {
    if (!path) return;
    setPathInput(path);
    localStorage.setItem(STORAGE_KEY, path);
    onScan(path);
  };

  const isScanning = scanState === "scanning";

  return (
    <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste folder path (e.g. C:\Users\Username\AppData\Local or %LOCALAPPDATA%)"
              className="pl-9 pr-3 h-10 font-mono text-sm bg-background/80"
              disabled={isScanning}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleBrowse}
              disabled={isScanning}
              className="gap-1.5 h-10 px-3.5"
            >
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span>Browse</span>
            </Button>

            {isScanning ? (
              <Button
                type="button"
                variant="destructive"
                size="default"
                onClick={onCancel}
                className="gap-1.5 h-10 px-4 animate-pulse"
              >
                <Square className="h-4 w-4 fill-current" />
                <span>Stop</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="default"
                onClick={handleScan}
                disabled={!pathInput.trim()}
                className="gap-1.5 h-10 px-5 font-semibold"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Scan</span>
              </Button>
            )}
          </div>
        </div>

        {/* Quick Access Shortcuts */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80 flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> Quick paths:
          </span>

          {defaultPaths?.localAppData && (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 transition-colors py-1 px-2 font-mono text-[11px]"
              onClick={() => selectShortcut(defaultPaths.localAppData)}
            >
              %LOCALAPPDATA%
            </Badge>
          )}

          {defaultPaths?.appData && (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 transition-colors py-1 px-2 font-mono text-[11px]"
              onClick={() => selectShortcut(defaultPaths.appData)}
            >
              %APPDATA%
            </Badge>
          )}

          {defaultPaths?.temp && (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 transition-colors py-1 px-2 font-mono text-[11px]"
              onClick={() => selectShortcut(defaultPaths.temp)}
            >
              %TEMP%
            </Badge>
          )}

          {defaultPaths?.home && (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 transition-colors py-1 px-2 font-mono text-[11px]"
              onClick={() => selectShortcut(defaultPaths.home)}
            >
              ~ (Home)
            </Badge>
          )}

          {defaultPaths?.downloads && (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 transition-colors py-1 px-2 font-mono text-[11px]"
              onClick={() => selectShortcut(defaultPaths.downloads)}
            >
              Downloads
            </Badge>
          )}

          {defaultPaths && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  More...
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Common Windows Locations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {defaultPaths.localAppData && (
                  <DropdownMenuItem onClick={() => selectShortcut(defaultPaths.localAppData)}>
                    Local AppData
                  </DropdownMenuItem>
                )}
                {defaultPaths.appData && (
                  <DropdownMenuItem onClick={() => selectShortcut(defaultPaths.appData)}>
                    Roaming AppData
                  </DropdownMenuItem>
                )}
                {defaultPaths.temp && (
                  <DropdownMenuItem onClick={() => selectShortcut(defaultPaths.temp)}>
                    Temp Directory
                  </DropdownMenuItem>
                )}
                {defaultPaths.downloads && (
                  <DropdownMenuItem onClick={() => selectShortcut(defaultPaths.downloads)}>
                    User Downloads
                  </DropdownMenuItem>
                )}
                {defaultPaths.home && (
                  <DropdownMenuItem onClick={() => selectShortcut(defaultPaths.home)}>
                    User Home Directory
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
