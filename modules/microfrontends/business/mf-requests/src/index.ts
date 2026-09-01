import { LocaleController } from "front-core";
import definition from "./objects";

export const ID = "mf-requests";
export const GROUP = {
	id: "sales",
	title: "Sales",
	iconName: "IconBriefcase",
};

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
export {
	ManufacturingRequestPage,
	RequestDetailView,
} from "./views/RequestDetailView";
