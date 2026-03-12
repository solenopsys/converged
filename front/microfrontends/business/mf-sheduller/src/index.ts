export const ID = "sheduller-mf";
export { MENU } from "./menu";
export const SIDEBAR_TABS = [
  {
    id: "sheduller",
    title: "Scheduler",
    iconName: "IconClock",
    order: 35,
  },
];

import { ACTIONS } from "./functions";
import { BasePlugin, LocaleController } from "front-core";

LocaleController.getInstance().setLocales(ID, {
  en: new URL("../locales/en.json", import.meta.url).toString(),
  ru: new URL("../locales/ru.json", import.meta.url).toString(),
});

export default new BasePlugin(ID, ACTIONS);
