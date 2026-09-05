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
	return ref.title ?? view.label ?? type?.pluralLabel ?? type?.label ?? ref.type;
}

referencePresented.watch(({ ref, view, options }) => {
	const type = objectRegistry.type(ref.type);
	const View = view.component;
	if (!View) return;
	const permanent = options.key === undefined && ref.kind === "set";
	const key =
		options.key ??
		(permanent
			? projectionKey(view.id)
			: `${ref.kind}:${ref.type}:${selectionKey(ref)}`);
	// Presenting something is pressing a button inside the tab that owns it, not
	// opening a tab of its own. The owner has been recorded here all along; it is
	// the surface, and this is the one line that makes the second level real.
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
		...(permanent ? { permanent: true } : {}),
		...(options.source === undefined ? {} : { source: options.source }),
	});
});
