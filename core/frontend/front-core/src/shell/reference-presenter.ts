import { bus } from "front-core/core";
import type { DomainRef } from "front-core/object-runtime";
import { objectRegistry, referencePresented } from "front-core/object-runtime";
import { projectionKey, subtabClosed, subtabOpened } from "./workspace";

function selectionKey(ref: DomainRef): string {
	if (ref.kind === "object") return ref.id;
	if (ref.selection.kind === "ids") return ref.selection.ids.join(",");
	return JSON.stringify({
		filter: ref.selection.filter ?? {},
		presets: ref.selection.presets ?? [],
	});
}

function subtabTitle(
	ref: DomainRef,
	type: ReturnType<typeof objectRegistry.type>,
	view: { label?: string },
	explicitTitle: string | undefined,
): string {
	if (explicitTitle !== undefined) return explicitTitle;
	if (ref.kind === "object") {
		const label = type?.label ?? ref.type;
		return `${label}[${ref.title ?? ref.id}]`;
	}
	return (
		ref.title ?? view.label ?? type?.pluralLabel ?? type?.label ?? ref.type
	);
}

referencePresented.watch(({ ref, view, options }) => {
	const type = objectRegistry.type(ref.type);
	const View = view.component;
	if (!View) return;
	// A set, filtered or not, is shown in its projection: it reuses the menu's
	// own item, so presenting it and choosing it from the catalog land on the same tab.
	const key =
		options.key ??
		(ref.kind === "set"
			? projectionKey(view.id)
			: `${ref.kind}:${ref.type}:${selectionKey(ref)}`);
	// Presenting something opens it inside the surface that owns it, as the
	// transient tab — never as a tab of its own in the strip.
	subtabOpened({
		key,
		surface: type?.owner ?? ref.type.split(".", 1)[0] ?? "workspace",
		title: subtabTitle(ref, type, view, options.title),
		view: View,
		props: {
			reference: ref,
			bus,
			onClose: () => subtabClosed(key),
			...(view.props?.(ref) ?? {}),
		},
		ref,
		viewId: view.id,
		icon: ref.kind === "object" ? "Form" : "Table",
		...(options.source === undefined ? {} : { source: options.source }),
	});
});
