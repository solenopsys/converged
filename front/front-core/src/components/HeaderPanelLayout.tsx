import { useState, useCallback, cloneElement, isValidElement } from "react";
import type { ReactNode, ReactElement } from "react";
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
  const hasSelectionActions = config.selectionActions && config.selectionActions.length > 0;
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  const handleSelectionChange = useCallback((_ids: any[], rows: any[]) => {
    setSelectedRows(rows);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedRows([]);
  }, []);

  // If selectionActions are defined, inject onSelectionChange into direct child
  const enhancedChildren =
    hasSelectionActions && isValidElement(children)
      ? cloneElement(children as ReactElement<any>, {
          onSelectionChange: handleSelectionChange,
        })
      : children;

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <HeaderPanel
        config={config}
        selectedRows={hasSelectionActions ? selectedRows : undefined}
        onClearSelection={hasSelectionActions ? handleClearSelection : undefined}
      />
      <div className={cn("flex-1 min-h-0 overflow-hidden p-4", contentClassName)}>
        {enhancedChildren}
      </div>
    </div>
  );
};
