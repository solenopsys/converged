import { actionCommand } from "front-core/core";
import {
	$activeWorkspaceTab,
	$workspaceTabs,
	workspaceTabActivated,
} from "./workspace";

const CONSOLE_PATH = "/console";
const MOUNT_PARAM = "mount";

let installed = false;
let restoring = false;

export function mountActionFromUrl(href: string): string | null {
	const url = new URL(href, "http://localhost");
	return url.pathname === CONSOLE_PATH ? url.searchParams.get(MOUNT_PARAM) : null;
}

export function urlForMountAction(
	href: string,
	mountActionId: string | null,
): string {
	const url = new URL(href, "http://localhost");
	url.pathname = CONSOLE_PATH;
	if (mountActionId) url.searchParams.set(MOUNT_PARAM, mountActionId);
	else url.searchParams.delete(MOUNT_PARAM);
	return `${url.pathname}${url.search}${url.hash}`;
}

function currentMountAction(): string | null {
	return mountActionFromUrl(window.location.href);
}

function pushMountAction(mountActionId: string | null): void {
	const next = urlForMountAction(window.location.href, mountActionId);
	if (`${window.location.pathname}${window.location.search}${window.location.hash}` === next)
		return;
	window.history.pushState(window.history.state, "", next);
}

async function restoreFromLocation(): Promise<void> {
	const actionId = currentMountAction();
	if (!actionId) return;

	const matched = $workspaceTabs
		.getState()
		.find((tab) => tab.mountActionId === actionId);
	if (matched) {
		workspaceTabActivated(matched.key);
		return;
	}

	restoring = true;
	try {
		await actionCommand({ actionId });
	} catch (error) {
		console.error(`[shell] Failed to restore mounted action "${actionId}"`, error);
	} finally {
		restoring = false;
	}
}

/** Keeps the recreatable central workspace tab addressable at `/console?mount=`. */
export function bootstrapWorkspaceUrl(): void {
	if (installed || typeof window === "undefined") return;
	installed = true;

	$activeWorkspaceTab.updates.watch((tab) => {
		if (restoring) return;
		pushMountAction(tab?.mountActionId ?? null);
	});
	window.addEventListener("popstate", () => {
		void restoreFromLocation();
	});
	void restoreFromLocation();
}
