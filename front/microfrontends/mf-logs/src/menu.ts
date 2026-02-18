import { SHOW_LOGS, SHOW_LOGS_COLD, SHOW_LOGS_STATS } from "./functions";

export const MENU = {
  title: "menu.logs",
  iconName: "IconListDetails",
  action: SHOW_LOGS_STATS,
  items: [
    {
      title: "menu.hot",
      key: "hot",
      action: SHOW_LOGS,
    },
    {
      title: "menu.cold",
      key: "cold",
      action: SHOW_LOGS_COLD,
    },
  ],
};
