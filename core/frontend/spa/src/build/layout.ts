import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The delivery layout lives in one place: everything else in the build is
 * addressed from here. The package lives inside `front/`, so neighboring
 * packages' roots are computed relative to it, not to PROJECT_DIR — the build
 * must not depend on which directory it was started from.
 */

export const spaRoot = resolve(import.meta.dir, "..", "..");
export const frontRoot = resolve(spaRoot, "..");
export const frontCoreRoot = join(frontRoot, "front-core");
export const microfrontendsRoot = join(frontRoot, "microfrontends");
const projectMicrofrontendsRoots = [
	process.env.CHILD_PROJECT_DIR,
	process.env.PROJECT_DIR,
]
	.filter((projectDir): projectDir is string => Boolean(projectDir?.trim()))
	.flatMap((projectDir) => [
		join(resolve(projectDir), "front", "microfrontends"),
		join(resolve(projectDir), "modules", "microfrontends"),
	]);
export const microfrontendsRoots = [
	...projectMicrofrontendsRoots,
	microfrontendsRoot,
].filter((root) => existsSync(root));

/**
 * Delivery-wide source audit. A project build may select only a subset of
 * modules, but an incompatible public import in any maintained delivery must
 * be caught before it reaches a browser.
 *
 * A function, not a constant: this used to glob `*​/front/microfrontends` from
 * a directory derived by walking up out of this file. Bundled, `import.meta.dir`
 * collapses and that walk lands on `/`, so merely importing this module scanned
 * the whole filesystem and died on the first unreadable directory. The roots
 * the rest of the build already agrees on are the same deliveries, so they are
 * reused rather than rediscovered.
 */
export function microfrontendContractRoots(): string[] {
	return [...new Set(microfrontendsRoots)];
}

/**
 * A child project owns its landing host while the base project supplies shared
 * frontend packages. Prefer the child so SSR and the browser register the
 * same block map; retain legacy `front/landing` support during migration.
 */
function landingProjectDir(): string {
	const projectDirs = [process.env.CHILD_PROJECT_DIR, process.env.PROJECT_DIR]
		.filter((value): value is string => Boolean(value?.trim()))
		.map((value) => resolve(value));

	for (const projectDir of projectDirs) {
		for (const relativePath of ["core/frontend/landing", "front/landing"]) {
			const landingDir = join(projectDir, relativePath);
			if (existsSync(join(landingDir, "src", "blocks", "index.tsx"))) {
				return landingDir;
			}
		}
	}

	throw new Error(
		`[spa] landing blocks not found in: ${projectDirs.join(", ")}`,
	);
}

/** Map of the project's landing blocks: `type` from storage → component. */
export function landingBlocksEntry(): string {
	return join(landingProjectDir(), "src", "blocks", "index.tsx");
}

/**
 * Re-export of the project's blocks inside the delivery: the build writes it,
 * the entrypoint imports it. It lives next to the entrypoint because a plain
 * relative import is the only way to keep the project's `tsconfig` (see build/bundles.ts).
 */
export function landingBlocksShim(): string {
	return join(spaRoot, "src", "client", "landing-blocks.ts");
}

/**
 * The project blocks' style layer. Unlike the block map, it's optional: a
 * project whose blocks are styled by the core doesn't set up its own layer.
 */
export function landingBlocksStyles(): string[] {
	const blocksDir = join(landingProjectDir(), "src", "blocks");
	const stylesDir = join(blocksDir, "styles");
	const componentStyles = existsSync(stylesDir)
		? Array.from(
				new Bun.Glob("**/*.css").scanSync({
					cwd: stylesDir,
					absolute: true,
				}),
			).sort()
		: [];
	const legacy = join(blocksDir, "blocks.css");
	return componentStyles.length > 0
		? componentStyles
		: existsSync(legacy)
			? [legacy]
			: [];
}

/**
 * An isolated page style can live next to the landing, but it must become an
 * ordinary delivery artifact, not something built from sources on the server.
 */
