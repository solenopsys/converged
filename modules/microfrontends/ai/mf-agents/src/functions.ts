import { CreateAction, CreateWidget } from "front-core";
import { agentClient } from "./services";
import domain from "./domain";
import { SessionsListView } from "./views/SessionsListView";
import { ToolsListView } from "./views/ToolsListView";
import { $sessionsStore, openSessionDetail } from "./domain-sessions";

const SHOW_SESSIONS_LIST = "agents.show_sessions_list";
const SHOW_TOOLS_LIST = "agents.show_tools_list";
const VIEW_SESSION = "agents.view_session";
const DELETE_SESSION = "agents.delete_session";

const deleteSessionFx = domain.createEffect<{ recordId: string }, void>({
  name: "DELETE_SESSION",
  handler: ({ recordId }) => agentClient.deleteSession(recordId),
});

const deleteSessionEvent = domain.createEvent<{ recordId: string }>("DELETE_SESSION_EVENT");

import { sample } from "effector";
sample({ clock: deleteSessionEvent, target: deleteSessionFx });

const createSessionsListWidget: CreateWidget<typeof SessionsListView> = (bus) => ({
  view: SessionsListView,
  placement: () => "center",
  config: { bus },
});

const createToolsListWidget: CreateWidget<typeof ToolsListView> = (bus) => ({
  view: ToolsListView,
  placement: () => "center",
  config: { bus },
});

const createShowSessionsListAction: CreateAction<any> = (bus) => ({
  id: SHOW_SESSIONS_LIST,
  llm: {
    microfrontend: "agents-mf",
    brief: "llm.actions.agents_show_sessions_list.brief",
    description: "llm.actions.agents_show_sessions_list.description",
  },
  exposure: "user",
  priority: "normal",
  invoke: () => {
    bus.present({ widget: createSessionsListWidget(bus) });
  },
});

const createShowToolsListAction: CreateAction<any> = (bus) => ({
  id: SHOW_TOOLS_LIST,
  llm: {
    microfrontend: "agents-mf",
    brief: "llm.actions.agents_show_tools_list.brief",
    description: "llm.actions.agents_show_tools_list.description",
  },
  exposure: "user",
  priority: "normal",
  invoke: () => {
    bus.present({ widget: createToolsListWidget(bus) });
  },
});

const createViewSessionAction: CreateAction<any> = (bus) => ({
  id: VIEW_SESSION,
  llm: {
    microfrontend: "agents-mf",
    brief: "llm.actions.agents_view_session.brief",
    description: "llm.actions.agents_view_session.description",
  },
  exposure: "llm",
  priority: "normal",
  invoke: ({ recordId }) => {
    openSessionDetail({ recordId });
  },
});

const createDeleteSessionAction: CreateAction<any> = () => ({
  id: DELETE_SESSION,
  llm: {
    microfrontend: "agents-mf",
    brief: "llm.actions.agents_delete_session.brief",
    description: "llm.actions.agents_delete_session.description",
  },
  exposure: "llm",
  priority: "normal",
  invoke: ({ recordId }) => {
    deleteSessionEvent({ recordId });
  },
});

const ACTIONS = [
  createShowSessionsListAction,
  createShowToolsListAction,
  createViewSessionAction,
  createDeleteSessionAction,
];

export {
  SHOW_SESSIONS_LIST,
  SHOW_TOOLS_LIST,
  VIEW_SESSION,
  DELETE_SESSION,
  createShowSessionsListAction,
  createShowToolsListAction,
  createViewSessionAction,
  createDeleteSessionAction,
};

export default ACTIONS;
