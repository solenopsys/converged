import { microfrontends } from "./layout";
import { createImportMap, type ImportMap } from "../import-map";

/**
 * One layer — one file. The import map is the main linking mechanism:
 * everything in it becomes `external` for every bundle, so a second instance
 * of preact, effector, the function catalog, or the WS transport can never
 * appear on the page.
 *
 * Microfrontends are resolved by name: `mf-functions` → `/mf/functions.js`.
 * The bundler doesn't need to know about them; `import("mf-functions")` works at runtime.
 *
 * SSR reads the map too: it goes into the `<script type="importmap">` first,
 * before any `modulepreload` — otherwise the browser ignores it.
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

/** The map's specifiers are also the `external` list for every delivery bundle. */
export const importMapSpecifiers = Object.keys(importMap.imports);
