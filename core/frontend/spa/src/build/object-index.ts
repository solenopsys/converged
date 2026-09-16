import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SurfaceLlmCatalog } from "front-core/core";
import type {
	ObjectIndexFile,
	SurfaceDefinition,
	SurfaceManifest,
} from "front-core/object-runtime";
import { surfaceDir, surfaces, surfacesDir } from "./layout";
import {
	readSurfaceLocales,
	type SurfaceLocaleCatalog,
} from "./surface-locales";

const stubExternals = {
	name: "object-index-stub-externals",
	setup(build: Bun.PluginBuilder) {
		build.onResolve({ filter: /.*/ }, (args) =>
			args.path.startsWith(".") || args.path.startsWith("/")
				? null
				: { path: args.path, namespace: "object-index-stub" },
		);
		build.onLoad({ filter: /.*/, namespace: "object-index-stub" }, (args) => ({
			contents:
				args.path === "front-core/object-runtime"
					? `
					export const NEW_OBJECT_ID = "new";
					export const Category = {
						Entity: "core.entity", Content: "core.content", Business: "core.business",
						Communication: "core.communication", Automation: "core.automation",
						Security: "core.security", Statistic: "core.statistic", Financial: "core.financial",
						Selectable: "core.selectable", Creatable: "core.creatable",
						Editable: "core.editable", Executable: "core.executable",
					};
				export const defineSurface = (definition) => definition;
				export const objectOf = (type) => ({ kind: "object", ...(type ? { type } : {}) });
				export const setOf = (type) => ({ kind: "set", ...(type ? { type } : {}) });
				export const objectRef = (type, id, options = {}) => ({ kind: "object", type, id: String(id), ...options });
				export const setRef = (type, selection, options = {}) => ({ kind: "set", type, selection, ...options });
					export const executeOperation = () => {};
					export const presentReference = () => {};
					export const attachToFocus = () => {};
					export const focusedObject = () => undefined;
					export const objectChanged = { watch: () => () => {} };
					export const objectRefreshRequested = { watch: () => () => {} };
					export const objectRevisionKey = (ref) => ref.type + "#" + ref.id;
					export const $objectRevisions = {};
					export const setOperationAuthorizationController = () => {};
				`
					: `
				const hit = () => new Proxy(function(){}, {
					get: (_t, p) => (p === "__esModule" ? true : hit()),
					apply: () => hit(),
					construct: () => hit(),
				});
				module.exports = Object.create(hit());`,
			loader: "js" as const,
		}));
	},
};

function manifestOf(definition: SurfaceDefinition): SurfaceManifest {
	return {
		id: definition.id,
		// A surface has to name itself in the index: the first orchestrator step
		// and the tab strip both read it before the module is ever imported.
		label: definition.label,
		...(definition.labelKey ? { labelKey: definition.labelKey } : {}),
		purpose: definition.purpose,
		...(definition.purposeKey ? { purposeKey: definition.purposeKey } : {}),
		...(definition.menu ? { menu: definition.menu } : {}),
		types: definition.types,
		views: definition.views.map(
			({ component: _component, props: _props, ...view }) => view,
		),
		operations: definition.operations.map(
			({ invoke: _invoke, ...operation }) => operation,
		),
	};
}

async function readDefinition(name: string): Promise<SurfaceDefinition> {
	const entrypoint = join(surfaceDir(name), "src", "index.ts");
	const result = await Bun.build({
		entrypoints: [entrypoint],
		target: "bun",
		format: "esm",
		plugins: [stubExternals],
	});
	if (!result.success) {
		throw new AggregateError(
			result.logs,
			`[object-index] sf-${name} cannot be read`,
		);
	}
	const text = await result.outputs[0].text();
	const compiled = join(
		tmpdir(),
		`object-index-${Bun.hash(text).toString(36)}.mjs`,
	);
	if (!(await Bun.file(compiled).exists())) await Bun.write(compiled, text);
	const module = (await import(compiled)) as {
		default?: SurfaceDefinition;
	};
	const definition = module.default;
	if (
		!definition ||
		typeof definition.id !== "string" ||
		!Array.isArray(definition.types) ||
		!Array.isArray(definition.views) ||
		!Array.isArray(definition.operations)
	) {
		throw new Error(
			`[object-index] sf-${name} must export a surface definition as default`,
		);
	}
	// Caught here rather than at runtime: a surface without these is invisible to
	// the tab strip and unpickable by the first orchestrator step, and neither
	// failure says why.
	if (!definition.label?.trim() || !definition.purpose?.trim()) {
		throw new Error(
			`[object-index] sf-${name} must declare a label and a purpose`,
		);
	}
	return definition;
}

