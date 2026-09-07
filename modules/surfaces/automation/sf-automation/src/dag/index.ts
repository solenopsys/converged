export const ID = "dag-sf";

import { LocaleController } from "front-core";
import de from "../../locales/dag/de.json";
import en from "../../locales/dag/en.json";
import es from "../../locales/dag/es.json";
import fr from "../../locales/dag/fr.json";
import it from "../../locales/dag/it.json";
import pt from "../../locales/dag/pt.json";
import ru from "../../locales/dag/ru.json";
import "./functions/dashboard-widgets";

export const SIDEBAR_TABS = [
	{
		id: "dag",
		title: "Configuration",
		iconName: "IconSettings",
		order: 30,
	},
];

LocaleController.getInstance().setLocales(ID, {
	en,
	ru,
	de,
	es,
	fr,
	it,
	pt,
});
