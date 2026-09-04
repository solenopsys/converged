import { getLandingMenuTitle } from "./env";
import { SHOW_DEFAULT_LANDING } from "./functions";

export const MENU = {
	title: "Landing",
	iconName: "IconGlobe",
	items: [
		{
			title: getLandingMenuTitle(),
			key: "4ir",
			iconName: "IconTrendingUp",
			action: SHOW_DEFAULT_LANDING,
		},
	],
};
