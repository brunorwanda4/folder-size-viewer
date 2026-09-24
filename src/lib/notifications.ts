import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { getCurrentWindow, UserAttentionType } from "@tauri-apps/api/window";
import { formatBytes, formatDuration, formatNumber } from "@/lib/format";

export type NotificationMode = "inactive-only" | "always" | "never";

const NOTIFICATION_MODE_KEY = "fsv_notification_mode";

/**
 * Checks if the application is currently running inside Tauri.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Retrieves the current notification mode from localStorage.
 * Default is "inactive-only" (notify when app is minimized or inactive).
 */
export function getNotificationMode(): NotificationMode {
  try {
    const saved = localStorage.getItem(NOTIFICATION_MODE_KEY);
    if (saved === "always" || saved === "never" || saved === "inactive-only") {
      return saved;
    }
  } catch {
    // Fall back to default if localStorage is inaccessible
  }
  return "inactive-only";
}

/**
 * Persists the notification mode to localStorage.
 */
export function setNotificationMode(mode: NotificationMode): void {
  try {
    localStorage.setItem(NOTIFICATION_MODE_KEY, mode);
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Ensures notification permission has been requested and granted.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    return granted;
  } catch (err) {
    console.warn("Could not check/request notification permission:", err);
    return false;
  }
}

/**
 * Checks if the application window is currently active and focused.
 * Returns false if the window is minimized, hidden, or another app is focused.
 */
export async function isAppActive(): Promise<boolean> {
  // Check standard web document visibility and focus first
  if (typeof document !== "undefined") {
    if (document.hidden || document.visibilityState !== "visible") {
      return false;
    }
    if (!document.hasFocus()) {
      return false;
    }
  }

  // Check Tauri native window focus state if running in desktop environment
  if (isTauri()) {
    try {
      const win = getCurrentWindow();
      const [isFocused, isMinimized] = await Promise.all([
        win.isFocused(),
        win.isMinimized(),
      ]);
      if (isMinimized || !isFocused) {
        return false;
      }
    } catch {
      // If window query fails, rely on document.hasFocus() result
    }
  }

  return true;
}

/**
 * Extracts a concise folder name from a full directory path.
 */
function getFolderName(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

interface ScanCompleteDetails {
  path: string;
  totalSize: number;
  itemsCount: number;
  skippedCount?: number;
  elapsedMs?: number;
}

/**
 * Triggers a native Windows desktop notification when a scan completes.
 */
export async function notifyScanComplete(
  details: ScanCompleteDetails,
  force: boolean = false
): Promise<boolean> {
  const mode = getNotificationMode();
  if (mode === "never" && !force) return false;

  // If set to "inactive-only", only notify if user is outside the app
  if (mode === "inactive-only" && !force) {
    const active = await isAppActive();
    if (active) return false;
  }

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return false;

  const folderName = getFolderName(details.path);
  const sizeFormatted = formatBytes(details.totalSize);
  const itemsFormatted = formatNumber(details.itemsCount);
  const timeFormatted = details.elapsedMs
    ? ` in ${formatDuration(details.elapsedMs)}`
    : "";
  const skippedNote =
    details.skippedCount && details.skippedCount > 0
      ? ` (${details.skippedCount} skipped)`
      : "";

  try {
    sendNotification({
      title: `Scan Completed • ${folderName}`,
      body: `${sizeFormatted} across ${itemsFormatted} items${timeFormatted}${skippedNote}`,
    });

    // Request Windows taskbar attention (flashes taskbar button to notify user)
    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        await win.requestUserAttention(UserAttentionType.Informational);
      } catch {
        // Ignore user attention failure
      }
    }

    return true;
  } catch (err) {
    console.warn("Failed to dispatch desktop notification:", err);
    return false;
  }
}

/**
 * Triggers a native Windows desktop notification when a scan fails.
 */
export async function notifyScanError(
  path: string,
  errorMsg: string,
  force: boolean = false
): Promise<boolean> {
  const mode = getNotificationMode();
  if (mode === "never" && !force) return false;

  if (mode === "inactive-only" && !force) {
    const active = await isAppActive();
    if (active) return false;
  }

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return false;

  const folderName = getFolderName(path);

  try {
    sendNotification({
      title: `Scan Failed • ${folderName}`,
      body: errorMsg || "Encountered an error while scanning directory.",
    });

    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        await win.requestUserAttention(UserAttentionType.Informational);
      } catch {
        // Ignore
      }
    }

    return true;
  } catch (err) {
    console.warn("Failed to dispatch desktop error notification:", err);
    return false;
  }
}

/**
 * Sends a test notification to verify Windows notifications are configured properly.
 */
export async function sendTestNotification(): Promise<boolean> {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return false;

  try {
    sendNotification({
      title: "Folder Size Viewer",
      body: "Windows notifications are active! You will be alerted when background scans finish.",
    });

    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        await win.requestUserAttention(UserAttentionType.Informational);
      } catch {
        // Ignore
      }
    }

    return true;
  } catch (err) {
    console.warn("Failed to dispatch test notification:", err);
    return false;
  }
}
