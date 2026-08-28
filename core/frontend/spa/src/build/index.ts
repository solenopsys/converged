import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import {
	bundleApp,
	bundleAudit,
	bundleMicrofrontends,
	bundleWidget,
} from "./bundles";
import { writeFunctionIndex } from "./function-index";
import { versionImportMap } from "./import-map";
import {
	assetsDir,
	clientEntry,
	dist,
	embedPage,
	frontCoreRoot,
	isProduction,
	landingAuditSourceDir,
	landingBlocksEntry,
	landingBlocksStyles,
	microfrontendDir,
	microfrontends,
	microfrontendsDir,
	pwaEnabled,
	serviceWorkerEntry,
	spaRoot,
	storeWorkerBundle,
	vendorDir,
	vendorEntriesDir,
	widgetEntry,
} from "./layout";
import { buildServiceWorker, copyPwaIcons, writeManifest } from "./pwa";
import { measure, precompress, sizeRows } from "./report";
import { buildMicrofrontendStyles, buildStyles } from "./styles";
import { buildVendor, vendorLayerFiles } from "./vendor";

/**
 * Client delivery build: vendor layer, shell, microfrontends, widget, and
 * install layer. No HTML is built here — the first screen is rendered by SSR
 * (`front-ssr`), and the delivery only hands it the import map and install
 * tags (see ../delivery.ts).
 */

/** Everything the build result depends on: the dev server uses this list to decide whether to rebuild. */
export function sourceFiles(): string[] {
	const glob = new Bun.Glob("**/*.{ts,tsx,css,json}");
	const sources = (dir: string) =>
		Array.from(glob.scanSync({ cwd: dir, absolute: true }));
	const projectStyles = landingBlocksStyles();
	const auditSources = landingAuditSourceDir();
	return [
		join(frontCoreRoot, "../../../assets/converged.svg"),
		embedPage,
		// The project's landing blocks are part of startup: editing them must
		// rebuild the delivery just like editing the shell does.
		...sources(dirname(landingBlocksEntry())),
		...projectStyles,
		...(auditSources ? sources(auditSources) : []),
		join(spaRoot, "uno.config.ts"),
		join(spaRoot, "uno.mf.config.ts"),
		clientEntry,
		widgetEntry,
		serviceWorkerEntry,
		storeWorkerBundle,
		...sources(join(spaRoot, "src")),
		...sources(vendorEntriesDir),
		...sources(join(frontCoreRoot, "src")),
		...microfrontends.flatMap((name) => {
			const moduleDir = microfrontendDir(name);
			const localesDir = join(moduleDir, "locales");
			return [
				...sources(join(moduleDir, "src")),
				// The LLM manifest is embedded into the MF wrapper, so changing its
				// descriptions or schemas must invalidate a dev build too.
				join(moduleDir, "llm.json"),
				...(existsSync(localesDir)
					? Array.from(
							new Bun.Glob("*.json").scanSync({
								cwd: localesDir,
								absolute: true,
							}),
							)
						: []),
			];
		}),
	];
}

async function copyConvergedLogo(): Promise<string> {
	const source = Bun.file(join(frontCoreRoot, "../../../assets/converged.svg"));
	if (!(await source.exists())) {
		throw new Error("Missing Converged logo asset");
	}
	const target = join(assetsDir, "converged.svg");
	await Bun.write(target, source);
	return target;
}

async function copyStoreWorker(): Promise<string> {
	const source = Bun.file(storeWorkerBundle);
	if (!(await source.exists())) {
		throw new Error(
			`Missing store worker bundle: ${storeWorkerBundle} — run \`bun run src/tools/build.ts\` in front/libraries/files/store-workers`,
		);
	}
	const target = join(assetsDir, "store.worker.js");
	await Bun.write(target, source);
	return target;
}

/** Fingerprint of the build's content: same output — same cache. */
async function appSignature(appFiles: string[], styleFiles: string[]) {
	const contents = await Promise.all(
		[...appFiles, ...styleFiles].map((path) => Bun.file(path).text()),
	);
	return Bun.hash(contents.join("")).toString(36);
}

