import { CreateAction, CreateWidget } from "front-core";
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
  bus.present({
    widget: createLandingWidget(bus, {
      configPath: configPath ?? getLandingConfigPath(),
    }),
  });
}

export { SHOW_DEFAULT_LANDING };
export default ACTIONS;
