import type { TokenSet, TokenStorage } from "./types";

/** Test and non-persistent storage adapter. */
export function createMemoryTokenStorage(initial?: TokenSet | null): TokenStorage {
	let current = initial ?? null;
	return {
		read: () => current,
		write: (tokens) => { current = tokens; },
		clear: () => { current = null; },
	};
}
