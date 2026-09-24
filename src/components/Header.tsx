import { FolderArchive } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Badge } from "@/components/ui/badge";

export function Header() {
  return (
    <header className="flex items-center justify-between pb-4 border-b border-border/40 select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
          <FolderArchive className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Folder Size Viewer
            </h1>
            <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0">
              v1.0
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Analyze directory storage, inspect recursive sizes, and spot large folders
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