export async function buildApp() {
	await rm(dist, { force: true, recursive: true });
	await Promise.all([
		mkdir(assetsDir, { recursive: true }),
		mkdir(vendorDir, { recursive: true }),
		mkdir(microfrontendsDir, { recursive: true }),
	]);

	// The microfrontend layer is built first and separately: its CSS is glued
	// into the shared `mf.css`, so styles can't be built in parallel with chunks.
	const microfrontendBundles = await bundleMicrofrontends();
	const microfrontendFiles = microfrontendBundles.map(
		(bundle) => bundle.script,
	);
	const microfrontendModuleStyles = microfrontendBundles.flatMap(
		(bundle) => bundle.styles,
	);

	// The vendor graph shares package entrypoints with the browser bundles.
	// Build it first so Bun does not resolve those entrypoints concurrently.
	await buildVendor();

	const appFiles = await bundleApp();
	const auditFiles = await bundleAudit();
	const widgetFiles = await bundleWidget();
	const styleFiles = await buildStyles();
	const logoFile = await copyConvergedLogo();
	const workerFile = await copyStoreWorker();
	const microfrontendStyles = await buildMicrofrontendStyles(
		microfrontendModuleStyles,
	);
	const iconFiles = await copyPwaIcons();
	const functionIndexFile = await writeFunctionIndex();

	// Per-file module styles are already inside `mf.css`: left next to the chunks
	// they'd just be files nobody requests.
	await Promise.all(
		microfrontendModuleStyles.map((path) => rm(path, { force: true })),
	);

	// The whole critical path goes into precache: a repeat app launch
	// (including from the home screen and offline) makes zero requests.
	// Images and source maps don't go in here — they're fetched on demand and
	// land in the same cache as runtime entries.
	const precache = [
		"/",
		"/manifest.webmanifest",
		// The function index is metadata, not code: the catalog needs it from the
		// first second, while the modules themselves are still fetched on demand
		// (docs/AI.md §4.2).
		`/${relative(dist, functionIndexFile)}`,
		...[...appFiles, ...styleFiles, logoFile, workerFile, ...vendorLayerFiles("app")]
			.map((path) => `/${relative(dist, path)}`)
			.filter((path) => path.endsWith(".js") || path.endsWith(".css")),
	];
	// The cache name changes together with the build's content, so the old cache
	// is simply invisible to the new build, and `activate` deletes it.
	const revisionFiles = [
		...appFiles,
		...styleFiles,
		workerFile,
		...vendorLayerFiles("app"),
		...vendorLayerFiles("mf"),
		...microfrontendFiles,
		...widgetFiles,
		functionIndexFile,
	];
	const buildId = Bun.hash(
		precache.join("|") + (await appSignature(revisionFiles, [])),
	).toString(36);
	const deliveryImportMap = versionImportMap(buildId);
	const [serviceWorkerFile, manifestFile] = await Promise.all([
		buildServiceWorker(buildId, precache),
		writeManifest(),
	]);

	await Promise.all([
		// Host page for the embeddable form: no import map, no preload — the
		// widget is self-contained, copy it as is.
		Bun.write(join(dist, "embed.html"), Bun.file(embedPage)),
		// The container build for prod reads the map: SSR and SPA are separate images there.
		Bun.write(
			join(dist, "import-map.json"),
			`${JSON.stringify(deliveryImportMap, null, 2)}\n`,
		),
	]);

	// Three independent deliveries: the app page loads its own files, a foreign
	// page loads only the widget, and the microfrontend layer belongs to nobody
	// until the first function call. There's nothing to add them up into.

	// Startup is code: what the browser must execute before the first screen.
	const appOutputs = [...appFiles, ...styleFiles, ...vendorLayerFiles("app")];

	/** Fetched on the file's first load, not at startup. */
	const deferredOutputs = [workerFile, ...auditFiles];

	// Install layer: worker, manifest, and icons. Not on the critical path
	// (registration happens on `load`), so it doesn't count toward the startup budget.
	const pwaOutputs = [serviceWorkerFile, manifestFile, ...iconFiles];

	// Shared MF libraries exist as a separate cache. They aren't part of any
	// particular MF, so they're measured separately in the report too.
	const dynamicVendorOutputs = vendorLayerFiles("mf");
	// The shared UnoCSS layer is needed by every MF, but isn't a microfrontend
	// itself and shouldn't clutter their size table.
	const microfrontendOutputs = [...microfrontendFiles, functionIndexFile];
	const dynamicStyleOutputs = [microfrontendStyles];

	await precompress(
		[
			...appOutputs,
			...deferredOutputs,
			...dynamicVendorOutputs,
			...dynamicStyleOutputs,
			...microfrontendOutputs,
			...widgetFiles,
			...auditFiles,
			// We don't brotli-compress images: PNG is already compressed, a .br next to it would just take up space.
			...pwaOutputs.filter((path) => !path.endsWith(".png")),
		].filter((path) => !path.endsWith(".map")),
	);

	const [app, deferred, widget, dynamicVendors, microfrontendLayer, pwa] =
		await Promise.all([
			measure(appOutputs),
			measure(deferredOutputs),
			measure(widgetFiles),
			measure(dynamicVendorOutputs),
			measure(microfrontendOutputs),
			measure(pwaOutputs),
		]);

	const report = {
		mode: isProduction ? "production" : "development",
		imports: deliveryImportMap.imports,
		app,
		deferred,
		widget,
		dynamicVendors,
		microfrontends: microfrontendLayer,
		pwa: { enabled: pwaEnabled, buildId, precache, ...pwa },
	};

	await Bun.write(
		join(dist, "build-report.json"),
		`${JSON.stringify(report, null, 2)}\n`,
	);

	if (process.env.SPA_BUILD_SILENT !== "1") {
		console.log("\nApp start (JS + CSS)");
		console.table(sizeRows(app));
		console.log("Deferred (not in start): file worker");
		console.table(sizeRows(deferred));
		// The widget's CSS and file worker are baked into the same JS, so it has
		// no per-file layout and doesn't add up with the app's numbers.
		console.log("Widget (self-contained, CSS and worker inside JS)");
		console.table(sizeRows(widget));
		// The microfrontend layer doesn't participate in startup: it's fetched on
		// user action or a chat function call.
		console.log("Microfrontends (on demand)");
		console.table(sizeRows(microfrontendLayer));
		console.log(
			pwaEnabled
				? `Install (sw + manifest + icons), build ${buildId}`
				: "Install disabled (PWA_DEV=1 enables it locally) — worker is stripped",
		);
		console.table(sizeRows(pwa));
	}

	return report;
}

if (import.meta.main) {
	await buildApp();
	console.log(`Built SPA delivery in ${dist}`);
}
