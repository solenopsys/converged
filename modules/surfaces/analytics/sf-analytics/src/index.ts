export const ID = "analytics-sf";
export const SIDEBAR_TABS = [
	{
		id: "analytics",
		title: "Analytics",
		iconName: "IconChartHistogram",
		order: 36,
	},
];

import { LocaleController } from "front-core";
import definition from "./objects";

LocaleController.getInstance().setLocales(ID, {
	en: new URL("../locales/en.json", import.meta.url).toString(),
	ru: new URL("../locales/ru.json", import.meta.url).toString(),
});

export default definition;
