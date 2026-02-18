import { tabRegistered } from "sidebar-controller";

type SidebarTabInput = {
  id: string;
  title: string;
  iconName?: string;
  order?: number;
};

export function upsertSidebarTab(tab: SidebarTabInput): void {
  tabRegistered(tab);
}
