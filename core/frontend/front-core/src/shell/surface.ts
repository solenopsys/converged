import {
	$activeWorkspaceTab,
	$workspaceTabs,
	activeWorkspaceTabClosed,
	workspaceReset,
	workspaceTabClosed,
	workspaceTabOpened,
} from "./workspace";

export type SurfaceEntry = import("./workspace").WorkspaceTab;

// Compatibility aliases while callers move from a stack vocabulary to workspace tabs.
export const pushSurface = workspaceTabOpened;
export const replaceSurface = workspaceTabOpened;
export const popSurface = activeWorkspaceTabClosed;
export const closeSurface = workspaceTabClosed;
export const resetSurfaces = workspaceReset;
export const $surfaceStack = $workspaceTabs;
export const $currentSurface = $activeWorkspaceTab;
export const $canGoBack = $workspaceTabs.map((tabs) => tabs.length > 1);
