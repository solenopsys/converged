import { CreateAction, CreateWidget } from "front-core";
import { DEFAULT_LOCALE, buildLocalePath, extractLocaleFromPath } from "front-core/landing-common/i18n";
import LandingView from "./views/LandingView";
import { getLandingConfigPath } from "./env";

const SHOW_DEFAULT_LANDING = "landing.show.default";

const createLandingWidget: CreateWidget<typeof LandingView> = (
  _bus,
  config?: { configPath: string },
) => ({
  view: LandingView,
  placement: () => "center",
  config,
});

const createShowDefaultLandingAction: CreateAction<any> = (bus) => ({
  id: SHOW_DEFAULT_LANDING,
  description: "Show landing",
  invoke: () => {
    presentLanding(bus);
  },
});

const ACTIONS = [createShowDefaultLandingAction];

export function presentLanding(bus: any, configPath?: string) {
  if (typeof window !== "undefined") {
    const locale = extractLocaleFromPath(window.location.pathname) ?? DEFAULT_LOCALE;
    window.location.assign(buildLocalePath(locale, "/"));
    return;
  }

  bus.present({
    widget: createLandingWidget(bus, {
      configPath: configPath ?? getLandingConfigPath(),
    }),
  });
}

export { SHOW_DEFAULT_LANDING };
export default ACTIONS;
