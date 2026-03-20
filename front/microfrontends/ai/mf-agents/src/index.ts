export const ID = "agents-mf";
export { GROUP, MENU } from "./menu";
import ACTIONS from "./functions";
import { BasePlugin, LocaleController } from "front-core";

LocaleController.getInstance().setLocales(ID, {
  en: new URL("../locales/en.json", import.meta.url).toString(),
  ru: new URL("../locales/ru.json", import.meta.url).toString(),
});

export default new BasePlugin(ID, ACTIONS);
