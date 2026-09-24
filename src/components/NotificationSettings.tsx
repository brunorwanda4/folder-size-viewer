import { useState, useEffect } from "react";
import { Bell, BellOff, BellRing, Check, Laptop, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getNotificationMode,
  setNotificationMode,
  sendTestNotification,
  ensureNotificationPermission,
  NotificationMode,
} from "@/lib/notifications";
import { toast } from "sonner";

export function NotificationSettings() {
  const [mode, setMode] = useState<NotificationMode>("inactive-only");
  const [hasPermission, setHasPermission] = useState<boolean>(true);

  useEffect(() => {
    setMode(getNotificationMode());
    ensureNotificationPermission().then(setHasPermission);
  }, []);

  const handleSelectMode = async (newMode: NotificationMode) => {
    setMode(newMode);
    setNotificationMode(newMode);

    if (newMode !== "never") {
      const granted = await ensureNotificationPermission();
      setHasPermission(granted);
      if (granted) {
        toast.success(
          newMode === "inactive-only"
            ? "Windows alerts enabled when app is inactive"
            : "Windows alerts enabled for all scans"
        );
      } else {
        toast.warning("Notification permission was not granted by Windows.");
      }
    } else {
      toast.info("Windows desktop notifications disabled.");
    }
  };

  const handleTest = async () => {
    const granted = await ensureNotificationPermission();
    setHasPermission(granted);

    if (!granted) {
      toast.error("Windows notification permission is required.");
      return;
    }

    const sent = await sendTestNotification();
    if (sent) {
      toast.success("Test notification sent to Windows!");
    } else {
      toast.error("Could not send Windows notification.");
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative h-9 w-9 rounded-lg border-border/60 hover:bg-accent transition-colors"
                aria-label="Desktop Notification Settings"
              >
                {mode === "never" ? (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Bell className="h-4 w-4 text-foreground" />
                )}
                {mode !== "never" && hasPermission && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
                {mode !== "never" && !hasPermission && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">
              Windows Notifications:{" "}
              {mode === "inactive-only"
                ? "When Inactive"
                : mode === "always"
                ? "Always"
                : "Off"}
            </p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-64 p-2 text-xs">
          <DropdownMenuLabel className="px-2 py-1.5 font-semibold text-xs text-foreground flex items-center justify-between">
            <span>Windows Notifications</span>
            <Laptop className="w-3.5 h-3.5 text-muted-foreground" />
          </DropdownMenuLabel>
          <p className="px-2 pb-2 text-[11px] text-muted-foreground leading-snug">
            Receive native Windows alerts when searching storage in the background.
          </p>

          {!hasPermission && mode !== "never" && (
            <div className="mx-2 mb-2 p-1.5 rounded bg-amber-500/10 border border-amber-500/30 flex items-center gap-1.5 text-[10px] text-amber-500">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Windows permission pending or blocked</span>
            </div>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => handleSelectMode("inactive-only")}
            className="flex items-center justify-between py-2 cursor-pointer"
          >
            <div>
              <div className="font-medium">When Inactive</div>
              <div className="text-[10px] text-muted-foreground">
                Only notify when app is minimized/unfocused
              </div>
            </div>
            {mode === "inactive-only" && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => handleSelectMode("always")}
            className="flex items-center justify-between py-2 cursor-pointer"
          >
            <div>
              <div className="font-medium">Always Notify</div>
              <div className="text-[10px] text-muted-foreground">
                Alert on Windows for every scan finish
              </div>
            </div>
            {mode === "always" && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => handleSelectMode("never")}
            className="flex items-center justify-between py-2 cursor-pointer"
          >
            <div>
              <div className="font-medium">Off</div>
              <div className="text-[10px] text-muted-foreground">
                In-app notifications only
              </div>
            </div>
            {mode === "never" && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleTest}
            className="flex items-center gap-2 py-2 text-primary hover:text-primary cursor-pointer font-medium"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Send Test Notification</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}