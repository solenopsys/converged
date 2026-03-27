import { SHOW_SESSIONS_LIST, SHOW_TOOLS_LIST } from "./functions";

export const MENU = {
  title: "menu.agents",
  iconName: "IconAgent",
  items: [
    {
      title: "menu.sessions",
      key: "sessions",
      action: SHOW_SESSIONS_LIST,
    },
    {
      title: "menu.tools",
      key: "tools",
      action: SHOW_TOOLS_LIST,
    },
  ],
};
