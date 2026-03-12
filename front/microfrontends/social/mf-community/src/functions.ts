import { CreateAction, CreateWidget } from "front-core";
import { CommunityView } from "./views/CommunityView";

const SHOW_COMMUNITY = "community.show";

const createCommunityWidget: CreateWidget<typeof CommunityView> = (_bus) => ({
  view: CommunityView,
  placement: () => "center",
  config: {},
});

const createShowCommunityAction: CreateAction<any> = (bus) => ({
  id: SHOW_COMMUNITY,
  description: "Show community",
  invoke: () => {
    bus.present({ widget: createCommunityWidget(bus) });
  },
});

const ACTIONS = [createShowCommunityAction];

export { SHOW_COMMUNITY, createShowCommunityAction };
export default ACTIONS;
