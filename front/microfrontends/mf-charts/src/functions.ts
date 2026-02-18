import { CreateAction, CreateWidget } from "front-core";
import { ChatView } from "./views/ChatView";

const SHOW_CHARTS = "charts.show";

const createChatWidget: CreateWidget<typeof ChatView> = (_bus) => ({
  view: ChatView,
  placement: () => "center",
  config: {},
});

const createShowChatAction: CreateAction<any> = (bus) => ({
  id: SHOW_CHARTS,
  description: "Show chats",
  invoke: () => {
    bus.present({ widget: createChatWidget(bus) });
  },
});

const ACTIONS = [createShowChatAction];

export { SHOW_CHARTS, createShowChatAction };
export default ACTIONS;
