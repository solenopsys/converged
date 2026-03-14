import { SHOW_USAGE_LIST, SHOW_USAGE_STATS } from "./functions/usage.config";

export const MENU = {
  title: "menu.usage",
  iconName: "IconTrendingUp",
  action: SHOW_USAGE_STATS,
  items: [
    {
      title: "menu.usage.list",
      key: "usage",
      action: SHOW_USAGE_LIST,
    },
  ],
};
