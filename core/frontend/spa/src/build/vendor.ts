import { dirname, join, resolve } from "node:path";
import { importMapSpecifiers } from "./import-map";
import {
	clientBuildDefines,
	frontCoreRoot,
	isProduction,
	microfrontendContractRoots,
	vendorDir,
	vendorEntriesDir,
} from "./layout";

/**
 * The page's shared runtime: every import map specifier leads to exactly one
 * file in this layer. The `mf` layer is excluded from the critical path — it
 * arrives with the first microfrontend.
 */

const sharedPreactExternals = [
	"preact",
	"preact/compat",
	"preact/hooks",
	"preact/jsx-runtime",
	"preact/jsx-dev-runtime",
];

/**
 * `preact/hooks` inside the compat build leads to its own proxy module: the
 * `export * from "preact/hooks"` star must stay internal, otherwise the
 * bundler loses it at the external boundary. The hooks still arrive from the
 * shared preact.js on the outside.
 */
const preactHooksProxy: Bun.BunPlugin = {
	name: "preact-hooks-proxy",
	setup(build) {
		build.onResolve({ filter: /^preact\/hooks$/ }, () => ({
			path: join(vendorEntriesDir, "preact-hooks-proxy.ts"),
		}));
	},
};

// The action registry is a page singleton: microfrontends fill it via plug(bus)
// and the delivery index declares into it, while the chat and the shell read it.
// That holds only because "front-core/core" is external to every bundle.
//
// A relative import crosses that boundary silently — "../../core" gets bundled
// in, and the page ends up with a second, empty registry. The symptom (an empty
// catalog next to forty functions) points nowhere near the import, so it is
// checked here.
//
// A source scan, not an onResolve hook: any onResolve filter matching relative
// paths disables tsconfig-driven JSX resolution in Bun, even when the hook
// returns null, and the whole bundle then fails on "react/jsx-dev-runtime".
const coreDir = join(frontCoreRoot, "src", "core");

const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*["'](\.\.?\/[^"']+)["']/g;

async function assertCoreSingleton(): Promise<void> {
	const sources = new Bun.Glob("**/*.{ts,tsx}").scanSync({
		cwd: join(frontCoreRoot, "src"),
		absolute: true,
	});

	const offenders: string[] = [];
	for (const file of sources) {
		if (file.startsWith(`${coreDir}/`)) continue;
		const text = await Bun.file(file).text();
		for (const [, specifier] of text.matchAll(RELATIVE_IMPORT)) {
			const target = resolve(dirname(file), specifier);
			if (target === coreDir || target.startsWith(`${coreDir}/`)) {
				offenders.push(`${file}: "${specifier}"`);
			}
		}
	}

	if (offenders.length > 0) {
		throw new Error(
			`[vendor] The action registry is imported relatively, which bundles a second, empty copy.\n` +
				`Use the bare specifier "front-core/core" — it stays external.\n  ${offenders.join("\n  ")}`,
		);
	}
}

/**
 * The delivery build keeps `front-core` external so every microfrontend uses
 * the page singleton. Build each module once more with the real source linked
 * in: Bun then validates every named ESM import before a browser sees it.
 */
export async function assertMicrofrontendPublicApi(
	entries?: readonly string[],
): Promise<void> {
	const contractEntries: string[] = [
		...(entries ??
			microfrontendContractRoots().flatMap((root) =>
				Array.from(
					new Bun.Glob("**/mf-*/src/index.ts").scanSync({
						cwd: root,
						absolute: true,
					}),
				),
			)),
	].sort();
	const external = importMapSpecifiers.filter(
		(specifier) =>
			specifier !== "front-core" && !specifier.startsWith("front-core/"),
	);
	type BuildFailure = {
		errors?: Array<{
			message: string;
			position?: { file?: string; line?: number; column?: number };
		}>;
	};
	type ContractFailure = { entry: string; error: BuildFailure };
	const results: Array<ContractFailure | undefined> = await Promise.all(
		contractEntries.map(async (entry) => {
			try {
				const config = {
					entrypoints: [entry],
					target: "browser",
					format: "esm",
					external,
					define: clientBuildDefines,
					minify: true,
					write: false,
				} as Bun.BuildConfig;
				await Bun.build(config);
				return undefined;
			} catch (error) {
				return {
					entry,
					error: error as BuildFailure,
				} satisfies ContractFailure;
			}
		}),
	);
	const failures = results.filter((failure): failure is ContractFailure =>
		Boolean(failure),
	);
	if (failures.length === 0) return;
	const details = failures
		.flatMap(({ entry, error }) =>
			(error.errors ?? [{ message: "Bundle failed" }]).map(
				({ message, position }) => {
					const location = position?.file
						? `${position.file}:${position.line ?? 0}:${position.column ?? 0}`
						: entry;
					return `${location}: ${message}`;
				},
			),
		)
		.join("\n  ");
	throw new Error(
		`[vendor] Microfrontend public API contract failed.\n` +
			`The delivery keeps front-core external, so this linked validation prevents browser-only import errors.\n  ${details}`,
	);
}

