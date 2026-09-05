import { type DomainRef, presentReference } from "front-core/object-runtime";
import {
	$pressedSubtab,
	$workspaceSubtabs,
	subtabActivated,
	workspaceReset,
} from "./workspace";

export const CONSOLE_PATH = "/console/";
const LEGACY_CONSOLE_PATH = "/console";
const REF_PARAM = "ref";

let installed = false;
let restoring = false;

export function isConsolePath(pathname: string): boolean {
	return pathname === CONSOLE_PATH || pathname === LEGACY_CONSOLE_PATH;
}

export function referenceFromUrl(href: string): DomainRef | null {
	const url = new URL(href, "http://localhost");
	if (!isConsolePath(url.pathname)) return null;
	const encoded = url.searchParams.get(REF_PARAM);
	if (!encoded) return null;
	try {
		const value = JSON.parse(encoded) as Partial<DomainRef>;
		if (
			(value.kind !== "object" && value.kind !== "set") ||
			typeof value.type !== "string"
		) {
			return null;
		}
		if (value.kind === "object" && typeof value.id !== "string") return null;
		if (value.kind === "set" && !value.selection) return null;
		return value as DomainRef;
	} catch {
		return null;
	}
}

export function urlForReference(href: string, ref: DomainRef | null): string {
	const url = new URL(href, "http://localhost");
	url.pathname = CONSOLE_PATH;
	if (ref) url.searchParams.set(REF_PARAM, JSON.stringify(ref));
	else url.searchParams.delete(REF_PARAM);
	return `${url.pathname}${url.search}${url.hash}`;
}

function sameReference(left: DomainRef, right: DomainRef): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

async function restoreFromLocation(): Promise<void> {
	const ref = referenceFromUrl(window.location.href);
	if (!ref) {
		if (isConsolePath(window.location.pathname)) workspaceReset();
		return;
	}
	const matched = $workspaceSubtabs
		.getState()
		.find((subtab) => subtab.ref && sameReference(subtab.ref, ref));
	if (matched) {
		subtabActivated(matched.key);
		return;
	}

	restoring = true;
	try {
		await presentReference(ref);
	} catch (error) {
		console.error(`[shell] Failed to restore ${ref.kind}<${ref.type}>`, error);
	} finally {
		restoring = false;
	}
}

/** Keeps the active object or set addressable at `/console?ref=`. */
export function bootstrapWorkspaceUrl(): void {
	if (installed || typeof window === "undefined") return;
	installed = true;

	// The address is the pressed subtab: the surface alone is a place to look,
	// while the reference is the thing being looked at.
	$pressedSubtab.updates.watch((subtab) => {
		if (restoring) return;
		const next = urlForReference(window.location.href, subtab?.ref ?? null);
		const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (current !== next)
			window.history.pushState(window.history.state, "", next);
	});
	window.addEventListener("popstate", () => {
		void restoreFromLocation();
	});
	void restoreFromLocation();
}
