import type { CreateAction } from "front-core";
import {
	buildLocalePath,
	DEFAULT_LOCALE,
	extractLocaleFromPath,
} from "front-core/landing";

const SHOW_DEFAULT_LANDING = "landing.show.default";

const createShowDefaultLandingAction: CreateAction<unknown> = () => ({
	id: SHOW_DEFAULT_LANDING,
	access: "public",
	invoke: () => {
		presentLanding();
	},
});

const ACTIONS = [createShowDefaultLandingAction];

export function presentLanding(): void {
	if (typeof window === "undefined") return;
	const locale =
		extractLocaleFromPath(window.location.pathname) ?? DEFAULT_LOCALE;
	window.location.assign(buildLocalePath(locale, "/"));
}

export { SHOW_DEFAULT_LANDING };
export default ACTIONS;
