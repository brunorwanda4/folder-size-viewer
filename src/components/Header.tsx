import * as React from "react";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationSettings } from "./NotificationSettings";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

interface HeaderProps {
  onOpenSearchSettings?: () => void;
  children?: React.ReactNode;
}

export function Header({ onOpenSearchSettings, children }: HeaderProps) {
  return (
    <header className="flex items-center justify-between pb-3 border-b border-border/40 select-none gap-3">
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 overflow-hidden p-1">
          <img
            src="/logo.png"
            alt="Folder Size Viewer"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground hidden sm:block">
          Folder Size Viewer
        </h1>
      </div>

      {children && (
        <div className="flex items-center justify-center flex-1 min-w-0">
          {children}
        </div>
      )}

      <div className="flex items-center gap-1.5 shrink-0">
        {onOpenSearchSettings && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSearchSettings}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Search & Index Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
        <NotificationSettings />
        <ThemeToggle />
      </div>
    </header>
  );
}
