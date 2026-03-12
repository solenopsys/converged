import { CreateAction, CreateWidget } from "front-core";
import ContextViewer from "../views/ContextView";
import { $selectedContext, openContextDetail } from "../domain-contexts";

const SHOW_CONTEXT = "show_context";

const createContextWidget: CreateWidget<typeof ContextViewer> = (bus) => ({
  view: ContextViewer,
  placement: () => "sidebar:tab:dag",
  config: { contextStore: $selectedContext },
  commands: {},
});

const createShowContextAction: CreateAction<any> = (bus) => ({
  id: SHOW_CONTEXT,
  description: "Show context",
  invoke: ({ contextId }: { contextId: string }) => {
    openContextDetail({ contextId });
    bus.present({ widget: createContextWidget(bus), params: { contextId } });
  },
});

export {
  SHOW_CONTEXT,
  createShowContextAction,
  createContextWidget,
  openContextDetail,
};

const ACTIONS = [createShowContextAction];

export default ACTIONS;
