export const ID = "dag-sf";

import de from "../../locales/dag/de.json";
import en from "../../locales/dag/en.json";
import es from "../../locales/dag/es.json";
import fr from "../../locales/dag/fr.json";
import it from "../../locales/dag/it.json";
import pt from "../../locales/dag/pt.json";
import ru from "../../locales/dag/ru.json";

export const SIDEBAR_TABS = [
	{
		id: "dag",
		title: "Configuration",
		iconName: "IconSettings",
		order: 30,
	},
];

import { LocaleController } from "front-core";
import "./functions/dashboard-widgets";

LocaleController.getInstance().setLocales(ID, {
	en,
	ru,
	de,
	es,
	fr,
	it,
	pt,
});
