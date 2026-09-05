import { widgetPresented } from "front-core/core";
import { subtabOpened } from "./workspace";

widgetPresented.watch(({ params, widget, tab }) => {
	const View = widget.view;
	const viewName = View.displayName || View.name || "workspace";
	const commands = Object.fromEntries(
		Object.entries(widget.commands ?? {}).map(([name, handler]) => [
			name,
			(payload: unknown) => handler(payload),
		]),
	);

	subtabOpened({
		key: tab?.key ?? `legacy:${viewName}`,
		surface: "legacy",
		title: tab?.title ?? viewName,
		view: View,
		props: { ...widget.config, ...params, ...commands },
	});
});
