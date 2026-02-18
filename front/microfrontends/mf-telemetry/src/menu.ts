import { SHOW_TELEMETRY, SHOW_TELEMETRY_COLD } from "./functions";

export const MENU = {
  title: "menu.telemetry",
  iconName: "IconActivity",
  items: [
    {
      title: "menu.hot",
      key: "hot",
      action: SHOW_TELEMETRY,
    },
    {
      title: "menu.cold",
      key: "cold",
      action: SHOW_TELEMETRY_COLD,
    },
  ],
};
