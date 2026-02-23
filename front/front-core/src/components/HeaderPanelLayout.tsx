import type { ReactNode } from "react";
import { HeaderPanel, type HeaderPanelConfig } from "./HeaderPanel";
import { cn } from "../lib/utils";

export interface HeaderPanelLayoutProps {
  config: HeaderPanelConfig;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export const HeaderPanelLayout = ({
  config,
  children,
  className,
  contentClassName,
}: HeaderPanelLayoutProps) => {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <HeaderPanel config={config} />
      <div className={cn("flex-1 min-h-0 overflow-hidden p-4", contentClassName)}>
        {children}
      </div>
    </div>
  );
};
