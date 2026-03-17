import { SHOW_TELEMETRY_HOT, SHOW_TELEMETRY_COLD, SHOW_TELEMETRY_STATS } from "./functions";

export const GROUP = { id: "analytics", title: "Analytics", iconName: "IconChartBar" };

export const MENU = {
  title: "menu.telemetry",
  iconName: "IconActivity",
  action: SHOW_TELEMETRY_STATS,
  items: [
    {
      title: "menu.telemetry.hot",
      key: "telemetry-hot",
      action: SHOW_TELEMETRY_HOT,
    },
    {
      title: "menu.telemetry.cold",
      key: "telemetry-cold",
      action: SHOW_TELEMETRY_COLD,
    },
  ],
};
