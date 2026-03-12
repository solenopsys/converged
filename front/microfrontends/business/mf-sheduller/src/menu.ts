import { SHOW_CRONS_LIST } from "./functions/crons.config";
import { SHOW_HISTORY } from "./functions/history.config";
import { SHOW_STATS } from "./functions/stats.config";

export const MENU = {
  title: "menu.sheduller",
  iconName: "IconClock",
  action: SHOW_STATS,
  items: [
    {
      title: "menu.crons",
      key: "crons",
      action: SHOW_CRONS_LIST,
    },
    {
      title: "menu.history",
      key: "history",
      action: SHOW_HISTORY,
    },
  ],
};
