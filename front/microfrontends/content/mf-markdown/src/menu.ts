import { SHOW_MD_LIST } from "./functions";

export const GROUP = { id: "content", title: "Content", iconName: "IconFileText" };

export const MENU = {
  title: "menu.markdown",
  iconName: "IconFileText",
  items: [
    {
      title: "menu.list",
      key: "list",
      action: SHOW_MD_LIST,
    },
  ],
};
