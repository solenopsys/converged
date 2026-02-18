import type { MenuItem } from "../../controllers/menu-store";

export type HeaderIconKind = "grid" | "pin" | "more";
export type TabsIconKind = "grid" | "list" | "nodes" | "star" | "user";
export type ChatActionKind = "add" | "mic" | "spark";
export type ChatQuickKind = "message" | "spark" | "bolt";

export type PanelConfig = {
  tabs: {
    headerIcons: HeaderIconKind[];
    menuItems: MenuItem[];
    icons: TabsIconKind[];
    footerIcon: TabsIconKind;
  };
  chat: {
    title: string;
    description?: string;
    inputLabel: string;
    actions: ChatActionKind[];
    quickCommands?: { label: string; icon?: ChatQuickKind }[];
  };
};
