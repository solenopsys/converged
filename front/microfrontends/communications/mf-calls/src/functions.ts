import { CreateAction, CreateWidget, upsertSidebarTab } from "front-core";
import { CallsListView } from "./views/CallsListView";
import { ActiveCallView } from "./views/ActiveCallView";
import { CallTranscriptView } from "./views/CallTranscriptView";
import { startNewCallClicked, openCallDetail, returnToListClicked } from "./domain-calls";

// ── Action IDs ───────────────────────────────────────────────────────────────
// Context management lives in mf-contexts now (ms-contexts), not here.
export const SHOW_CALLS = "calls.show";
export const NEW_CALL = "calls.new";
export const VIEW_CALL = "calls.view";
export const RETURN_TO_CALLS = "calls.return";

// Sidebar tab the transcript view mounts into. Without a registered tab the
// "sidebar:right" slot has no mount point and the widget silently fails to
// render (SlotPortal: "Mount point not found"). Mirrors the chats' history tab.
const CALL_TRANSCRIPT_TAB_ID = "call-transcript";

// ── Widget factories ─────────────────────────────────────────────────────────
const createCallsListWidget: CreateWidget<typeof CallsListView> = (bus) => ({
  view: CallsListView,
  placement: () => "center",
  config: { bus },
});

const createActiveCallWidget = (bus: any) => ({
  view: ActiveCallView,
  placement: () => "center" as const,
  config: {
    bus,
    onBack: () => bus.run(SHOW_CALLS),
  },
});

const createCallTranscriptWidget = (_bus: any, sessionId: string) => ({
  view: CallTranscriptView,
  placement: () => `sidebar:tab:${CALL_TRANSCRIPT_TAB_ID}`,
  config: { sessionId },
  commands: {},
});

// ── Action creators ──────────────────────────────────────────────────────────
const createShowCallsAction: CreateAction<any> = (bus) => ({
  id: SHOW_CALLS,
  description: "Show calls list",
  invoke: () => {
    // Reset any lingering active-call / detail state so the list is shown
    returnToListClicked();
    bus.present({ widget: createCallsListWidget(bus) });
  },
});

const createNewCallAction: CreateAction<any> = (bus) => ({
  id: NEW_CALL,
  description: "Start a new AI call",
  invoke: () => {
    startNewCallClicked();
    bus.present({ widget: createActiveCallWidget(bus) });
  },
});

const createViewCallAction: CreateAction<any> = (bus) => ({
  id: VIEW_CALL,
  description: "View call transcript and recording in the side panel",
  invoke: ({ sessionId }: { sessionId: string }) => {
    if (!sessionId) return;
    // Register the sidebar tab first so the slot has a mount point, then
    // present the transcript widget into it (same flow as the chats history).
    upsertSidebarTab({
      id: CALL_TRANSCRIPT_TAB_ID,
      title: "Transcript",
      iconName: "phone",
      order: 999,
    });
    openCallDetail({ sessionId });
    bus.present({ widget: createCallTranscriptWidget(bus, sessionId) });
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
