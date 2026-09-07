/**
 * CSS packed into the module, not shipped beside it.
 *
 * A delivery-time `assets/sf.css` is one stylesheet assembled from every
 * surface the build knew about. That works only while the build knows the
 * set, and in the registry it does not: modules are built once and selected per
 * solution afterwards. A module whose styles lived in that shared file would
 * load into a page that has none of them.
 *
 * So the module carries them. `import "./View.css"` is turned into a javascript
 * string by lightningcss instead of a second output file, and a prologue mounts
 * the result once, keyed by the module's name. This is the arrangement the
 * widget bundle has always used — a self-contained module is the same problem
 * as a self-contained embed.
 */

import { dirname, join, resolve } from "node:path";
import { transform } from "lightningcss";

/**
 * `@import` is resolved here rather than left to lightningcss's own bundler:
 * the imports are workspace-relative paths, and following them by hand is what
 * lets a module pull a shared stylesheet from front-core without that file
 * becoming a runtime request.
 */
async function inlineImports(
	css: string,
	fromPath: string,
	visited: Set<string>,
): Promise<string> {
	const importRegex = /@import\s+(?:url\()?['"]?([^'")]+)['"]?\)?\s*;/g;
	let inlined = css;

	for (const match of css.matchAll(importRegex)) {
		const specifier = match[1];
		// Web fonts and data URLs are the browser's job; only local files are
		// pulled in, because only those would otherwise be a missing request.
		if (/^(https?:)?\/\//.test(specifier) || specifier.startsWith("data:")) {
			continue;
		}
		const path = resolve(join(dirname(fromPath), specifier));
		if (visited.has(path)) continue;
		visited.add(path);

		const nested = await inlineImports(
			await Bun.file(path).text(),
			path,
			visited,
		);
		inlined = inlined.replace(match[0], nested);
	}

	return inlined;
}

/**
 * Collects what it converts. The bundler emits no CSS output once every `.css`
 * import is javascript, so the caller cannot read the stylesheet back off the
 * build result — the plugin hands it over directly.
 */
export function createCssPlugin(collected: string[]): Bun.BunPlugin {
	return {
		name: "registry-css",
		setup(build) {
			// CSS modules keep their generated class names: the module's markup
			// refers to them through the exported map, so scoping has to happen at
			// build time or the names in the bundle name nothing.
			build.onLoad({ filter: /\.module\.css$/ }, async (args) => {
				const source = await Bun.file(args.path).text();
				const { code, exports } = transform({
					filename: args.path,
					code: Buffer.from(source),
					minify: true,
					cssModules: true,
				});
				const css = code.toString();
				collected.push(css);

				const classes: Record<string, string> = { __css: css };
				for (const [key, value] of Object.entries(exports ?? {})) {
					classes[key] = value.name;
				}
				return {
					contents: `export default ${JSON.stringify(classes)};`,
					loader: "js",
				};
			});

			build.onLoad({ filter: /^(?!.*\.module).*\.css$/ }, async (args) => {
				const source = await inlineImports(
					await Bun.file(args.path).text(),
					args.path,
					new Set([resolve(args.path)]),
				);
				const { code } = transform({
					filename: args.path,
					code: Buffer.from(source),
					minify: true,
				});
				const css = code.toString();
				collected.push(css);
				// Still a default export: a module may import the text deliberately
				// (the widget does), and the prologue mounts it either way.
				return {
					contents: `export default ${JSON.stringify(css)};`,
					loader: "js",
				};
			});
		},
	};
}

/**
 * Mounted once per module and keyed by its name: two screens of the same module
 * load the same artifact, and the second must not append a second copy of the
 * stylesheet. Guarding on the element rather than on a module-scoped flag also
 * survives the module being evaluated twice, which an import map can cause.
 */
export function withStylePrologue(
	script: string,
	name: string,
	css: string,
): string {
	if (!css.trim()) return script;
	const id = `sf-style-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
	return [
		`const __mfStyleId=${JSON.stringify(id)};`,
		'if(typeof document!=="undefined"&&!document.getElementById(__mfStyleId)){',
		'const __mfStyle=document.createElement("style");',
		"__mfStyle.id=__mfStyleId;",
		`__mfStyle.textContent=${JSON.stringify(css)};`,
		"document.head.appendChild(__mfStyle);",
		"}",
		script,
	].join("\n");
}
