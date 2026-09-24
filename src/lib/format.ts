/**
 * Human-readable size helper using 1024-based units (IEC standard binary prefix).
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 B";
  if (bytes < 0) return "0 B";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeIndex = Math.min(i, sizes.length - 1);
  const value = bytes / Math.pow(k, safeIndex);

  return `${parseFloat(value.toFixed(dm))} ${sizes[safeIndex]}`;
}

/**
 * Formats unix milliseconds timestamp into a localized, readable date-time string.
 */
export function formatDate(timestampMs: number | null | undefined): string {
  if (!timestampMs) return "Unknown";
  try {
    const date = new Date(timestampMs);
    if (isNaN(date.getTime())) return "Unknown";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Unknown";
  }
}

/**
 * Formats a number with comma separators (e.g., 12,345).
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

/**
 * Formats milliseconds into a human-readable elapsed time string (e.g., "120 ms", "1.45 s").
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}
