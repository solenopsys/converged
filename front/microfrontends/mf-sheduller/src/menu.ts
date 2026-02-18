import { SHOW_CRONS_LIST } from "./functions/crons.config";

export const MENU = {
  title: "menu.sheduller",
  iconName: "IconClock",
  items: [
    {
      title: "menu.crons",
      key: "crons",
      action: SHOW_CRONS_LIST,
    },
  ],
};
