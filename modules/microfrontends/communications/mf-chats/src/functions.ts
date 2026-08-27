import { CreateAction, CreateWidget } from "front-core";
import { ChatView } from "./views/ChatView";

const SHOW_CHATS = "chats.show";

const createChatWidget: CreateWidget<typeof ChatView> = (_bus) => ({
  view: ChatView,
  placement: () => "center",
  config: {},
});

const createShowChatAction: CreateAction<any> = (bus) => ({
  id: SHOW_CHATS,
  llm: {
    microfrontend: "chats-mf",
    brief: "llm.actions.chats_show.brief",
    description: "llm.actions.chats_show.description",
  },
  exposure: "user",
  priority: "primary",
  invoke: () => {
    bus.present({ widget: createChatWidget(bus) });
  },
});

const ACTIONS = [createShowChatAction];

export { SHOW_CHATS, createShowChatAction };
export default ACTIONS;
