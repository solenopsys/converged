import type { CreateAction, CreateWidget } from "front-core";
import { $selectedContext, openContextDetail } from "../domain-contexts";
import ContextViewer from "../views/ContextView";

const SHOW_CONTEXT = "show_context";

const createContextWidget: CreateWidget<typeof ContextViewer> = (bus) => ({
	view: ContextViewer,
	placement: () => "sidebar:tab:dag",
	config: { contextStore: $selectedContext },
	commands: {},
});

const createShowContextAction: CreateAction<any> = (bus) => ({
	id: SHOW_CONTEXT,
	invoke: ({ contextId }: { contextId: string }) => {
		openContextDetail({ contextId });
		bus.present({ widget: createContextWidget(bus), params: { contextId } });
	},
});

export {
	createContextWidget,
	createShowContextAction,
	openContextDetail,
	SHOW_CONTEXT,
};

const ACTIONS = [createShowContextAction];

export default ACTIONS;
