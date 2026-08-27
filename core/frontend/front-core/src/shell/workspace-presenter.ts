import { registry, widgetPresented } from "front-core/core";
import { workspaceTabOpened } from "./workspace";

function ownerFor(actionId: string): string {
	return actionId.split(".", 1)[0] ?? actionId;
}

function titleFor(actionId: string | undefined, view: Function): string {
	if (!actionId) return view.displayName || view.name || "Workspace";
	const action = registry.meta(actionId);
	return action?.brief ?? action?.description ?? actionId;
}

widgetPresented.watch(({ actionId, params, widget, tab }) => {
	const View = widget.view;
	const fallbackKey =
		actionId ?? `view:${View.displayName || View.name || "workspace"}`;
	const commands = Object.fromEntries(
		Object.entries(widget.commands ?? {}).map(([name, handler]) => [
			name,
			(payload: unknown) => handler(payload),
		]),
	);

	workspaceTabOpened({


		key: tab?.key ?? fallbackKey,
		owner: actionId ? ownerFor(actionId) : "workspace",
		...(actionId ? { mountActionId: actionId } : {}),
		title: tab?.title ?? titleFor(actionId, View),
		view: View,
		props: { ...widget.config, ...params, ...commands },
		...(tab?.pinned === undefined ? {} : { pinned: tab.pinned }),
	});
});