export function landingAuditSourceDir(): string | undefined {
	const source = join(landingProjectDir(), "src", "audit");
	return existsSync(source) ? source : undefined;
}

export function landingAuditClientEntry(
	name: "landing" | "print",
): string | undefined {
	const source = landingAuditSourceDir();
	if (!source) return undefined;
	const entry = join(
		source,
		"client",
		`${name}.${name === "landing" ? "tsx" : "ts"}`,
	);
	return existsSync(entry) ? entry : undefined;
}

export function landingAuditShim(): string {
	return join(spaRoot, "src", "client", "audit-page.ts");
}

/**
 * The interactive audit's entrypoints belong to the host project. They can't
 * be built on the first HTTP request: in production they must be ordinary
 * delivery modules and use the shared import map.
 */
export const dist = join(spaRoot, "dist");
export const assetsDir = join(dist, "assets");
export const vendorDir = join(dist, "vendor");
export const microfrontendsDir = join(dist, "mf");
export const iconsDir = join(dist, "icons");
export const widgetDir = join(dist, "widget");

export const clientEntry = join(spaRoot, "src", "client", "main.tsx");
export const widgetEntry = join(spaRoot, "src", "client", "widget.tsx");
export const embedPage = join(spaRoot, "src", "client", "embed.html");
export const serviceWorkerEntry = join(
	spaRoot,
	"src",
	"sw",
	"service-worker.ts",
);
export const vendorEntriesDir = join(spaRoot, "src", "vendor", "entries");
export const pwaAssetsDir = join(spaRoot, "src", "assets", "pwa");

// The file worker is its own ESM bundle from the store-workers library (it has
// its own global scope, the importmap doesn't reach there). Here it's only copied.
export const storeWorkerBundle = join(
	frontRoot,
	"libraries",
	"files",
	"store-workers",
	"dist",
	"store.worker.js",
);

export const isProduction = process.env.NODE_ENV === "production";

/**
 * Debug instrumentation is selected when the delivery is built. It is not a
 * browser preference: every client of one delivery executes the same graph.
 */
export const effectorDebug =
	process.env.EFFECTOR_DEBUG === "1" ||
	(process.env.EFFECTOR_DEBUG !== "0" && !isProduction);

export const clientBuildDefines = {
	__EFFECTOR_DEBUG__: effectorDebug ? "true" : "false",
};

/**
 * Install on the phone is enabled in prod; locally via `PWA_DEV=1`.
 * In dev the worker is deliberately disabled: it caches layers by build id,
 * and the dev server rebuilds them on every request.
 */
export const pwaEnabled =
	isProduction || process.env.PWA_DEV === "1" || process.env.PWA_DEV === "true";

/**
 * Microfrontends included in the delivery. Every module exposes a typed object
 * definition; this list only selects which definitions are bundled.
 */
export const microfrontends =
	// Set-but-empty is not the same as unset, and the difference is what an image
	// build relies on: it carries no microfrontends at all, because they are
	// fetched from the registry at runtime. Unset stays the dev default.
	(
		process.env.MICROFRONTENDS === undefined
			? ["functions", "static"]
			: process.env.MICROFRONTENDS.split(",")
	)
		.map((name) => name.trim().replace(/^mf-/, ""))
		.filter(Boolean);

/**
 * Microfrontends are laid out in topic folders, but addressed in the delivery
 * by their short name: `functions` → `microfrontends/ai/mf-functions`.
 */
export function microfrontendDir(name: string): string {
	for (const root of microfrontendsRoots) {
		const direct = join(root, `mf-${name}`);
		if (existsSync(direct)) return direct;

		const [match] = new Bun.Glob(`*/mf-${name}`).scanSync({
			cwd: root,
			onlyFiles: false,
		});
		if (match) return join(root, match);
	}
	throw new Error(
		`Microfrontend not found: mf-${name} in ${microfrontendsRoots.join(", ")}`,
	);
}
