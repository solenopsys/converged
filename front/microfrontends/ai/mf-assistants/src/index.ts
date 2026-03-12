

export const ID = "assistants-mf";
export { MENU } from "./menu";
export { chatStore, initializeChat } from "./chat-store";
export { ChatDetail } from "./components/ChatDetail";
export { ChatView } from "./views/ChatView";
import ACTIONS from "./functions";
import { BasePlugin, LocaleController } from "front-core";

LocaleController.getInstance().setLocales(ID, {
  en: new URL("../locales/en.json", import.meta.url).toString(),
  ru: new URL("../locales/ru.json", import.meta.url).toString(),
});

export default new BasePlugin(ID, ACTIONS);
