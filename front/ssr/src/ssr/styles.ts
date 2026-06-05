import fs from "fs/promises";
import { createRequire } from "module";
import path from "path";
import { createGenerator } from "unocss";
import unoConfig from "../../uno.config";

const sourceRoots = [
	"src",
	"../front-core/src",
	"../microfrontends",
	"../libraries",
	"../../../../../saas/public/front/front-landings/src",
];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const styleExtensions = new Set([".css"]);
const ignoredDirectories = new Set([
	".next",
	"build",
	"dist",
	"node_modules",
	"storybook-static",
]);

const require = createRequire(import.meta.url);

async function readFileSafe(filePath: string): Promise<string> {
	try {
		return await fs.readFile(filePath, "utf-8");
	} catch {
		return "";
	}
}

function stripUnoDirectives(css: string): string {
	return css
		.replace(/@unocss\s+preflights;?/g, "")
		.replace(/@unocss\s+default;?/g, "")
		.replace(/@import\s+["']@unocss\/reset\/tailwind\.css["'];?/g, "");
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

		const contents = await readFileSafe(fullPath);
		if (contents) target.push(contents);
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

export async function buildStyles(): Promise<string> {
	const root = path.resolve(import.meta.dir, "../..");
	const sources: string[] = [];
	const componentCss: string[] = [];

	for (const dir of sourceRoots) {
		const sourceRoot = path.join(root, dir);
		await collectSources(sourceRoot, sources);
		await collectCss(sourceRoot, componentCss);
	}

	const uno = await createGenerator(unoConfig);
	const { css } = await uno.generate(sources.join("\\n"), {
		preflights: true,
	});

	const globalsPath = path.join(root, "src/app/globals.css");
	const resetPath = require.resolve("@unocss/reset/tailwind.css");
	const resetCss = await readFileSafe(resetPath);
	const globalsCss = stripUnoDirectives(await readFileSafe(globalsPath));

	return [resetCss, globalsCss, css, ...componentCss]
		.filter(Boolean)
		.join("\\n");
}
