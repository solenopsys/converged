import { createDomain } from "effector";
import type { DomainRef } from "./types";

// What the conversation is working on.
//
// Not "what is on screen". A tab is a place to look; work is what the person is
// in the middle of. Those came apart every time the shell was asked, which is
// why an open audit was invisible to the assistant: the shell only ever offered
// the active tab, and only when it held a set. Switching tabs, opening a second
// audit or closing the first one all changed the answer, none of them ended the
// work.
//
// So the list lives here, beside the registry, and changes only when something
// is opened, dropped, or pushed out by age. Navigation does not touch it.
//
// It replaces the per-module variables that did this by hand — sf-audit kept a
// `currentAuditId` set on mount and never cleared, so two open audits meant the
// answers went to whichever mounted last.

const domain = createDomain("object-focus");

export type FocusItem = {
	ref: DomainRef;
	/** Shown to the user and to the model; the id alone means nothing to either. */
	label: string;
	/** Ordering is recency of work, not of mounting. */
	at: number;
};

/**
 * Beyond this the oldest is dropped. The list is repeated into every deciding
 * step's prompt, so it has to stay a sentence, not a history.
 */
const CAPACITY = 8;

export const focusAttached = domain.createEvent<FocusItem>("ATTACHED");
export const focusDetached = domain.createEvent<string>("DETACHED");
export const focusCleared = domain.createEvent<void>("CLEARED");

/** Same thing, however it was referenced. */
export const focusKey = (ref: DomainRef): string =>
	ref.kind === "object"
		? `${ref.type}#${ref.id}`
		: `${ref.type}#${JSON.stringify(ref.selection)}`;

export const $focus = domain
	.createStore<FocusItem[]>([], { name: "FOCUS" })
	.on(focusAttached, (items, item) => {
		const key = focusKey(item.ref);
		// Re-opening something already being worked on moves it to the front rather
		// than adding it twice: this is what makes the order mean "most recently
		// worked on" instead of "most recently mounted".
		return [
			item,
			...items.filter((known) => focusKey(known.ref) !== key),
		].slice(0, CAPACITY);
	})
	.on(focusDetached, (items, key) =>
		items.filter((item) => focusKey(item.ref) !== key),
	)
	.reset(focusCleared);

/**
 * Records that work is happening on something. Called where things are opened,
 * so it covers the user clicking through and the assistant navigating alike —
 * neither has to remember to declare it.
 */
export function attachToFocus(ref: DomainRef, label?: string): void {
	focusAttached({
		ref,
		label: label ?? ref.title ?? ref.type,
		at: Date.now(),
	});
}

/** Most recently worked on first. */
export function focusItems(): FocusItem[] {
	return $focus.getState();
}

/** Most recently focused reference of this type. */
export function focusedRef(type: string): DomainRef | undefined {
	return $focus.getState().find((item) => item.ref.type === type)?.ref;
}

/**
 * The one being worked on, for a module that needs to answer "which one" without
 * an id from the caller. This is what a module-level `let currentId` was for.
 */
export function focusedObject(type: string): string | undefined {
	for (const item of $focus.getState()) {
		if (item.ref.kind === "object" && item.ref.type === type)
			return item.ref.id;
	}
	return undefined;
}

/** Every ref of these types, newest first — what a call is pointed at. */
export function focusedRefs(types: readonly string[]): DomainRef[] {
	const wanted = new Set(types);
	return $focus
		.getState()
		.filter((item) => wanted.has(item.ref.type))
		.map((item) => item.ref);
}