export async function readLlmCatalog(
	dir: string,
	name: string,
): Promise<SurfaceLlmCatalog> {
	const file = Bun.file(join(dir, "llm.json"));
	if (!(await file.exists())) {
		throw new Error(`[object-index] sf-${name}: missing llm.json`);
	}
	const catalog = (await file.json()) as SurfaceLlmCatalog;
	if (!catalog.actions || typeof catalog.actions !== "object") {
		throw new Error(
			`[object-index] sf-${name}: llm.json must contain an actions object`,
		);
	}
	return catalog;
}

/** Every message key the manifest itself names: what the shell shows before loading. */
export function manifestMessageKeys(manifest: SurfaceManifest): string[] {
	const keys = [
		manifest.labelKey,
		manifest.purposeKey,
		...manifest.types.flatMap((type) => [
			type.labelKey,
			type.pluralLabelKey,
			type.descriptionKey,
		]),
		...manifest.views.flatMap((view) => [view.labelKey, view.descriptionKey]),
		...manifest.operations.flatMap((operation) => [
			operation.labelKey,
			operation.descriptionKey,
		]),
	];
	return [
		...new Set(keys.filter((key): key is string => typeof key === "string")),
	];
}

function lookup(messages: Record<string, unknown>, key: string): unknown {
	let value: unknown = messages;
	for (const segment of key.split(".")) {
		if (!value || typeof value !== "object" || !(segment in value)) {
			return messages[key];
		}
		value = (value as Record<string, unknown>)[segment];
	}
	return value;
}

function assign(target: Record<string, unknown>, key: string, value: unknown) {
	const segments = key.split(".");
	let node = target;
	for (const segment of segments.slice(0, -1)) {
		if (!node[segment] || typeof node[segment] !== "object") node[segment] = {};
		node = node[segment] as Record<string, unknown>;
	}
	node[segments.at(-1) as string] = value;
}

/**
 * The part of a surface's locales the index needs: the strip, the menus and
 * the home screen name surfaces, projections and commands long before the
 * module — and its full catalog — is imported. A few strings per locale, not
 * the catalog.
 */
export function manifestLocales(
	manifest: SurfaceManifest,
	catalog: SurfaceLocaleCatalog,
): SurfaceLocaleCatalog {
	const keys = manifestMessageKeys(manifest);
	const locales: SurfaceLocaleCatalog = {};
	for (const [locale, messages] of Object.entries(catalog)) {
		const picked: Record<string, unknown> = {};
		for (const key of keys) {
			const value = lookup(messages, key);
			if (typeof value === "string") assign(picked, key, value);
		}
		if (Object.keys(picked).length > 0) locales[locale] = picked;
	}
	return locales;
}

/**
 * Commands are text the user reads — in menus, on buttons — so their label and
 * description come from the surface's locales, never from a literal in code.
 * The literal stays as the fallback a missing catalog falls back to; what this
 * refuses is a command with no key, or a key some locale does not translate.
 */
export function commandLocalizationProblems(
	name: string,
	manifest: SurfaceManifest,
	catalog: SurfaceLocaleCatalog,
): string[] {
	const problems: string[] = [];
	const locales = Object.entries(catalog);
	for (const operation of manifest.operations) {
		for (const field of ["labelKey", "descriptionKey"] as const) {
			const key = operation[field];
			if (!key) {
				problems.push(`sf-${name}: ${operation.id} has no ${field}`);
				continue;
			}
			if (locales.length === 0) {
				problems.push(
					`sf-${name}: ${operation.id} ${field} "${key}" but no locales`,
				);
			}
			for (const [locale, messages] of locales) {
				if (typeof lookup(messages, key) !== "string") {
					problems.push(
						`sf-${name}: ${locale}.json has no "${key}" (${operation.id})`,
					);
				}
			}
		}
	}
	return problems;
}

export async function collectObjectIndex(): Promise<ObjectIndexFile> {
	const entries = await Promise.all(
		surfaces.map(async (name) => {
			const dir = surfaceDir(name);
			const module = `sf-${name}`;
			const manifest = manifestOf(await readDefinition(name));
			const catalog = await readSurfaceLocales(join(dir, "src", "index.ts"));
			const problems = commandLocalizationProblems(name, manifest, catalog);
			if (problems.length > 0) {
				throw new Error(
					`[object-index] commands must be localized:\n  ${problems.join("\n  ")}`,
				);
			}
			const locales = manifestLocales(manifest, catalog);
			return [
				name,
				{
					module,
					manifest,
					llm: await readLlmCatalog(dir, name),
					...(Object.keys(locales).length > 0 ? { locales } : {}),
				},
			] as const;
		}),
	);
	return { modules: Object.fromEntries(entries) };
}

export async function writeObjectIndex(): Promise<string> {
	const output = join(surfacesDir, "index.json");
	await Bun.write(
		output,
		`${JSON.stringify(await collectObjectIndex(), null, 2)}\n`,
	);
	return output;
}
