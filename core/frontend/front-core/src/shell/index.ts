export { ActionMenu, type ActionMenuItem } from "./ActionMenu";
export { AppShell } from "./AppShell";
export {
	AppShellFrame,
	type AppShellMountConfig,
} from "./AppShellFrame";
export { bootstrapAppShell } from "./bootstrap";
export { loadMicrofrontend, loadMicrofrontendForAction } from "./mf";
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
export { registerScreens } from "./screens";
export {
	$canGoBack,
	$currentSurface,
	$surfaceStack,
	closeSurface,
	popSurface,
	pushSurface,
	replaceSurface,
	resetSurfaces,
	type SurfaceEntry,
} from "./surface";
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
export type { OpenWorkspaceTab, WorkspaceTab } from "./workspace";
export {
	$activeWorkspaceTab,
	$activeWorkspaceTabKey,
	$workspace,
	$workspaceTabs,
	activeWorkspaceTabClosed,
	workspaceReset,
	workspaceTabActivated,
	workspaceTabClosed,
	workspaceTabOpened,
	workspaceTabPinToggled,
	workspaceUnpinnedTabsCleared,
} from "./workspace";
