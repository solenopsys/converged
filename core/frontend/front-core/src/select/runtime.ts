import type { SetRef } from "../object-runtime";

export type ActiveSelectionContext = {
	ref: SetRef;
	tabKey?: string;
};

let resolver: (() => ActiveSelectionContext | null) | undefined;

export function setActiveSelectionResolver(
	next: (() => ActiveSelectionContext | null) | undefined,
): void {
	resolver = next;
}

export function activeSelection(): ActiveSelectionContext | null {
	return resolver?.() ?? null;
}
