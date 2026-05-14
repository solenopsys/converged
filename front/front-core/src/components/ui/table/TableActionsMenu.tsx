"use client";

import React, { useState } from "react";
import { cn } from "../../../lib/utils";
import type { TableActionIcon } from "./InfiniteScrollDataTable.types";

export type TableActionsMenuItem = {
  id: string;
  label: string;
  icon?: TableActionIcon;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
};

type TableActionsMenuProps = {
  trigger: React.ReactNode;
  items: TableActionsMenuItem[];
  align?: "left" | "right";
};

export function TableActionsMenu({
  trigger,
  items,
  align = "right",
}: TableActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <div onClick={() => setIsOpen((value) => !value)}>{trigger}</div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div
            className={cn(
              "absolute top-full z-20 mt-1 w-48 rounded-lg border bg-background shadow-lg",
              align === "left" ? "left-0" : "right-0",
            )}
          >
            <div className="py-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    item.onClick?.();
                    setIsOpen(false);
                  }}
                  disabled={item.disabled}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
                    "hover:bg-accent focus:bg-accent",
                    item.disabled &&
                      "cursor-not-allowed text-muted-foreground hover:bg-transparent",
                    item.variant === "danger" &&
                      !item.disabled &&
                      "text-destructive hover:bg-destructive/10",
                  )}
                >
                  {item.icon && <item.icon size={16} />}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
