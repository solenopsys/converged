import { createImportMap, type ImportMap } from "./import-map";
import { manifest } from "./pwa-manifest";
import { join } from "node:path";

const pwaEnabled =
	process.env.NODE_ENV === "production" ||
	process.env.PWA_DEV === "1" ||
	process.env.PWA_DEV === "true";

const fallbackImportMap = createImportMap(
	(process.env.MICROFRONTENDS?.split(",") ?? ["functions", "static"])
		.map((name) => name.trim().replace(/^mf-/, ""))
		.filter(Boolean),
);


async function deliveryImportMap() {
	const deliveryDir =
		process.env.FRONT_DELIVERY_DIR?.trim() ||
		join(process.cwd(), "dist", "front");
	const file = Bun.file(join(deliveryDir, "import-map.json"));
	if (!(await file.exists())) return fallbackImportMap;

	try {
		return (await file.json()) as ImportMap;
	} catch {
		return fallbackImportMap;
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
