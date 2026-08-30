import { bus } from "front-core/core";
import type { DomainRef } from "front-core/object-runtime";
import { objectRegistry, referencePresented } from "front-core/object-runtime";
import { workspaceTabOpened } from "./workspace";

function selectionKey(ref: DomainRef): string {
	if (ref.kind === "object") return ref.id;
	if (ref.selection.kind === "ids") return ref.selection.ids.join(",");
	return JSON.stringify(ref.selection.query);
}

referencePresented.watch(({ ref, view, options }) => {
	const type = objectRegistry.type(ref.type);
	const View = view.component;
	if (!View) return;
	workspaceTabOpened({
		key: options.key ?? `${ref.kind}:${ref.type}:${selectionKey(ref)}`,
		owner: type?.owner ?? ref.type.split(".", 1)[0] ?? "workspace",
		title:
			options.title ??
			ref.title ??
			(ref.kind === "set" ? type?.pluralLabel : type?.label) ??
			ref.type,
		view: View,
		props: { ref, bus, ...(view.props?.(ref) ?? {}) },
		ref,
		viewId: view.id,
		...(options.pinned === undefined ? {} : { pinned: options.pinned }),
	});
});
