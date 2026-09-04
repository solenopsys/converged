export const ID = "calls-sf";
export const GROUP = {
	id: "ai",
	title: "AI",
	iconName: "IconBrain",
};
export { WaveformPlayer } from "./components/WaveformPlayer";
export { objects } from "./objects";
export { CallDetailView } from "./views/CallDetailView";

import { LocaleController } from "front-core";
import definition from "./objects";

LocaleController.getInstance().setLocales(ID, {
	en: new URL("../locales/en.json", import.meta.url).toString(),
	ru: new URL("../locales/ru.json", import.meta.url).toString(),
	de: new URL("../locales/de.json", import.meta.url).toString(),
	es: new URL("../locales/es.json", import.meta.url).toString(),
	fr: new URL("../locales/fr.json", import.meta.url).toString(),
	it: new URL("../locales/it.json", import.meta.url).toString(),
	pt: new URL("../locales/pt.json", import.meta.url).toString(),
});

export default definition;
