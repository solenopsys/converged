import { LocaleController } from "front-core";
import definition from "./objects";

export const ID = "sf-equipment";
export const GROUP = {
	id: "production",
	title: "Production",
	iconName: "IconFactory",
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

export { objects } from "./objects";
export default definition;
export { EquipmentDashboardView } from "./views/EquipmentDashboardView";
export { MachineDetailView } from "./views/MachineDetailView";
