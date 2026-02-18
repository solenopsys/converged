import { CreateAction, CreateWidget } from "front-core";
import Panel from "./Panel";

const SHOW_REQUESTS = "requests.show";

const createRequestsWidget: CreateWidget<typeof Panel> = (_bus) => ({
  view: Panel,
  placement: () => "center",
  config: {},
});

const createShowRequestsAction: CreateAction<any> = (bus) => ({
  id: SHOW_REQUESTS,
  description: "Show requests",
  invoke: () => {
    bus.present({ widget: createRequestsWidget(bus) });
  },
});

const ACTIONS = [createShowRequestsAction];

export { SHOW_REQUESTS, createShowRequestsAction };
export default ACTIONS;
