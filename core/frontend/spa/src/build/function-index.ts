import { tmpdir } from "node:os";
import { join } from "node:path";
import { microfrontendDir, microfrontends, microfrontendsDir } from "./layout";

/**
 * The delivery's function index: module name, its brief description, and the
 * list of functions with brief descriptions (docs/AI.md §4.2).
 *
 * Why it exists. The function catalog is filled via `plug(bus)` when a
 * microfrontend loads, and modules load lazily — on a fresh page the catalog
 * is empty, and the function-picking step has nothing to show. Lazy loading
 * can't be given up: it's what gives a light startup. The index is the
 * compensation: metadata arrives right away, code on demand.
 *
 * There's no second source of truth: the index is built from the same
 * declarations (`src/functions.ts`) that the module registers at runtime. In
 * dev it's rebuilt together with the rest of the delivery, in the container
 * it ships as a ready-made file.
 */

export type IndexedFunction = {
	id: string;
	/** A one-liner for a compact LLM context. */
	brief: string;
	category: string;
	/** The full description — `describeFunction` answers with it; it doesn't go into the list. */
	description: string;
	exposure: "llm" | "user";
	priority: "primary" | "normal" | "secondary";
	access?: "public";
	capability?: string;
	parameters?: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
};

export type IndexedModule = {
	/** The module's name in the import map: `mf-orders`. */
	module: string;
	brief: string;
	functions: IndexedFunction[];
};

export type FunctionIndex = {
	/** The key is the delivery's short name (`orders`), as in `/mf/orders.js`. */
	modules: Record<string, IndexedModule>;
};

/**
 * The action factory receives the bus so it can call its neighbors. At build
 * time the bus isn't needed — the declaration must be static — but something
 * has to be passed in: the stub fails loudly if the factory tries to use it.
 */
const declarationOnlyBus = new Proxy(
	{},
	{
		get(_target, property) {
			throw new Error(
				`[function-index] Action factory touched the bus (.${String(property)}) at build time: ` +
					"declarations must be static",
			);
		},
	},
);

/**
 * `functions.ts` pulls in the module's domain, which pulls in effector,
 * transport, views. The declaration needs none of that, and half of it
 * doesn't even resolve in the server runtime (browser packages, `.tsx`,
 * workspace neighbors without installed dependencies). So the module is built
 * with the same bundler as the delivery, and everything external is replaced
 * with a universal stub.
 *
 * The stub is handed out as a prototype, not an object: the bundler's interop
 * (`__toESM`) only copies own keys, and any unknown name must travel up the
 * prototype chain, otherwise named imports would become `undefined`.
 */
