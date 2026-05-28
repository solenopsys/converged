import { CreateAction, CreateWidget } from "front-core";
import { CallsListView } from "./views/CallsListView";
import { ActiveCallView } from "./views/ActiveCallView";
import { CallDetailView } from "./views/CallDetailView";
import { startNewCallClicked, openCallDetail, returnToListClicked } from "./domain-calls";

// ── Action IDs ───────────────────────────────────────────────────────────────
export const SHOW_CALLS = "calls.show";
export const NEW_CALL = "calls.new";
export const VIEW_CALL = "calls.view";
export const RETURN_TO_CALLS = "calls.return";

// ── Widget factories ─────────────────────────────────────────────────────────
const createCallsListWidget: CreateWidget<typeof CallsListView> = (bus) => ({
  view: CallsListView,
  placement: () => "center",
  config: { bus },
});

export const createActiveCallWidget = (bus: any) => ({
  view: ActiveCallView,
  placement: () => "center" as const,
  config: {
    bus,
    onBack: () => returnToListClicked(),
  },
});

export const createCallDetailWidget = (bus: any, sessionId: string) => ({
  view: CallDetailView,
  placement: () => "center" as const,
  config: {
    bus,
    sessionId,
    onBack: () => returnToListClicked(),
  },
});

// ── Action creators ──────────────────────────────────────────────────────────
const createShowCallsAction: CreateAction<any> = (bus) => ({
  id: SHOW_CALLS,
  description: "Show calls list",
  invoke: () => {
    bus.present({ widget: createCallsListWidget(bus) });
  },
});

const createNewCallAction: CreateAction<any> = (bus) => ({
  id: NEW_CALL,
  description: "Start a new AI call",
  invoke: () => {
    startNewCallClicked();
    bus.present({ widget: createCallsListWidget(bus) });
  },
});

const createViewCallAction: CreateAction<any> = (bus) => ({
  id: VIEW_CALL,
  description: "View call details and recording",
  invoke: ({ sessionId }: { sessionId: string }) => {
    openCallDetail({ sessionId });
    bus.present({ widget: createCallsListWidget(bus) });
  },
});

const createReturnToCallsAction: CreateAction<any> = (bus) => ({
  id: RETURN_TO_CALLS,
  description: "Return to calls list",
  invoke: () => {
    returnToListClicked();
    bus.present({ widget: createCallsListWidget(bus) });
  },
});

// ── Export ───────────────────────────────────────────────────────────────────
const ACTIONS = [
  createShowCallsAction,
  createNewCallAction,
  createViewCallAction,
  createReturnToCallsAction,
];

export {
  createShowCallsAction,
  createNewCallAction,
  createViewCallAction,
  createReturnToCallsAction,
};

export default ACTIONS;
