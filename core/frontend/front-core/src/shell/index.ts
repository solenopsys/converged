export {
	ActionMenu,
	type ActionMenuItem,
	ActionMenuList,
} from "./ActionMenu";
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
export { TabStrip } from "./TabStrip";
export { TopBar, type TopBarLink, type TopBarTab } from "./TopBar";
export { LanguageMenu, ThemeToggle, TopBarSettings } from "./TopBarControls";
export {
	$workspaceTabViews,
	registerWorkspaceTabActions,
	type WorkspaceTabAction,
	type WorkspaceTabActionDecl,
	type WorkspaceTabActionProvider,
	type WorkspaceTabView,
	workspaceTabActionInvoked,
} from "./tab-actions";
export { WorkspaceTopBar } from "./WorkspaceTopBar";
export type { OpenSubtab, SurfaceTab, WorkspaceSubtab } from "./workspace";
export {
	$activeSubtabs,
	$activeSurface,
	$pressedSubtab,
	$surfaceTabs,
	$workspace,
	$workspaceMounted,
	$workspaceSubtabs,
	subtabActivated,
	subtabClosed,
	subtabOpened,
	subtabReleased,
	surfaceActivated,
	surfaceClosed,
	surfaceMounted,
	surfacePinToggled,
	workspaceReset,
} from "./workspace";
export {
	bootstrapWorkspaceUrl,
	isConsolePath,
	referenceFromUrl,
	urlForReference,
} from "./workspace-url";
