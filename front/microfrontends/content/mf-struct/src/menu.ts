import { SHOW_STRUCT_LIST } from "./functions";

export const GROUP = { id: "content", title: "Content", iconName: "IconFileText" };

export const MENU = {
  title: "menu.struct",
  iconName: "IconFileJson",
  items: [
    {
      title: "menu.list",
      key: "list",
      action: SHOW_STRUCT_LIST,
    },
  ],
};
