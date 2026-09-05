import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SurfaceLlmCatalog } from "front-core/core";
import type {
	ObjectIndexFile,
	SurfaceDefinition,
	SurfaceManifest,
} from "front-core/object-runtime";
import { surfaceDir, surfaces, surfacesDir } from "./layout";

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

export async function collectObjectIndex(): Promise<ObjectIndexFile> {
	const entries = await Promise.all(
		surfaces.map(async (name) => {
			const dir = surfaceDir(name);
			const module = `sf-${name}`;
			return [
				name,
				{
					module,
					manifest: manifestOf(await readDefinition(name)),
					llm: await readLlmCatalog(dir, name),
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
