import { SHOW_LOGS_HOT, SHOW_LOGS_COLD, SHOW_LOGS_STATS } from "./functions";

export const MENU = {
  title: "menu.logs",
  iconName: "IconListDetails",
  action: SHOW_LOGS_STATS,
  items: [
    {
      title: "menu.logs.hot",
      key: "logs-hot",
      action: SHOW_LOGS_HOT,
    },
    {
      title: "menu.logs.cold",
      key: "logs-cold",
      action: SHOW_LOGS_COLD,
    },
  ],
};
