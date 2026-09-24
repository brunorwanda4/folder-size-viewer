import { useMemo } from "react";
import { Folder, HardDrive } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface BreadcrumbNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  disabled?: boolean;
}

interface PathSegment {
  name: string;
  fullPath: string;
  isLast: boolean;
}

export function BreadcrumbNav({
  currentPath,
  onNavigate,
  disabled = false,
}: BreadcrumbNavProps) {
  const segments: PathSegment[] = useMemo(() => {
    if (!currentPath) return [];

    const isWindows = currentPath.includes("\\") || /^[a-zA-Z]:/.test(currentPath);
    const separator = isWindows ? "\\" : "/";
    const parts = currentPath.split(/[/\\]+/).filter(Boolean);

    if (parts.length === 0) return [];

    const result: PathSegment[] = [];

    // On Windows, handle drive root like "C:" -> "C:\"
    if (isWindows && /^[a-zA-Z]:$/.test(parts[0])) {
      const driveRoot = `${parts[0]}\\`;
      result.push({
        name: driveRoot,
        fullPath: driveRoot,
        isLast: parts.length === 1,
      });

      let accumulated = driveRoot;
      for (let i = 1; i < parts.length; i++) {
        accumulated = `${accumulated.replace(/\\$/, "")}\\${parts[i]}`;
        result.push({
          name: parts[i],
          fullPath: accumulated,
          isLast: i === parts.length - 1,
        });
      }
    } else {
      // Unix or UNC paths
      const isAbsoluteUnix = currentPath.startsWith("/");
      let accumulated = isAbsoluteUnix ? "" : "";

      for (let i = 0; i < parts.length; i++) {
        accumulated += (isAbsoluteUnix || i > 0 ? separator : "") + parts[i];
        result.push({
          name: parts[i],
          fullPath: accumulated,
          isLast: i === parts.length - 1,
        });
      }
    }

    return result;
  }, [currentPath]);

  if (!currentPath || segments.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-1 py-1.5 overflow-x-auto text-xs font-mono">
      <Breadcrumb>
        <BreadcrumbList className="flex-nowrap">
          {segments.map((seg, idx) => {
            const isDrive = idx === 0 && seg.name.includes(":");
            return (
              <span key={seg.fullPath} className="inline-flex items-center gap-1.5">
                <BreadcrumbItem>
                  {seg.isLast ? (
                    <BreadcrumbPage className="font-semibold text-foreground flex items-center gap-1">
                      {isDrive ? (
                        <HardDrive className="w-3.5 h-3.5 text-blue-500" />
                      ) : (
                        <Folder className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span>{seg.name}</span>
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      onClick={() => !disabled && onNavigate(seg.fullPath)}
                      className={`hover:text-primary transition-colors flex items-center gap-1 ${
                        disabled ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      {isDrive && <HardDrive className="w-3.5 h-3.5 text-blue-500" />}
                      <span>{seg.name}</span>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!seg.isLast && <BreadcrumbSeparator />}
              </span>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
