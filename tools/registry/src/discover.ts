/**
 * Where the modules are on disk, for whoever is about to build them.
 *
 * The rule the rest of the platform already follows: a module's identity is its
 * bare name. `rp-orders` may sit directly under `modules/repositories` or one
 * category level down, and which of the two is an organisational detail that no
 * Solution, import map or registry mapping carries. Both layouts are scanned,
 * and the product layer shadows converged on a name collision — the same
 * precedence the dev loader applies.
 */

import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

export type Kind = "repositories" | "lambdas" | "surfaces" | "workflows";

export const PREFIX: Record<Kind, string> = {
	repositories: "rp-",
	lambdas: "lm-",
	surfaces: "sf-",
	workflows: "wf-",
};

export type Module = {
	kind: Kind;
	/** Bare name: `counters`, not `rp-counters`. */
	name: string;
	/** Which layer this module came from, as passed in `projectDirs`. */
	projectDir: string;
	/** Registry object name: `rp-counters.js`. */
	artifact: string;
	/** Absolute path to the module's entry source file. */
	implementation: string;
	/** Absolute path to generated NRPC metadata; repositories and lambdas only. */
	metadata?: string;
};

/** Entry file names a module may use, in the order the dev loader tries them. */
const ENTRY_CANDIDATES = [
	"src/index.ts",
	"src/index.tsx",
	"index.ts",
	"index.tsx",
	"src/service.ts",
	"service.ts",
];

function moduleDirs(modulesRoot: string, prefix: string): string[] {
	if (!existsSync(modulesRoot)) return [];
	const found: string[] = [];
	for (const entry of readdirSync(modulesRoot, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const path = join(modulesRoot, entry.name);
		if (entry.name.startsWith(prefix)) {
			found.push(path);
			continue;
		}
		for (const nested of readdirSync(path, { withFileTypes: true })) {
			if (nested.isDirectory() && nested.name.startsWith(prefix)) {
				found.push(join(path, nested.name));
			}
		}
	}
	return found;
}

function resolveEntry(moduleDir: string): string | null {
	for (const candidate of ENTRY_CANDIDATES) {
		const path = join(moduleDir, candidate);
		if (existsSync(path)) return path;
	}
	return null;
}

function resolveMetadata(projectDirs: string[], name: string): string | null {
	for (const projectDir of projectDirs) {
		const path = join(
			projectDir,
			"modules/generated",
			`g-${name}`,
			"src/index.ts",
		);
		if (existsSync(path)) return path;
	}
	return null;
}

export function discover(projectDirs: string[], kind: Kind): Module[] {
	const prefix = PREFIX[kind];
	const modules = new Map<string, Module>();

	for (const projectDir of projectDirs) {
		for (const dir of moduleDirs(join(projectDir, "modules", kind), prefix)) {
			const name = basename(dir).slice(prefix.length);
			if (modules.has(name)) continue;

			const implementation = resolveEntry(dir);
			if (!implementation) {
				console.warn(`[registry] ${prefix}${name}: no entry file, skipped`);
				continue;
			}
			// Workflow callers use a script path, unlike UI/backend module loaders that
			// use a bare artifact name. Keep that path in the registry mapping too.
			const artifact =
				kind === "workflows"
					? `workflows/${prefix}${name}.js`
					: `${prefix}${name}.js`;
			if (kind === "surfaces" || kind === "workflows") {
				modules.set(name, {
					kind,
					name,
					artifact,
					projectDir,
					implementation,
				});
				continue;
			}
			// A backend module without generated metadata cannot be registered, and
			// discovering that at boot in production is far worse than here.
			const metadata = resolveMetadata(projectDirs, name);
			if (!metadata) {
				console.warn(
					`[registry] ${prefix}${name}: no generated g-${name}, skipped`,
				);
				continue;
			}
			modules.set(name, {
				kind,
				name,
				artifact,
				projectDir,
				implementation,
				metadata,
			});
		}
	}

	return [...modules.values()].sort((a, b) => a.name.localeCompare(b.name));
}
