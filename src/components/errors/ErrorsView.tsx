import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileQuestion,
  Filter,
  HardDrive,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
  CornerDownRight,
} from "lucide-react";
import { useAppErrors, AppError } from "@/context/ErrorContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface ErrorsViewProps {
  onAnalyzePath?: (path: string) => void;
}

export function ErrorsView({ onAnalyzePath }: ErrorsViewProps) {
  const {
    errors,
    unresolvedCount,
    removeError,
    clearAllErrors,
    fixError,
    fixAllErrors,
    copyErrorDetails,
    copyAllErrors,
  } = useAppErrors();

  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unresolved" | "fixed">("all");
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [isFixingAll, setIsFixingAll] = useState(false);

  const filteredErrors = useMemo(() => {
    return errors.filter((err) => {
      if (sourceFilter !== "all" && err.source !== sourceFilter) {
        return false;
      }
      if (statusFilter === "unresolved" && err.fixed) {
        return false;
      }
      if (statusFilter === "fixed" && !err.fixed) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = err.title.toLowerCase().includes(q);
        const matchesMsg = err.message.toLowerCase().includes(q);
        const matchesPath = err.path ? err.path.toLowerCase().includes(q) : false;
        const matchesCode = err.errorCode ? err.errorCode.toLowerCase().includes(q) : false;
        return matchesTitle || matchesMsg || matchesPath || matchesCode;
      }
      return true;
    });
  }, [errors, sourceFilter, statusFilter, searchQuery]);

  const fixableCount = useMemo(() => {
    return errors.filter((e) => !e.fixed && e.path && e.source === "deletion").length;
  }, [errors]);

  const handleFixSingle = async (err: AppError) => {
    setFixingId(err.id);
    await fixError(err.id);
    setFixingId(null);
  };

  const handleFixAll = async () => {
    setIsFixingAll(true);
    await fixAllErrors();
    setIsFixingAll(false);
  };

  const handleCopyPath = (path?: string) => {
    if (!path) return;
    navigator.clipboard.writeText(path).then(
      () => toast.success("Path copied to clipboard"),
      () => toast.error("Failed to copy path")
    );
  };

  const handleReveal = async (path?: string) => {
    if (!path) return;
    try {
      await invoke("open_in_explorer", { path });
    } catch {
      try {
        await invoke("reveal_in_explorer", { path });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error("Failed to open Explorer", { description: msg });
      }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-4 max-w-6xl mx-auto w-full">
      {/* Header and Statistics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Error Log & Diagnostics
            {unresolvedCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {unresolvedCount} unresolved
              </Badge>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            View, investigate, and resolve file system, permission, and deletion errors.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={copyAllErrors}
            disabled={errors.length === 0}
            className="gap-1.5 h-8 text-xs"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy All Diagnostics</span>
          </Button>

          {fixableCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleFixAll}
              disabled={isFixingAll}
              className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isFixingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wrench className="w-3.5 h-3.5" />
              )}
              <span>Fix All Issues ({fixableCount})</span>
            </Button>
          )}

          {errors.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllErrors}
              className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Log</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-muted/30 p-2.5 rounded-xl border border-border/50">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter errors by path, message, or code..."
            className="pl-9 h-8 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1 border rounded-lg bg-background p-0.5">
            <Filter className="w-3 h-3 text-muted-foreground ml-1.5" />
            <button
              onClick={() => setSourceFilter("all")}
              className={`px-2 py-0.5 rounded-md font-medium text-xs ${
                sourceFilter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSourceFilter("deletion")}
              className={`px-2 py-0.5 rounded-md font-medium text-xs ${
                sourceFilter === "deletion" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Deletion
            </button>
            <button
              onClick={() => setSourceFilter("scan")}
              className={`px-2 py-0.5 rounded-md font-medium text-xs ${
                sourceFilter === "scan" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Scan
            </button>
          </div>

          <div className="flex items-center gap-1 border rounded-lg bg-background p-0.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-2 py-0.5 rounded-md font-medium text-xs ${
                statusFilter === "all" ? "bg-muted font-bold text-foreground" : "text-muted-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter("unresolved")}
              className={`px-2 py-0.5 rounded-md font-medium text-xs ${
                statusFilter === "unresolved" ? "bg-muted font-bold text-foreground" : "text-muted-foreground"
              }`}
            >
              Unresolved
            </button>
            <button
              onClick={() => setStatusFilter("fixed")}
              className={`px-2 py-0.5 rounded-md font-medium text-xs ${
                statusFilter === "fixed" ? "bg-muted font-bold text-foreground" : "text-muted-foreground"
              }`}
            >
              Fixed
            </button>
          </div>
        </div>
      </div>

      {/* Errors List */}
      {errors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 rounded-2xl border border-dashed border-border bg-card/50">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground text-sm">No Errors Recorded</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Your disk scans, search indexes, and deletion tasks have completed without logged errors.
            </p>
          </div>
        </div>
      ) : filteredErrors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 rounded-2xl border border-dashed border-border/60 bg-muted/10">
          <FileQuestion className="w-8 h-8 text-muted-foreground" />
          <h3 className="font-medium text-foreground text-xs">No matching errors</h3>
          <p className="text-[11px] text-muted-foreground">
            Try adjusting your search query or filter chips.
          </p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto pr-1 flex-1">
          {filteredErrors.map((err) => {
            const isFixing = fixingId === err.id;
            const canAutoFix = !err.fixed && err.path && err.source === "deletion";

            return (
              <div
                key={err.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  err.fixed
                    ? "bg-emerald-500/5 border-emerald-500/25"
                    : "bg-card border-border shadow-xs hover:border-border/80"
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {err.fixed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                    )}

                    <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                      {err.title}
                    </span>

                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 uppercase shrink-0 font-mono"
                    >
                      {err.source}
                    </Badge>

                    {err.fixed && (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                        Fixed
                      </Badge>
                    )}
                  </div>

                  <span className="text-[11px] text-muted-foreground shrink-0 font-mono">
                    {new Date(err.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Path display with copy, analyze & reveal actions */}
                {err.path && (
                  <div className="mt-2 flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40 text-[11px] font-mono text-foreground/90 overflow-x-auto">
                    <span className="text-muted-foreground shrink-0">Path:</span>
                    <span className="truncate flex-1 select-all" title={err.path}>
                      {err.path}
                    </span>
                    <button
                      onClick={() => handleCopyPath(err.path)}
                      className="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded hover:bg-muted"
                      title="Copy path"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {onAnalyzePath && (
                      <button
                        onClick={() => onAnalyzePath(err.path!)}
                        className="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded hover:bg-muted"
                        title="Analyze folder in viewer"
                      >
                        <HardDrive className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleReveal(err.path)}
                      className="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded hover:bg-muted"
                      title="Reveal in File Explorer"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Error message */}
                <div className="mt-2.5 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs font-mono text-destructive">
                  {err.message}
                </div>

                {/* Diagnostic Recommendation */}
                {err.suggestedFix && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/30">
                    <CornerDownRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      <strong className="text-foreground">Suggested Fix: </strong>
                      {err.suggestedFix}
                    </span>
                  </div>
                )}

                {/* Action Buttons Footer */}
                <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                  <div className="flex items-center gap-2 flex-wrap">
                    {canAutoFix && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleFixSingle(err)}
                        disabled={isFixing}
                        className="gap-1.5 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        {isFixing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wrench className="w-3 h-3" />
                        )}
                        <span>Fix Issue</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyErrorDetails(err)}
                      className="gap-1.5 h-7 text-xs"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Details</span>
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeError(err.id)}
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
