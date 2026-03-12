import { SHOW_USAGE_LIST, SHOW_USAGE_STATS } from "./functions/usage.config";

export const MENU = {
  title: "menu.usage",
  iconName: "IconTrendingUp",
  items: [
    {
      title: "menu.usage.list",
      key: "usage",
      action: SHOW_USAGE_LIST,
    },
    {
      title: "menu.usage.stats",
      key: "usage_stats",
      action: SHOW_USAGE_STATS,
    },
  ],
};
