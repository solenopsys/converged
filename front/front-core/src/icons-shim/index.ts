export * from "./icons";

import type { ComponentType } from "react";
import * as allIcons from "./icons";

const iconMap = allIcons as unknown as Record<string, ComponentType<any>>;

export const getTablerIcon = (
  name: string
): ComponentType<{ className?: string }> | null => {
  return iconMap[name] ?? null;
};
