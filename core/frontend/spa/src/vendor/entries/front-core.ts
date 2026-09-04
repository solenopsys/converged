/**
 * The object runtime and the surface UI kit. This is the shared instance:
 * the shell registers the loader and surfaces register their definitions.
 */
export * from "front-core";
// The import map resolves `front-core/shell` to this delivery facade too.
// Keep the surface loader public for mandatory bootstrap modules.
export {
	loadSurface,
	loadSurfaceForOperation,
	loadSurfaceForType,
} from "../../../../front-core/src/shell/sf";
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

// The 3D preview: `sf-requests` renders it for every analysed model, so the
// specifier has to resolve. `@google/model-viewer` is behind a dynamic import
// inside it, so it stays out of this bundle and loads on first render.
export { ModelViewer } from "../../../../front-core/src/model3d";

/**
 * The landing block registry: it must be the exact same one `LandingView`
 * uses inside the shell — the project registers the blocks, the core renders them.
 */
export * from "front-core/landing";