const stubExternals = {
	name: "function-index-stub-externals",
	setup(build: Bun.PluginBuilder) {
		build.onResolve({ filter: /.*/ }, (args) =>
			args.path.startsWith(".") || args.path.startsWith("/")
				? null
				: { path: args.path, namespace: "fnidx-stub" },
		);
		build.onLoad({ filter: /.*/, namespace: "fnidx-stub" }, () => ({
			contents: `
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

type ActionDeclaration = {
	id: string;
	access?: "public";
	capability?: string;
};

/**
 * A module is allowed to require browser bootstrap at the top level (and fail
 * without it — that's intentional). For reading declarations we set
 * deliberately non-working addresses: any attempt to use them must fail
 * visibly, not send the build off into someone else's context.
 */
async function withBrowserBootstrap<T>(read: () => Promise<T>): Promise<T> {
	const globals = globalThis as Record<string, unknown>;
	const keys = [
		"__FUJIN_WS_URL__",
		"__FUJIN_BROWSER_SCOPE__",
	] as const;
	const saved = keys.map((key) => [key, globals[key]] as const);
	for (const key of keys) {
		globals[key] ??= "http://function-index.invalid";
	}
	try {
		return await read();
	} finally {
		for (const [key, value] of saved) {
			if (value === undefined) delete globals[key];
			else globals[key] = value;
		}
	}
}

/** The first segment of the id is both the default category and the lazy-load key. */
function categoryOf(id: string): string {
	return id.split(".", 1)[0] ?? "other";
}

async function readModuleBrief(dir: string): Promise<string> {
	const manifest = Bun.file(join(dir, "package.json"));
	if (!(await manifest.exists())) return "";
	const { description } = (await manifest.json()) as { description?: string };
	return description ?? "";
}

/**
 * Declarations live either as a file or as a directory — a module with a
 * dozen domains (`mf-mailing`) splits them across files and assembles them in
 * `functions/index.ts`. It's the same entity either way, and the module's
 * `index.ts` imports it the same way (`./functions`), so the index must read
 * both forms: the difference in layout shouldn't decide whether a function
 * makes it into the catalog.
 */
async function declarationsEntry(dir: string): Promise<string | undefined> {
	for (const candidate of [
		join(dir, "src", "functions.ts"),
		join(dir, "src", "functions", "index.ts"),
	]) {
		if (await Bun.file(candidate).exists()) return candidate;
	}
	return undefined;
}

type LlmCatalog = {
	actions: Record<string, Omit<IndexedFunction, "id" | "access" | "capability">>;
};

async function readLlmCatalog(dir: string, name: string): Promise<LlmCatalog> {
	const file = Bun.file(join(dir, "llm.json"));
	if (!(await file.exists())) {
		throw new Error(`[function-index] mf-${name}: missing llm.json`);
	}
	const catalog = (await file.json()) as LlmCatalog;
	if (!catalog.actions || typeof catalog.actions !== "object") {
		throw new Error(`[function-index] mf-${name}: llm.json must contain an actions object`);
	}
	return catalog;
}

/**
 * The set of factories is exported under two names: `default` for modules
 * with a declarations file, and `ACTIONS` for modules with a directory
 * (there `default` is taken — `functions/index.ts` also re-exports columns
 * and fields). They're registered the same way — `new BasePlugin(ID,
 * ACTIONS)` — so they're read the same way here too.
 */
type DeclarationExports = {
	default?: Array<(bus: unknown) => ActionDeclaration>;
	ACTIONS?: Array<(bus: unknown) => ActionDeclaration>;
};

/**
 * The index is metadata, not the delivery: a module whose declarations can't
 * be read lands in the index empty and stays callable as before (its
 * functions register on load). The app build must not fail over this —
 * unmigrated MFs import things that don't exist in the server runtime.
 */
async function readDeclarations(dir: string, name: string): Promise<ActionDeclaration[]> {
	const source = await declarationsEntry(dir);
	if (!source) {
		console.warn(
			`[function-index] mf-${name}: no src/functions.ts nor src/functions/index.ts — module declares no functions`,
		);
		return [];
	}

	try {
		const bundle = await Bun.build({
			entrypoints: [source],
			target: "bun",
			format: "esm",
			plugins: [stubExternals],
		});
		if (!bundle.success) {
			console.warn(
				`[function-index] mf-${name}: declarations unbundlable — skipped (${bundle.logs.join("; ")})`,
			);
			return [];
		}

		// A data-URL import runs into the module name's length limit, so the
		// bundle travels through a file next to the rest of the build artifacts.
		//
		// The file can be neither deleted nor rewritten: `import()` puts it into
		// the module graph, and `bun --watch` restarts the process on any change
		// to a watched file. Deleting it after import drove the dev server into
		// an infinite "build → delete → restart → build" loop. The name is
		// derived from the content: a new bundle always gets a new path and a
		// fresh import, an unchanged one gets the same path and the same module cache.
		const text = await bundle.outputs[0].text();
		const compiled = join(tmpdir(), `fnidx-${Bun.hash(text).toString(36)}.mjs`);
		if (!(await Bun.file(compiled).exists())) await Bun.write(compiled, text);
		const module = (await withBrowserBootstrap(
			() => import(compiled) as Promise<DeclarationExports>,
		)) as DeclarationExports;
		const factories = module.default ?? module.ACTIONS;
		if (!Array.isArray(factories)) {
			console.warn(
				`[function-index] mf-${name}: ${source} must export an array of action factories ` +
					"as `default` or `ACTIONS` — skipped",
			);
			return [];
		}
		return factories.map((factory) => factory(declarationOnlyBus));
	} catch (error) {
		console.warn(
			`[function-index] mf-${name}: declarations unreadable — skipped (${
				error instanceof Error ? error.message : String(error)
			})`,
		);
		return [];
	}
}

export async function collectFunctionIndex(): Promise<FunctionIndex> {
	const entries: Array<[string, IndexedModule]> = [];
	for (const name of microfrontends) {
		const dir = microfrontendDir(name);
		// The stub must not fail the build: a factory that touched the bus simply
		// won't make it into the index — see readDeclarations.
		const brief = await readModuleBrief(dir);
		const declarations = await readDeclarations(dir, name);
		const llm = await readLlmCatalog(dir, name);

		entries.push([
			name,
			{
				module: `mf-${name}`,
				brief,
				functions: declarations.map((action) => {
					const meta = llm.actions[action.id];
					if (!meta) throw new Error(`[function-index] mf-${name}: missing llm metadata for ${action.id}`);
					return { id: action.id, ...meta, ...(action.access ? { access: action.access } : {}), ...(action.capability ? { capability: action.capability } : {}) };
				}),
			},
		]);
	}

	return { modules: Object.fromEntries(entries) };
}

/** Placed next to the modules' bundles: the same layer, the same lazy nature. */
export async function writeFunctionIndex(): Promise<string> {
	const index = await collectFunctionIndex();
	const target = join(microfrontendsDir, "index.json");
	await Bun.write(target, `${JSON.stringify(index, null, 2)}\n`);
	return target;
}
