/**
 * Каталог функций, шина и UI-кит микрофронтендов. Тот самый общий инстанс:
 * оболочка регистрирует загрузчик и читает `SCREENS`, микрофронтенды кладут в
 * этот же каталог свои функции.
 */
export * from "front-core";
// The import map resolves `front-core/shell` to this delivery facade too.
// Keep the microfrontend loader public for mandatory bootstrap modules.
export { loadMicrofrontend, loadMicrofrontendForAction } from "../../../../front-core/src/shell/mf";
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
 * Реестр блоков лендинга: он обязан быть тем же самым, что использует
 * `LandingView` внутри оболочки, — блоки регистрирует проект, а рисует ядро.
 */
export * from "front-core/landing";
