import { SHOW_CALLS, NEW_CALL, SHOW_CONTEXTS } from "./functions";

export const MENU = {
  title: "menu.calls",
  iconName: "IconPhone",
  items: [
    {
      title: "menu.all_calls",
      key: "calls",
      action: SHOW_CALLS,
    },
    {
      title: "menu.contexts",
      key: "contexts",
      action: SHOW_CONTEXTS,
    },
    {
      title: "menu.new_call",
      key: "new-call",
      action: NEW_CALL,
    },
  ],
};
