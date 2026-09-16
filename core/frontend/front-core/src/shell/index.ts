export { AppShell } from "./AppShell";
export {
	AppShellFrame,
	type AppShellMountConfig,
} from "./AppShellFrame";
export { bootstrapAppShell } from "./bootstrap";
export { ConsoleRoot } from "./ConsoleRoot";
export {
	$composerPlacement,
	$draft,
	$panelOpen,
	type ComposerPlacement,
	draftChanged,
	draftCleared,
	pageScrolled,
	panelClosed,
	panelOpened,
	panelToggled,
} from "./panel";
export { type OpenRecordTabRequest, openRecordTab } from "./record-tabs";
export { Surface } from "./SurfaceView";
export {
	loadSurface,
	loadSurfaceForOperation,
	loadSurfaceForType,
} from "./sf";
export {
	$currentSurface,
	$surfaceStack,
	closeSurface,
	popSurface,
	pushSurface,
	replaceSurface,
	resetSurfaces,
	type SurfaceEntry,
} from "./surface";
export { TopBar, type TopBarLink } from "./TopBar";
export {
	getTopBarCommands,
	registerTopBarCommands,
	TopBarCommands,
	type TopBarCommand,
} from "./topbar-commands";
export { LanguageMenu, ThemeToggle, TopBarSettings } from "./TopBarControls";
export {
	registerWorkspaceTabActions,
	type WorkspaceTabAction,
	type WorkspaceTabActionDecl,
	type WorkspaceTabActionProvider,
	workspaceTabActionInvoked,
} from "./tab-actions";
export { WorkspaceTopBar } from "./WorkspaceTopBar";
export type { OpenSubtab, SurfaceTab, WorkspaceSubtab } from "./workspace";
export {
	$activeSubtabs,
	$activeSurface,
	$pressedSubtab,
	$surfaceTabs,
	$workspaceMounted,
	menus,
	OVERVIEW,
	projectionKey,
	runCommandFx,
	subtabActivated,
	subtabClosed,
	subtabOpened,
	subtabReleased,
	surfaceClosed,
	surfaceMounted,
	surfacePinToggled,
	surfaces,
	workspaceReset,
} from "./workspace";
export {
	menuBarText,
	navMenuList,
	navSurfaceList,
	surfaceBarText,
	surfaceMenuBar,
	surfaceStrip,
} from "./workspace-bars";
export { startWorkspaceLayouts } from "./workspace-layouts";
export {
	bootstrapWorkspaceUrl,
	isConsolePath,
	referenceFromUrl,
	urlForReference,
} from "./workspace-url";
