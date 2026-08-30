import { type DomainRef, presentReference } from "front-core/object-runtime";
import {
	$activeWorkspaceTab,
	$workspaceTabs,
	workspaceTabActivated,
} from "./workspace";

const CONSOLE_PATH = "/console";
const REF_PARAM = "ref";

let installed = false;
let restoring = false;

export function referenceFromUrl(href: string): DomainRef | null {
	const url = new URL(href, "http://localhost");
	if (url.pathname !== CONSOLE_PATH) return null;
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
	if (!ref) return;
	const matched = $workspaceTabs
		.getState()
		.find((tab) => tab.ref && sameReference(tab.ref, ref));
	if (matched) {
		workspaceTabActivated(matched.key);
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

	$activeWorkspaceTab.updates.watch((tab) => {
		if (restoring) return;
		const next = urlForReference(window.location.href, tab?.ref ?? null);
		const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (current !== next)
			window.history.pushState(window.history.state, "", next);
	});
	window.addEventListener("popstate", () => {
		void restoreFromLocation();
	});
	void restoreFromLocation();
}
