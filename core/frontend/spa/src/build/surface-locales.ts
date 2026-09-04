import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export type SurfaceMessages = Record<string, unknown>;
export type SurfaceLocaleCatalog = Record<string, SurfaceMessages>;
type LocalizedEntry = {
	entrypoint: string;
	plugin: Bun.BunPlugin;
	catalog: SurfaceLocaleCatalog;
};

function moduleRoot(entrypoint: string): string {
	const entryDir = dirname(entrypoint);
	return basename(entryDir) === "src" ? dirname(entryDir) : entryDir;
}

export async function readSurfaceLocales(
	entrypoint: string,
): Promise<SurfaceLocaleCatalog> {
	const localesDir = join(moduleRoot(entrypoint), "locales");
	if (!existsSync(localesDir)) return {};
	const files = Array.from(
		new Bun.Glob("*.json").scanSync({ cwd: localesDir, absolute: true }),
	).sort();
	const catalog: SurfaceLocaleCatalog = {};

	for (const file of files) {
		const locale = basename(file, ".json");
		let messages: unknown;
		try {
			messages = JSON.parse(await Bun.file(file).text());
		} catch (error) {
			throw new Error(`[sf-locales] Invalid JSON in ${file}`, { cause: error });
		}
		if (!messages || typeof messages !== "object" || Array.isArray(messages)) {
			throw new Error(`[sf-locales] ${file} must contain a JSON object`);
		}
		catalog[locale] = messages as SurfaceMessages;
	}

	return catalog;
}

/**
 * Wraps a surface entry in a virtual module that embeds its locale JSON.
 * The wrapper runs after the original entry has evaluated, so it also upgrades
 * modules that still register legacy locale URLs in their source.
 */
export async function localizedSurfaceEntry(
	entrypoint: string,
	moduleName: string,
): Promise<LocalizedEntry> {
	const catalog = await readSurfaceLocales(entrypoint);
	if (Object.keys(catalog).length === 0) {
		return {
			entrypoint,
			catalog,
			plugin: { name: `sf-locales-${moduleName}`, setup() {} },
		};
	}

	const virtualEntrypoint = `sf-locales:${moduleName}`;
	const namespace = `sf-locales-${moduleName}`;
	const surfaceId = `${moduleName}-sf`;
	const plugin: Bun.BunPlugin = {
		name: namespace,
		setup(build) {
			build.onResolve({ filter: /^sf-locales:/ }, (args) => {
				if (args.path !== virtualEntrypoint) return;
				return { path: args.path, namespace };
			});
			build.onLoad({ filter: /.*/, namespace }, () => ({
				contents: [
					'import { registerSurfaceLocales as __registerSurfaceLocales } from "front-core";',
					`import __surfaceDefinition from ${JSON.stringify(entrypoint)};`,
					`export * from ${JSON.stringify(entrypoint)};`,
					`__registerSurfaceLocales(${JSON.stringify(surfaceId)}, ${JSON.stringify(catalog)});`,
					"export default __surfaceDefinition;",
				].join("\n"),
				loader: "js",
			}));
		},
	};

	return { entrypoint: virtualEntrypoint, plugin, catalog };
}
