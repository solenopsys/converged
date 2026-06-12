import { SHOW_SESSIONS_LIST, SHOW_TOOLS_LIST } from "./functions";

export const MENU = {
  title: "menu.agents",
  iconName: "IconRobot",
  items: [
    {
      title: "menu.sessions",
      key: "sessions",
      iconName: "IconRobot",
      action: SHOW_SESSIONS_LIST,
    },
    {
      title: "menu.tools",
      key: "tools",
      iconName: "IconSettings",
      action: SHOW_TOOLS_LIST,
    },
  ],
};