export type VendorBuild = {
	name: string;
	entrypoint: string;
	outfile: string;
	external: readonly string[];
	plugins?: Bun.BunPlugin[];
	/** `mf` — the microfrontend layer: it's not in the page's startup. */
	layer?: "app" | "mf";
};

export const vendorBuilds: readonly VendorBuild[] = [
	{
		name: "preact",
		entrypoint: "preact.ts",
		outfile: "preact.js",
		external: [],
	},
	{
		name: "preact-compat",
		entrypoint: "preact-compat.ts",
		outfile: "preact-compat.js",
		external: ["preact", "preact/jsx-runtime"],
		plugins: [preactHooksProxy],
		layer: "mf",
	},
	{
		name: "effector",
		entrypoint: "effector.ts",
		outfile: "effector.js",
		external: sharedPreactExternals,
	},
	{
		name: "effector-inspect",
		entrypoint: "effector-inspect.ts",
		outfile: "effector-inspect.js",
		external: ["effector"],
	},
	{
		name: "zag",
		entrypoint: "zag.ts",
		outfile: "zag.js",
		external: sharedPreactExternals,
	},
	{
		name: "d3",
		entrypoint: "d3.ts",
		outfile: "d3.js",
		layer: "mf",
		external: [],
	},
	{
		name: "nrpc",
		entrypoint: "nrpc.ts",
		outfile: "nrpc.js",
		external: [],
	},
	{
		name: "signal-channel",
		entrypoint: "signal-channel.ts",
		outfile: "signal-channel.js",
		external: ["nrpc", "effector"],
	},
	{
		name: "front-core-core",
		entrypoint: "front-core-core.ts",
		outfile: "front-core-core.js",
		external: ["effector"],
	},
	{
		name: "front-core-object-runtime",
		entrypoint: "front-core-object-runtime.ts",
		outfile: "front-core-object-runtime.js",
		external: ["effector"],
	},
	{
		name: "front-core",
		entrypoint: "front-core.ts",
		outfile: "front-core.js",
		layer: "mf",
		// The tabs and menu machines are bundled in: the import map addresses
		// packages by name, and `/vendor/zag.js` is a tooltip bundle from which
		// `@zag-js/tabs` can't be reached as its own namespace. A copy of the core
		// costs less than another file layer, and it's outside the critical path.
		external: [
			...sharedPreactExternals,
			"effector",
			"effector-preact",
			"front-core/core",
			"front-core/object-runtime",
			"front-core/table",
			"nrpc",
			"signal-channel",
		],
	},
	{
		name: "front-core-table",
		entrypoint: "front-core-table.ts",
		outfile: "front-core-table.js",
		layer: "mf",
		external: [
			...sharedPreactExternals,
			"effector",
			"effector-preact",
			"front-core",
			"front-core/core",
		],
	},
];

async function assertSingleTransportOwner(config: VendorBuild): Promise<void> {
	if (config.name === "signal-channel") return;

	const output = await Bun.file(join(vendorDir, config.outfile)).text();
	if (
		output.includes("__FUJIN_SIGNAL_CHANNEL__") ||
		output.includes("new WebSocket")
	) {
		throw new Error(
			`[vendor] ${config.outfile} embeds the Fujin transport. ` +
				`Only signal-channel.js may own the page WebSocket.`,
		);
	}
}

export function vendorLayerFiles(layer: "app" | "mf"): string[] {
	return vendorBuilds
		.filter((config) => (config.layer ?? "app") === layer)
		.map(({ outfile }) => join(vendorDir, outfile));
}

export async function buildVendor(): Promise<string[]> {
	await assertCoreSingleton();

	for (const config of vendorBuilds) {
		const result = await Bun.build({
			entrypoints: [join(vendorEntriesDir, config.entrypoint)],
			outdir: vendorDir,
			naming: config.outfile,
			target: "browser",
			format: "esm",
			external: [...config.external],
			define: clientBuildDefines,
			plugins: config.plugins ?? [],
			minify: true,
			sourcemap: isProduction ? "none" : "linked",
		});

		if (!result.success) {
			throw new AggregateError(
				result.logs,
				`Build failed: vendor/${config.name}`,
			);
		}
		await assertSingleTransportOwner(config);
	}

	return vendorBuilds.map(({ outfile }) => join(vendorDir, outfile));
}
