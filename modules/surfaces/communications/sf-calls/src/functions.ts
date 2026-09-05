import type { CreateAction } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";
import {
	openCallDetail,
	returnToListClicked,
	startNewCallClicked,
} from "./domain-calls";
import { ActiveCallView } from "./views/ActiveCallView";
import { CallTranscriptView } from "./views/CallTranscriptView";
import { webCallRequested } from "./web-call/controller";
import { mountWebCallWidget } from "./web-call/mount";

// ── Action IDs ───────────────────────────────────────────────────────────────
// Context management lives in sf-contexts now (rp-contexts), not here.
export const SHOW_CALLS = "calls.show";
export const NEW_CALL = "calls.new";
export const VIEW_CALL = "calls.view";
export const RETURN_TO_CALLS = "calls.return";
export const START_WEB_CALL = "calls.web.start";

// Sidebar tab the transcript view mounts into. Without a registered tab the
// "sidebar:right" slot has no mount point and the widget silently fails to
// render (SlotPortal: "Mount point not found"). Mirrors the chats' history tab.
const CALL_TRANSCRIPT_TAB_ID = "call-transcript";

// ── Widget factories ─────────────────────────────────────────────────────────
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
const createShowCallsAction: CreateAction = () => ({
	id: SHOW_CALLS,
	invoke: () => {
		// Reset any lingering active-call / detail state so the list is shown
		returnToListClicked();
		void presentReference(setRef("calls.call", { kind: "query" }));
	},
});

const createNewCallAction: CreateAction<any> = (bus) => ({
	id: NEW_CALL,
	invoke: () => {
		startNewCallClicked();
		bus.present({ widget: createActiveCallWidget(bus) });
	},
});

const createViewCallAction: CreateAction<any> = (bus) => ({
	id: VIEW_CALL,
	invoke: ({ sessionId }: { sessionId: string }) => {
		if (!sessionId) return;
		openCallDetail({ sessionId });
		bus.present({
			widget: createCallTranscriptWidget(bus, sessionId),
			tab: { key: `${VIEW_CALL}:${sessionId}`, title: `Call ${sessionId}` },
		});
	},
});

const createReturnToCallsAction: CreateAction = () => ({
	id: RETURN_TO_CALLS,
	invoke: () => {
		returnToListClicked();
		void presentReference(setRef("calls.call", { kind: "query" }));
	},
});

const createStartWebCallAction: CreateAction<{
	contextName?: string;
}> = () => ({
	id: START_WEB_CALL,
	invoke: ({ contextName } = {}) => {
		mountWebCallWidget();
		webCallRequested(contextName);
	},
});

// ── Export ───────────────────────────────────────────────────────────────────
const ACTIONS = [
	createShowCallsAction,
	createNewCallAction,
	createViewCallAction,
	createReturnToCallsAction,
	createStartWebCallAction,
];

export {
	createNewCallAction,
	createReturnToCallsAction,
	createShowCallsAction,
	createStartWebCallAction,
	createViewCallAction,
};

export default ACTIONS;
