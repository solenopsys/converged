/**
 * The object runtime and the microfrontend UI kit. This is the shared instance:
 * the shell registers the loader and microfrontends register their definitions.
 */
export * from "front-core";
// The import map resolves `front-core/shell` to this delivery facade too.
// Keep the microfrontend loader public for mandatory bootstrap modules.
export {
	loadMicrofrontend,
	loadMicrofrontendForOperation,
	loadMicrofrontendForType,
} from "../../../../front-core/src/shell/mf";
export {
	AppShellFrame,
	bootstrapAppShell,
	type AppShellMountConfig,
} from "../../../../front-core/src/shell";
export {
	createInfiniteTableStore,
	getTableColumns,
	InfiniteScrollDataTable,
} from "front-core/table";

/**
 * The landing block registry: it must be the exact same one `LandingView`
 * uses inside the shell — the project registers the blocks, the core renders them.
 */
export * from "front-core/landing";
