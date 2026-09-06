export const ID = "webhooks-sf";

import de from "../../locales/webhooks/de.json";
import en from "../../locales/webhooks/en.json";
import es from "../../locales/webhooks/es.json";
import fr from "../../locales/webhooks/fr.json";
import it from "../../locales/webhooks/it.json";
import pt from "../../locales/webhooks/pt.json";
import ru from "../../locales/webhooks/ru.json";
export const SIDEBAR_TABS = [
	{
		id: "webhooks",
		title: "Webhooks",
		iconName: "IconShare3",
		order: 36,
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
