import { microfrontends } from "./layout";
import { createImportMap, type ImportMap } from "../import-map";

/**
 * Один слой — один файл. Карта импорта — основной механизм линковки: всё, что
 * в ней есть, становится `external` для каждого бандла, поэтому второго
 * инстанса preact, effector, каталога функций или WS-транспорта на странице
 * появиться не может.
 *
 * Микрофронтенды резолвятся по имени: `mf-functions` → `/mf/functions.js`.
 * Бандлеру про них знать не нужно, `import("mf-functions")` работает в рантайме.
 *
 * Карту читает и SSR: она уезжает в `<script type="importmap">` первой, до
 * любого `modulepreload`, — иначе браузер её игнорирует.
 */
export const importMap = createImportMap(microfrontends);
export type { ImportMap };

/**
 * The delivery files use stable names, so each build appends its content
 * revision to import targets. This prevents an immutable HTTP cache from
 * serving a previous vendor bundle after a UI rollout.
 */
export function versionImportMap(buildId: string): ImportMap {
	return {
		imports: Object.fromEntries(
			Object.entries(importMap.imports).map(([name, url]) => [
				name,
				`${url}?v=${encodeURIComponent(buildId)}`,
			]),
		),
	};
}

/** Спецификаторы карты — они же `external` любого бандла поставки. */
export const importMapSpecifiers = Object.keys(importMap.imports);
