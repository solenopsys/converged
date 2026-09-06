export const ID = "sheduller-sf";

import de from "../../locales/sheduller/de.json";
import en from "../../locales/sheduller/en.json";
import es from "../../locales/sheduller/es.json";
import fr from "../../locales/sheduller/fr.json";
import it from "../../locales/sheduller/it.json";
import pt from "../../locales/sheduller/pt.json";
import ru from "../../locales/sheduller/ru.json";
export const SIDEBAR_TABS = [
	{
		id: "sheduller",
		title: "Scheduler",
		iconName: "IconClock",
		order: 35,
	},
];

import { LocaleController } from "front-core";

LocaleController.getInstance().setLocales(ID, {
	en,
	ru,
	de,
	es,
	fr,
	it,
	pt,
});
