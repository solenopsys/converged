import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	MicrofrontendDefinition,
	MicrofrontendManifest,
	ObjectIndexFile,
} from "front-core/object-runtime";
import { microfrontendDir, microfrontends, microfrontendsDir } from "./layout";

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
					export const Category = {
						Entity: "core.entity", Content: "core.content", Business: "core.business",
						Communication: "core.communication", Automation: "core.automation",
						Security: "core.security", Statistic: "core.statistic", Financial: "core.financial",
						Selectable: "core.selectable", Creatable: "core.creatable",
						Editable: "core.editable", Executable: "core.executable",
					};
				export const defineMicrofrontend = (definition) => definition;
				export const objectOf = (type) => ({ kind: "object", ...(type ? { type } : {}) });
				export const setOf = (type) => ({ kind: "set", ...(type ? { type } : {}) });
				export const objectRef = (type, id, options = {}) => ({ kind: "object", type, id: String(id), ...options });
				export const setRef = (type, selection, options = {}) => ({ kind: "set", type, selection, ...options });
				export const executeOperation = () => {};
				export const presentReference = () => {};
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

function manifestOf(
	definition: MicrofrontendDefinition,
): MicrofrontendManifest {
	return {
		id: definition.id,
		types: definition.types,
		views: definition.views.map(
			({ component: _component, props: _props, ...view }) => view,
		),
		operations: definition.operations.map(
			({ invoke: _invoke, ...operation }) => operation,
		),
	};
}

async function readDefinition(name: string): Promise<MicrofrontendDefinition> {
	const entrypoint = join(microfrontendDir(name), "src", "index.ts");
	const result = await Bun.build({
		entrypoints: [entrypoint],
		target: "bun",
		format: "esm",
		plugins: [stubExternals],
	});
	if (!result.success) {
		throw new AggregateError(
			result.logs,
			`[object-index] mf-${name} cannot be read`,
		);
	}
	const text = await result.outputs[0].text();
	const compiled = join(
		tmpdir(),
		`object-index-${Bun.hash(text).toString(36)}.mjs`,
	);
	if (!(await Bun.file(compiled).exists())) await Bun.write(compiled, text);
	const module = (await import(compiled)) as {
		default?: MicrofrontendDefinition;
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
			`[object-index] mf-${name} must export a microfrontend definition as default`,
		);
	}
	return definition;
}

export async function collectObjectIndex(): Promise<ObjectIndexFile> {
	const entries = await Promise.all(
		microfrontends.map(async (name) => {
			const module = `mf-${name}`;
			return [
				name,
				{ module, manifest: manifestOf(await readDefinition(name)) },
			] as const;
		}),
	);
	return { modules: Object.fromEntries(entries) };
}

export async function writeObjectIndex(): Promise<string> {
	const output = join(microfrontendsDir, "index.json");
	await Bun.write(
		output,
		`${JSON.stringify(await collectObjectIndex(), null, 2)}\n`,
	);
	return output;
}
