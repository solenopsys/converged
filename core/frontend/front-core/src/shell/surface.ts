import {
	$activeSubtabs,
	$activeSurface,
	$pressedSubtab,
	subtabClosed,
	subtabOpened,
	subtabReleased,
	workspaceReset,
} from "./workspace";

export type SurfaceEntry = import("./workspace").WorkspaceSubtab;

// Compatibility aliases for callers still speaking the old stack vocabulary.
// They now act on the second level: what used to be "push a surface" is
// "press a button inside one".
export const pushSurface = subtabOpened;
export const replaceSurface = subtabOpened;
export const popSurface = () => {
	const surface = $activeSurface.getState();
	if (surface) subtabReleased(surface);
};
export const closeSurface = subtabClosed;
export const resetSurfaces = workspaceReset;
export const $surfaceStack = $activeSubtabs;
export const $currentSurface = $pressedSubtab;
