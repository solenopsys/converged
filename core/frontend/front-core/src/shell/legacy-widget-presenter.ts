import { widgetPresented } from "front-core/core";
import { workspaceTabOpened } from "./workspace";

widgetPresented.watch(({ params, widget, tab }) => {
	const View = widget.view;
	const viewName = View.displayName || View.name || "workspace";
	const commands = Object.fromEntries(
		Object.entries(widget.commands ?? {}).map(([name, handler]) => [
			name,
			(payload: unknown) => handler(payload),
		]),
	);

	workspaceTabOpened({
		key: tab?.key ?? `legacy:${viewName}`,
		owner: "legacy",
		title: tab?.title ?? viewName,
		view: View,
		props: { ...widget.config, ...params, ...commands },
		...(tab?.pinned === undefined ? {} : { pinned: tab.pinned }),
	});
});
