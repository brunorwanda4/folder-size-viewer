import { FolderChildEntry, ScanSummary } from "@/types/scan";

export interface TopFolderBarItem {
  id: string;
  name: string;
  fullName: string;
  path: string;
  sizeBytes: number;
  percent: number;
  isFolder: boolean;
  clickable: boolean;
}

export interface FileTypeSlice {
  category: string;
  bytes: number;
  files: number;
  percent: number;
  fill: string;
}

export function truncateName(name: string, maxLen = 20): string {
  if (name.length <= maxLen) return name;
  return `${name.slice(0, maxLen - 1)}…`;
}

/**
 * Builds the top folders by storage data.
 * Returns up to `limit` largest folders, plus "Other folders" and "Files in this folder" if present.
 */
export function buildTopFolders(
  entries: FolderChildEntry[],
  limit = 8
): TopFolderBarItem[] {
  const totalSize = entries.reduce((acc, e) => acc + e.sizeBytes, 0);
  if (totalSize === 0 && entries.length === 0) return [];

  const folders = entries.filter((e) => e.isDir);
  const files = entries.filter((e) => !e.isDir);

  const sortedFolders = [...folders].sort((a, b) => b.sizeBytes - a.sizeBytes);
  const topFolders = sortedFolders.slice(0, limit);
  const remainingFolders = sortedFolders.slice(limit);

  const items: TopFolderBarItem[] = topFolders.map((f, idx) => ({
    id: `folder-${idx}-${f.name}`,
    name: truncateName(f.name, 18),
    fullName: f.name,
    path: f.path,
    sizeBytes: f.sizeBytes,
    percent: totalSize > 0 ? (f.sizeBytes / totalSize) * 100 : 0,
    isFolder: true,
    clickable: true,
  }));

  const otherFoldersBytes = remainingFolders.reduce(
    (acc, f) => acc + f.sizeBytes,
    0
  );
  if (otherFoldersBytes > 0) {
    items.push({
      id: "others-remaining-folders",
      name: "Other folders",
      fullName: `Other folders (${remainingFolders.length} folders)`,
      path: "",
      sizeBytes: otherFoldersBytes,
      percent: totalSize > 0 ? (otherFoldersBytes / totalSize) * 100 : 0,
      isFolder: true,
      clickable: false,
    });
  }

  const filesBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);
  if (filesBytes > 0) {
    items.push({
      id: "files-in-this-folder",
      name: "Files in this folder",
      fullName: `Files in this folder (${files.length} items)`,
      path: "",
      sizeBytes: filesBytes,
      percent: totalSize > 0 ? (filesBytes / totalSize) * 100 : 0,
      isFolder: false,
      clickable: false,
    });
  }

  return items;
}

export const CATEGORY_COLORS: Record<string, string> = {
  Images: "var(--chart-1)",
  Video: "var(--chart-2)",
  Audio: "var(--chart-3)",
  Documents: "var(--chart-4)",
  Archives: "var(--chart-5)",
  Code: "var(--chart-6)",
  "Apps & Executables": "var(--chart-7)",
  Databases: "var(--chart-8)",
  "System & Logs": "var(--chart-9)",
  Other: "var(--chart-10)",
};

/**
 * Builds the file type breakdown data for the Donut chart.
 * Slices smaller than 2% are merged into "Other".
 */
export function buildTypeBreakdown(
  summary: ScanSummary | null
): FileTypeSlice[] {
  if (!summary || !summary.categories) return [];

  const totalSize = summary.totalSize;
  if (totalSize === 0) return [];

  const rawCategories = summary.categories;
  let otherBytes = 0;
  let otherFiles = 0;

  const mainSlices: FileTypeSlice[] = [];

  for (const [catName, stat] of Object.entries(rawCategories)) {
    if (stat.bytes === 0 && stat.files === 0) continue;

    const percent = (stat.bytes / totalSize) * 100;

    if (catName === "Other" || percent < 2) {
      otherBytes += stat.bytes;
      otherFiles += stat.files;
    } else {
      mainSlices.push({
        category: catName,
        bytes: stat.bytes,
        files: stat.files,
        percent,
        fill: CATEGORY_COLORS[catName] || "var(--chart-10)",
      });
    }
  }

  // Sort main slices by storage size descending
  mainSlices.sort((a, b) => b.bytes - a.bytes);

  // Append Other slice if it has storage or files
  if (otherBytes > 0 || otherFiles > 0) {
    mainSlices.push({
      category: "Other",
      bytes: otherBytes,
      files: otherFiles,
      percent: (otherBytes / totalSize) * 100,
      fill: CATEGORY_COLORS["Other"] || "var(--chart-10)",
    });
  }

  return mainSlices;
}
