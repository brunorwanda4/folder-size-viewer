import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

export interface AppError {
  id: string;
  title: string;
  message: string;
  details?: string;
  source: "deletion" | "scan" | "indexing" | "filesystem";
  path?: string;
  isDir?: boolean;
  timestamp: number;
  fixed?: boolean;
  errorCode?: string;
  suggestedFix?: string;
}

interface ErrorContextType {
  errors: AppError[];
  unresolvedCount: number;
  addError: (error: Omit<AppError, "id" | "timestamp" | "fixed">) => string;
  removeError: (id: string) => void;
  clearAllErrors: () => void;
  fixError: (id: string, onItemFixed?: (path: string) => void) => Promise<boolean>;
  fixAllErrors: (onItemFixed?: (path: string) => void) => Promise<void>;
  copyErrorDetails: (error: AppError) => void;
  copyAllErrors: () => void;
  openErrorPage: () => void;
  setOpenErrorPageHandler: (handler: () => void) => void;
}

const ErrorContext = createContext<ErrorContextType | null>(null);

function analyzeError(message: string, path?: string): { code?: string; suggestedFix: string } {
  const lower = message.toLowerCase();

  if (lower.includes("os error 5") || lower.includes("access is denied") || lower.includes("permission denied")) {
    return {
      code: "ACCESS_DENIED (os error 5)",
      suggestedFix: "File or directory has read-only flags or requires elevated administrator permissions. Click 'Fix Issue' to remove attributes and force delete.",
    };
  }

  if (lower.includes("os error 32") || lower.includes("being used by another process") || lower.includes("locked")) {
    return {
      code: "FILE_LOCKED (os error 32)",
      suggestedFix: "This file is currently opened or held by another application. Close programs using this path, or click 'Fix Issue' to attempt forced unlock & removal.",
    };
  }

  if (lower.includes("os error 2") || lower.includes("os error 3") || lower.includes("does not exist") || lower.includes("not found")) {
    return {
      code: "NOT_FOUND",
      suggestedFix: "Target path was already removed or moved by another operation.",
    };
  }

  if (path && (path.includes("System Volume Information") || path.includes("$Recycle.Bin") || path.includes("WindowsApps"))) {
    return {
      code: "PROTECTED_SYSTEM_LOCATION",
      suggestedFix: "This is a protected Windows operating system directory with restricted NT permissions.",
    };
  }

  return {
    code: "IO_ERROR",
    suggestedFix: "Click 'Fix Issue' to attempt attribute removal and forced system cleanup, or 'Reveal in Explorer' to inspect locks manually.",
  };
}

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<AppError[]>([]);
  const [openPageFn, setOpenPageFn] = useState<(() => void) | null>(null);

  const unresolvedCount = errors.filter((e) => !e.fixed).length;

  const setOpenErrorPageHandler = useCallback((handler: () => void) => {
    setOpenPageFn(() => handler);
  }, []);

  const openErrorPage = useCallback(() => {
    if (openPageFn) {
      openPageFn();
    }
  }, [openPageFn]);

  const addError = useCallback(
    (err: Omit<AppError, "id" | "timestamp" | "fixed">): string => {
      const id = `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const { code, suggestedFix } = analyzeError(err.message, err.path);

      const newError: AppError = {
        ...err,
        id,
        timestamp: Date.now(),
        fixed: false,
        errorCode: err.errorCode || code,
        suggestedFix: err.suggestedFix || suggestedFix,
      };

      setErrors((prev) => [newError, ...prev]);
      return id;
    },
    []
  );

  const removeError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors([]);
    toast.success("Error log cleared");
  }, []);

  const fixError = useCallback(
    async (id: string, onItemFixed?: (path: string) => void): Promise<boolean> => {
      const target = errors.find((e) => e.id === id);
      if (!target) return false;

      if (!target.path) {
        toast.info("No file path associated with this error to auto-fix.");
        return false;
      }

      try {
        toast.loading(`Attempting to fix & force delete "${target.path}"...`, { id: `fixing-${id}` });
        await invoke("force_fix_delete", { path: target.path });

        setErrors((prev) =>
          prev.map((e) => (e.id === id ? { ...e, fixed: true } : e))
        );

        toast.success("Successfully fixed and removed item", {
          id: `fixing-${id}`,
          description: target.path,
        });

        if (onItemFixed) {
          onItemFixed(target.path);
        }

        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error("Could not automatically fix item", {
          id: `fixing-${id}`,
          description: msg,
        });
        return false;
      }
    },
    [errors]
  );

  const fixAllErrors = useCallback(
    async (onItemFixed?: (path: string) => void) => {
      const fixable = errors.filter((e) => !e.fixed && e.path && e.source === "deletion");
      if (fixable.length === 0) {
        toast.info("No pending fixable deletion errors found");
        return;
      }

      let successCount = 0;
      for (const err of fixable) {
        if (!err.path) continue;
        try {
          await invoke("force_fix_delete", { path: err.path });
          setErrors((prev) =>
            prev.map((e) => (e.id === err.id ? { ...e, fixed: true } : e))
          );
          if (onItemFixed) {
            onItemFixed(err.path);
          }
          successCount++;
        } catch {
          // Continue to next error
        }
      }

      if (successCount > 0) {
        toast.success(`Fixed and removed ${successCount} of ${fixable.length} items`);
      } else {
        toast.error("Failed to auto-fix remaining items. Check file locks or run as Administrator.");
      }
    },
    [errors]
  );

  const copyErrorDetails = useCallback((error: AppError) => {
    const formatted = [
      `### Error: ${error.title}`,
      `- **Source**: ${error.source.toUpperCase()}`,
      `- **Timestamp**: ${new Date(error.timestamp).toISOString()}`,
      error.path ? `- **Path**: \`${error.path}\`` : null,
      error.errorCode ? `- **Error Code**: ${error.errorCode}` : null,
      `- **Status**: ${error.fixed ? "RESOLVED / FIXED" : "UNRESOLVED"}`,
      `\n**Message**:`,
      `\`\`\`\n${error.message}\n\`\`\``,
      error.details ? `\n**Details**:\n\`\`\`\n${error.details}\n\`\`\`` : null,
      error.suggestedFix ? `\n**Suggested Fix**:\n> ${error.suggestedFix}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(formatted).then(
      () => toast.success("Error details copied to clipboard"),
      () => toast.error("Failed to copy to clipboard")
    );
  }, []);

  const copyAllErrors = useCallback(() => {
    if (errors.length === 0) {
      toast.info("No errors to copy");
      return;
    }

    const reportHeader = [
      `# Folder Size Viewer - Diagnostic Error Report`,
      `Generated: ${new Date().toISOString()}`,
      `Total Errors: ${errors.length} (${unresolvedCount} unresolved, ${errors.length - unresolvedCount} fixed)`,
      `----------------------------------------\n`,
    ].join("\n");

    const errorBlocks = errors.map((err, i) => {
      return [
        `## [${i + 1}] ${err.title}`,
        `- **Source**: ${err.source}`,
        `- **Time**: ${new Date(err.timestamp).toLocaleString()}`,
        err.path ? `- **Target Path**: \`${err.path}\`` : null,
        err.errorCode ? `- **Code**: ${err.errorCode}` : null,
        `- **Status**: ${err.fixed ? "FIXED" : "UNRESOLVED"}`,
        `\n**Error Description**:`,
        `\`\`\`\n${err.message}\n\`\`\``,
        err.details ? `\n**Stack / Details**:\n\`\`\`\n${err.details}\n\`\`\`` : null,
        err.suggestedFix ? `\n**Recommendation**:\n${err.suggestedFix}\n` : null,
        `----------------------------------------`,
      ]
        .filter(Boolean)
        .join("\n");
    });

    const fullReport = [reportHeader, ...errorBlocks].join("\n\n");
    navigator.clipboard.writeText(fullReport).then(
      () => toast.success("Full diagnostic error report copied to clipboard"),
      () => toast.error("Failed to copy report to clipboard")
    );
  }, [errors, unresolvedCount]);

  return (
    <ErrorContext.Provider
      value={{
        errors,
        unresolvedCount,
        addError,
        removeError,
        clearAllErrors,
        fixError,
        fixAllErrors,
        copyErrorDetails,
        copyAllErrors,
        openErrorPage,
        setOpenErrorPageHandler,
      }}
    >
      {children}
    </ErrorContext.Provider>
  );
}

export function useAppErrors() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error("useAppErrors must be used within an ErrorProvider");
  }
  return context;
}
