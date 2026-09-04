import { type ObjectRef, objectRef } from "front-core/object-runtime";
import type { ContextLanguage, ContextName } from "g-contexts";

export const ContextObject = {
	surface: "sf-contexts",
	type: "contexts.context",
	view: {
		editor: "contexts.context.edit",
		list: "contexts.context.table",
	},
} as const;

export type ContextIdentity = {
	name: ContextName;
	language: ContextLanguage;
};

const NEW_CONTEXT_ID = "new";

export function contextRef(context: ContextIdentity): ObjectRef {
	return objectRef(
		ContextObject.type,
		`${encodeURIComponent(context.language)}:${encodeURIComponent(context.name)}`,
		{ title: context.name },
	);
}

export function newContextRef(): ObjectRef {
	return objectRef(ContextObject.type, NEW_CONTEXT_ID, {
		title: "New context",
	});
}

export function contextFromRef(ref: ObjectRef): ContextIdentity | undefined {
	if (ref.type !== ContextObject.type || ref.id === NEW_CONTEXT_ID)
		return undefined;
	const separator = ref.id.indexOf(":");
	if (separator <= 0 || separator === ref.id.length - 1) return undefined;
	try {
		const language = decodeURIComponent(ref.id.slice(0, separator));
		const name = decodeURIComponent(ref.id.slice(separator + 1));
		return language && name ? { name, language } : undefined;
	} catch {
		return undefined;
	}
}
