import { SHOW_GALERY_LIST } from "./functions";

export const GROUP = { id: "content", title: "Content", iconName: "IconFileText" };

export const MENU = {
  title: "menu.galery",
  iconName: "IconPhoto",
  items: [
    {
      title: "menu.list",
      key: "list",
      action: SHOW_GALERY_LIST,
    },
  ],
};
