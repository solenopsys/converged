import { bus } from "front-core/core";
import type { DomainRef } from "front-core/object-runtime";
import { objectRegistry, referencePresented } from "front-core/object-runtime";
import { subtabOpened } from "./workspace";

function selectionKey(ref: DomainRef): string {
	if (ref.kind === "object") return ref.id;
	if (ref.selection.kind === "ids") return ref.selection.ids.join(",");
	return JSON.stringify({
		filter: ref.selection.filter ?? {},
		presets: ref.selection.presets ?? [],
	});
}

referencePresented.watch(({ ref, view, options }) => {
	const type = objectRegistry.type(ref.type);
	const View = view.component;
	if (!View) return;
	// Presenting something is pressing a button inside the tab that owns it, not
	// opening a tab of its own. The owner has been recorded here all along; it is
	// the surface, and this is the one line that makes the second level real.
	subtabOpened({
		key: options.key ?? `${ref.kind}:${ref.type}:${selectionKey(ref)}`,
		surface: type?.owner ?? ref.type.split(".", 1)[0] ?? "workspace",
		title:
			options.title ??
			ref.title ??
			(ref.kind === "set" ? type?.pluralLabel : type?.label) ??
			ref.type,
		view: View,
		props: { reference: ref, bus, ...(view.props?.(ref) ?? {}) },
		ref,
		viewId: view.id,
		...(options.source === undefined ? {} : { source: options.source }),
	});
});
