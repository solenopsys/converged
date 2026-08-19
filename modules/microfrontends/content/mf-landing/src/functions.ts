import type { CreateAction } from "front-core";
import { DEFAULT_LOCALE, buildLocalePath, extractLocaleFromPath } from "front-core/landing";

const SHOW_DEFAULT_LANDING = "landing.show.default";

const createShowDefaultLandingAction: CreateAction<unknown> = () => ({
  id: SHOW_DEFAULT_LANDING,
  access: "public",
  description: "Show landing",
  invoke: () => {
    presentLanding();
  },
});

const ACTIONS = [createShowDefaultLandingAction];

export function presentLanding(): void {
  if (typeof window === "undefined") return;
  const locale = extractLocaleFromPath(window.location.pathname) ?? DEFAULT_LOCALE;
  window.location.assign(buildLocalePath(locale, "/"));
}

export { SHOW_DEFAULT_LANDING };
export default ACTIONS;
