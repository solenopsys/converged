export const ID = "usage-mf";
export { MENU } from "./menu";
export const SIDEBAR_TABS = [
  {
    id: "usage",
    title: "Usage",
    iconName: "IconTrendingUp",
    order: 37,
  },
];

import { ACTIONS } from "./functions";
import { BasePlugin, LocaleController } from "front-core";

LocaleController.getInstance().setLocales(ID, {
  en: new URL("../locales/en.json", import.meta.url).toString(),
  ru: new URL("../locales/ru.json", import.meta.url).toString(),
});

export default new BasePlugin(ID, ACTIONS);
