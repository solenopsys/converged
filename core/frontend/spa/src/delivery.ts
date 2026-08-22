import { join } from "node:path";
import { createImportMap, type ImportMap } from "./import-map";
import { manifest } from "./pwa-manifest";

const pwaEnabled =
	process.env.NODE_ENV === "production" ||
	process.env.PWA_DEV === "1" ||
	process.env.PWA_DEV === "true";

const fallbackImportMap = createImportMap(
	(process.env.MICROFRONTENDS?.split(",") ?? ["functions", "static"])
		.map((name) => name.trim().replace(/^mf-/, ""))
		.filter(Boolean),
);

/**
 * Which microfrontends the page may load is a runtime decision — ptah merges
 * the active solutions and publishes the result — while the delivery's own map
 * was written when the image was built. So the two are joined here: the built
 * map supplies preact, effector, front-core and the rest, and the Solution
 * supplies the module names.
 *
 * The targets stay `/mf/<name>.js`. The browser is never told a digest: the ui
 * server resolves the name against the registry mapping, which is what keeps a
 * rollout from having to reach the page.
 */
export function solutionModules(): string[] {
	const raw = process.env.FRONTEND_MODULES?.trim();
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((name): name is string => typeof name === "string")
			.map((name) => name.trim().replace(/^mf-/, ""))
			.filter(Boolean);
	} catch {
		console.warn("[spa] FRONTEND_MODULES is not a JSON array, ignoring");
		return [];
	}
}

function withSolutionModules(map: ImportMap): ImportMap {
	const names = solutionModules();
	if (names.length === 0) return map;
	return {
		imports: {
			// The Solution replaces the map's module entries rather than adding to
			// them. Merging would leave whatever the delivery was built with — the
			// dev defaults, in the fallback map — resolvable on a page whose
			// solution never listed it, and `/mf/<name>.js` would 404 on a
			// specifier the import map itself advertised.
			...Object.fromEntries(
				Object.entries(map.imports).filter(
					([specifier]) => !specifier.startsWith("mf-"),
				),
			),
			...Object.fromEntries(
				names.map((name) => [`mf-${name}`, `/mf/${name}.js`]),
			),
		},
	};
}

async function deliveryImportMap() {
	const deliveryDir =
		process.env.FRONT_DELIVERY_DIR?.trim() ||
		join(process.cwd(), "dist", "front");
	const file = Bun.file(join(deliveryDir, "import-map.json"));
	if (!(await file.exists())) return withSolutionModules(fallbackImportMap);

	try {
		return withSolutionModules((await file.json()) as ImportMap);
	} catch {
		return withSolutionModules(fallbackImportMap);
	}
}

export async function importMapScript(): Promise<string> {
	return `<script type="importmap">${JSON.stringify(await deliveryImportMap())}</script>`;
}

export function preloadTags(): string {
	return [
		'<link rel="preload" as="style" href="/assets/chat.css" />',
		'<link rel="modulepreload" href="/assets/index.js" />',
		'<link rel="modulepreload" href="/vendor/preact.js" />',
	].join("");
}

export function stylesheetTags(): string {
	return '<link rel="stylesheet" href="/assets/index.css" />';
}

export function appScriptTag(): string {
	return '<script type="module" src="/assets/index.js"></script>';
}

export function pwaHeadTags(): string {
	if (!pwaEnabled) return "";
	return [
		'<link rel="manifest" href="/manifest.webmanifest" />',
		'<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
		'<meta name="apple-mobile-web-app-capable" content="yes" />',
		'<meta name="mobile-web-app-capable" content="yes" />',
		'<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
		`<meta name="apple-mobile-web-app-title" content="${manifest.short_name}" />`,
		`<meta name="application-name" content="${manifest.short_name}" />`,
	].join("");
}

export function pwaBootstrapScript(): string {
	if (!pwaEnabled) {
		return (
			"<script>(()=>{if(!('serviceWorker' in navigator))return;" +
			"navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));" +
			"if(self.caches)caches.keys().then(ks=>ks.filter(k=>k.startsWith('hw-')).forEach(k=>caches.delete(k)));" +
			"})();</script>"
		);
	}

	return (
		"<script>(()=>{if(!('serviceWorker' in navigator))return;" +
		"const r=()=>navigator.serviceWorker.register('/sw.js').catch(e=>console.warn('[pwa]',e));" +
		"if(document.readyState==='complete')r();" +
		"else addEventListener('load',r,{once:true});})();</script>"
	);
}
