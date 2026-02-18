import { CreateAction, CreateWidget } from "front-core";
import DocsView from "./views/DocsView";
import { getDocsSources } from "./env";

const SHOW_DOCS_HOME = "docs.show.home";

const createDocsWidget: CreateWidget<typeof DocsView> = (
  _bus,
  config: { indexPath: string; anchor?: string },
) => ({
  view: DocsView,
  placement: () => "center",
  config,
});

const createShowDocsAction: CreateAction<any> = (bus) => ({
  id: SHOW_DOCS_HOME,
  description: "Show docs",
  invoke: () => {
    const first = getDocsSources()[0];
    if (!first) return;
    presentDocs(bus, first.id);
  },
});

const ACTIONS = [createShowDocsAction];

export function presentDocs(bus: any, indexPath: string, anchor?: string) {
  bus.present({
    widget: createDocsWidget(bus, {
      indexPath,
      ...(anchor ? { anchor } : {}),
    }),
  });
}

export function docsSourceActionId(sourceKey: string): string {
  return `docs.show.${sourceKey}`;
}

export { createDocsWidget };
export { SHOW_DOCS_HOME };
export default ACTIONS;
