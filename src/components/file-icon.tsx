import { Icon } from "@iconify/react";
import { getIconName } from "@/lib/file-icons";
import { cn } from "@/lib/utils";

interface FileIconProps {
  name: string;
  isDir: boolean;
  isOpen?: boolean;
  size?: number | string;
  className?: string;
}

export function FileIcon({
  name,
  isDir,
  isOpen = false,
  size = 18,
  className,
}: FileIconProps) {
  const iconName = getIconName(name, isDir, isOpen);

  return (
    <Icon
      icon={iconName}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("inline-block shrink-0 select-none", className)}
    />
  );
}
