export const ID = "calls-mf";
export const GROUP = {
  id: "ai",
  title: "AI",
  iconName: "IconBrain",
};
export { MENU } from "./menu";
export { WaveformPlayer } from "./components/WaveformPlayer";
export { CallDetailView } from "./views/CallDetailView";

import { BasePlugin, LocaleController } from "front-core";
import ACTIONS from "./functions";

LocaleController.getInstance().setLocales(ID, {
  en: new URL("../locales/en.json", import.meta.url).toString(),
  ru: new URL("../locales/ru.json", import.meta.url).toString(),
  de: new URL("../locales/de.json", import.meta.url).toString(),
  es: new URL("../locales/es.json", import.meta.url).toString(),
  fr: new URL("../locales/fr.json", import.meta.url).toString(),
  it: new URL("../locales/it.json", import.meta.url).toString(),
  pt: new URL("../locales/pt.json", import.meta.url).toString(),
});

export default new BasePlugin(ID, ACTIONS);
