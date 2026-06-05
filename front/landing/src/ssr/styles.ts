import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { createGenerator } from "unocss";
import unoConfig from "../../uno.config";

const landingRoot = path.resolve(import.meta.dir, "../..");
const projectRoot =
	process.env.PROJECT_DIR ?? path.resolve(landingRoot, "../..");
const envParentProjectRoot =
	(process.env.CHILD_PROJECT_DIR && process.env.CHILD_PROJECT_DIR.length > 0
		? process.env.CHILD_PROJECT_DIR
		: undefined) ??
	(process.env.PARENT_PROJECT_DIR && process.env.PARENT_PROJECT_DIR.length > 0
		? process.env.PARENT_PROJECT_DIR
		: undefined);
const extraProjectRoots = (process.env.EXTRA_PROJECT_DIRS ?? "")
	.split(path.delimiter)
	.map((root) => root.trim())
	.filter(Boolean);

function resolveFrontRoot(root: string): string {
	const normalized = root.replace(/[\\/]+$/, "");
	const looksLikeFrontRoot =
		existsSync(path.join(normalized, "front-core")) &&
		existsSync(path.join(normalized, "microfrontends"));
	if (looksLikeFrontRoot) return normalized;
	return path.join(normalized, "front");
}

const projectRoots = Array.from(
	new Set(
		[projectRoot, envParentProjectRoot, ...extraProjectRoots].filter(
			(root): root is string => Boolean(root),
		),
	),
);

// SSR sources — only what renders on the server (landing pages, front-landings sections)
const ssrSourceRoots = Array.from(
	new Set([
		path.join(landingRoot, "src"),
		...projectRoots.map((root) =>
			path.resolve(
				root,
				"../../..",
				"saas",
				"public",
				"front",
				"front-landings",
				"src",
			),
		),
	]),
);

// SPA sources — microfrontends, front-core components, libraries (everything else)
const spaSourceRoots = Array.from(
	new Set(
		projectRoots.flatMap((root) => [
			path.join(resolveFrontRoot(root), "front-core", "src"),
			path.join(resolveFrontRoot(root), "microfrontends"),
			path.join(resolveFrontRoot(root), "libraries"),
		]),
	),
);

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const styleExtensions = new Set([".css"]);
const ignoredDirectories = new Set([
	".next",
	"build",
	"dist",
	"node_modules",
	"storybook-static",
]);

async function readFileSafe(filePath: string): Promise<string> {
	try {
		return await fs.readFile(filePath, "utf-8");
	} catch {
		return "";
	}
}

async function collectFiles(
	dir: string,
	extensions: Set<string>,
	target: string[],
	options: { skipFile?: (filePath: string) => boolean } = {},
): Promise<void> {
	let entries;
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;
		if (ignoredDirectories.has(entry.name)) continue;

		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			await collectFiles(fullPath, extensions, target, options);
			continue;
		}

		if (!entry.isFile()) continue;
		if (!extensions.has(path.extname(entry.name))) continue;
		if (options.skipFile?.(fullPath)) continue;

		const fileContents = await readFileSafe(fullPath);
		if (fileContents) target.push(fileContents);
	}
}

async function collectSources(dir: string, sources: string[]): Promise<void> {
	await collectFiles(dir, sourceExtensions, sources);
}

async function collectCss(dir: string, styles: string[]): Promise<void> {
	await collectFiles(dir, styleExtensions, styles, {
		skipFile: (filePath) => {
			const basename = path.basename(filePath);
			return basename === "globals.css" || basename.endsWith(".module.css");
		},
	});
}

function stripUnoDirectives(css: string): string {
	return css
		.split("\n")
		.filter((line) => {
			const trimmed = line.trim();
			if (trimmed.startsWith("@unocss")) return false;
			if (trimmed.startsWith('@import "@unocss/reset')) return false;
			if (trimmed.startsWith("@import '@unocss/reset")) return false;
			return true;
		})
		.join("\n");
}

async function loadResetCss(): Promise<string> {
	let resetCss = await readFileSafe(
		path.join(landingRoot, "node_modules", "@unocss", "reset", "tailwind.css"),
	);
	if (!resetCss) {
		resetCss = await readFileSafe(
			path.join(
				projectRoot,
				"node_modules",
				"@unocss",
				"reset",
				"tailwind.css",
			),
		);
	}
	return resetCss;
}

/**
 * Build SSR-only styles — scanned from landing/src and front-landings only.
 * Includes reset, preflights, globals.css, and UnoCSS utilities.
 */
export async function buildStyles(): Promise<string> {
	const sources: string[] = [];
	const componentCss: string[] = [];
	for (const dir of ssrSourceRoots) {
		await collectSources(dir, sources);
		await collectCss(dir, componentCss);
	}
	for (const dir of spaSourceRoots) {
		await collectSources(dir, sources);
		await collectCss(dir, componentCss);
	}

	const uno = await createGenerator(unoConfig);
	const { css: unoCss } = await uno.generate(sources.join("\n"), {
		preflights: true,
	});

	const resetCss = await loadResetCss();
	const globalsCss = await readFileSafe(
		path.join(landingRoot, "src", "app", "globals.css"),
	);

	return [resetCss, unoCss, stripUnoDirectives(globalsCss), ...componentCss]
		.filter(Boolean)
		.join("\n");
}

/**
 * Build SPA-only styles — scanned from microfrontends, front-core, libraries.
 * Excludes any rules already present in the SSR stylesheet to avoid duplication.
 */
export async function buildSpaStyles(): Promise<string> {
	return "";
}
