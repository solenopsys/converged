import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export type MicrofrontendMessages = Record<string, unknown>;
export type MicrofrontendLocaleCatalog = Record<string, MicrofrontendMessages>;
export type MicrofrontendLlmCatalog = {
	actions: Record<string, unknown>;
	patterns?: Array<{ prefix: string; meta: Record<string, unknown> }>;
};

type LocalizedEntry = {
	entrypoint: string;
	plugin: Bun.BunPlugin;
	catalog: MicrofrontendLocaleCatalog;
	llmCatalog: MicrofrontendLlmCatalog;
};

function moduleRoot(entrypoint: string): string {
	const entryDir = dirname(entrypoint);
	return basename(entryDir) === "src" ? dirname(entryDir) : entryDir;
}

export async function readMicrofrontendLlmCatalog(
	entrypoint: string,
): Promise<MicrofrontendLlmCatalog> {
	const file = Bun.file(join(moduleRoot(entrypoint), "llm.json"));
	if (!(await file.exists())) return { actions: {} };
	let catalog: unknown;
	try {
		catalog = await file.json();
	} catch (error) {
		throw new Error(`[mf-llm] Invalid JSON in ${file.name}`, { cause: error });
	}
	if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
		throw new Error(`[mf-llm] ${file.name} must contain a JSON object`);
	}
	const value = catalog as MicrofrontendLlmCatalog;
	if (!value.actions || typeof value.actions !== "object" || Array.isArray(value.actions)) {
		throw new Error(`[mf-llm] ${file.name} must contain an actions object`);
	}
	return value;
}

export async function readMicrofrontendLocales(
	entrypoint: string,
): Promise<MicrofrontendLocaleCatalog> {
	const localesDir = join(moduleRoot(entrypoint), "locales");
	if (!existsSync(localesDir)) return {};
	const files = Array.from(
		new Bun.Glob("*.json").scanSync({ cwd: localesDir, absolute: true }),
	).sort();
	const catalog: MicrofrontendLocaleCatalog = {};

	for (const file of files) {
		const locale = basename(file, ".json");
		let messages: unknown;
		try {
			messages = JSON.parse(await Bun.file(file).text());
		} catch (error) {
			throw new Error(`[mf-locales] Invalid JSON in ${file}`, { cause: error });
		}
		if (!messages || typeof messages !== "object" || Array.isArray(messages)) {
			throw new Error(`[mf-locales] ${file} must contain a JSON object`);
		}
		catalog[locale] = messages as MicrofrontendMessages;
	}

	return catalog;
}

/**
 * Wraps a microfrontend entry in a virtual module that embeds its locale JSON.
 * The wrapper runs after the original entry has evaluated, so it also upgrades
 * modules that still register legacy locale URLs in their source.
 */
export async function localizedMicrofrontendEntry(
	entrypoint: string,
	moduleName: string,
): Promise<LocalizedEntry> {
	const catalog = await readMicrofrontendLocales(entrypoint);
	const llmCatalog = await readMicrofrontendLlmCatalog(entrypoint);
	if (
		Object.keys(catalog).length === 0 &&
		Object.keys(llmCatalog.actions).length === 0 &&
		(llmCatalog.patterns?.length ?? 0) === 0
	) {
		return {
			entrypoint,
			catalog,
			llmCatalog,
			plugin: { name: `mf-locales-${moduleName}`, setup() {} },
		};
	}

	const virtualEntrypoint = `mf-locales:${moduleName}`;
	const namespace = `mf-locales-${moduleName}`;
	const microfrontendId = `${moduleName}-mf`;
	const plugin: Bun.BunPlugin = {
		name: namespace,
		setup(build) {
			build.onResolve({ filter: /^mf-locales:/ }, (args) => {
				if (args.path !== virtualEntrypoint) return;
				return { path: args.path, namespace };
			});
			build.onLoad({ filter: /.*/, namespace }, () => ({
				contents: [
					'import { ingestMicrofrontendLlmCatalog as __ingestMicrofrontendLlmCatalog, registerMicrofrontendLocales as __registerMicrofrontendLocales } from "front-core";',
					`import __microfrontendPlugin from ${JSON.stringify(entrypoint)};`,
					`export * from ${JSON.stringify(entrypoint)};`,
					`__registerMicrofrontendLocales(${JSON.stringify(microfrontendId)}, ${JSON.stringify(catalog)});`,
					`__ingestMicrofrontendLlmCatalog(${JSON.stringify(microfrontendId)}, "", ${JSON.stringify(llmCatalog)});`,
					"export default __microfrontendPlugin;",
				].join("\n"),
				loader: "js",
			}));
		},
	};

	return { entrypoint: virtualEntrypoint, plugin, catalog, llmCatalog };
}
