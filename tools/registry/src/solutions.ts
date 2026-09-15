/**
 * The catalogue half of a registry build: what solutions this layer offers.
 *
 * A solution is not a deployment here. It is an entry in a list a person and an
 * assistant read — "what exists, what would it bring, what does it need first" —
 * and the cluster still only ever sees the `Solution` CR that lm-kubernetes
 * writes. What makes the two agree is that both come out of `modules/solutions`,
 * and that this catalogue is published by the same command that publishes the
 * module bytes: a solution and the modules it names cannot then land separately.
 *
 * `spec` is computed here, at build time, in exactly the shape `Solution.spec`
 * takes minus `platform`. Nothing downstream resolves anything — not the chat,
 * not lm-kubernetes, not ptah — because a resolver in the cluster would be a
 * second implementation of `resolveSolutionConfig` answering at a different time.
 *
 * Unlike `resolveSolutionConfig`, dependencies are *not* folded in. A catalogue
 * entry is one solution's own contribution plus the names it requires, so the
 * portal can say "this will also bring three others" before anything is applied,
 * and so installing two overlapping solutions does not store the shared modules
 * twice.
 */

import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import {
	definitionFrom,
	type MappingEntry,
	mappingsFrom,
	readObject,
} from "../../dev/src/solution";

/** One catalogue entry, as the registry and the portal read it. */
export type SolutionEntry = {
	name: string;
	title: string;
	summary: string;
	keywords: string[];
	description?: string;
	/** Solutions that have to be installed with this one, dependencies first. */
	requires: string[];
	spec: {
		repositories: string[];
		lambdas: string[];
		surfaces: string[];
		processors: string[];
		workflows: MappingEntry[];
	};
};

/** One layer's catalogue, published beside its `layers/<layer>.json`. */
export type SolutionsFile = {
	layer: string;
	extends: string[];
	/** Digest of the catalogue's own content, for the same reason modules have one. */
	revision: string;
	solutions: Record<string, Omit<SolutionEntry, "name">>;
};

/** Where catalogues live, relative to the registry root. */
export const SOLUTIONS_PREFIX = "solutions";

function strings(value: unknown, where: string): string[] {
	if (value === undefined) return [];
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		throw new Error(`[registry] ${where} must be an array of strings`);
	}
	return value as string[];
}

/**
 * The two fields a catalogue cannot be assembled without.
 *
 * Required rather than derived from the name: a solution with no title is a row
 * a person cannot choose and an assistant cannot describe, and inventing one
 * from the filename would hide that while looking like it worked. It fails here,
 * naming the file, which is one line to fix.
 */
function text(value: unknown, where: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`[registry] ${where} is required and must be a string`);
	}
	return value.trim();
}

function optionalText(value: unknown, where: string): string | undefined {
	if (value === undefined) return undefined;
	return text(value, where);
}

/**
 * Every module artifact a catalogue entry names.
 *
 * The prefixes are the registry's own naming rule (`discover.ts`): a solution
 * lists `orders`, the object is `rp-orders.js`. Workflows are already carried as
 * script paths, which is what the mapping keys them by.
 *
 * Processors are deliberately absent: they are peers declared on the Platform,
 * not modules in this registry, and ptah is the one that knows whether a cluster
 * has one.
 */
export function artifactsOf(entry: SolutionEntry): string[] {
	return [
		...entry.spec.repositories.map((name) => `rp-${name}.js`),
		...entry.spec.lambdas.map((name) => `lm-${name}.js`),
		...entry.spec.surfaces.map((name) => `sf-${name}.js`),
		...entry.spec.workflows.map((workflow) => workflow.script),
	];
}

/**
 * Which of those the registry cannot serve.
 *
 * This is the check that stops the failure the layered registry made possible:
 * a `Solution` naming a module absent from the mapping applies cleanly and then
 * kills the pod at boot, because `MODULE_DIGESTS` has no entry to resolve and
 * the container asks ptah for a digest nobody published. Catching it while
 * publishing costs a rejected build; catching it later costs a crash loop in
 * somebody's cluster.
 */
export function missingArtifacts(
	entries: SolutionEntry[],
	known: Set<string>,
): Array<{ solution: string; artifact: string }> {
	const missing: Array<{ solution: string; artifact: string }> = [];
	for (const entry of entries) {
		for (const artifact of artifactsOf(entry)) {
			if (!known.has(artifact))
				missing.push({ solution: entry.name, artifact });
		}
	}
	return missing;
}

function readEntry(
	solutionsDir: string,
	name: string,
	workflows: Map<string, MappingEntry>,
	mappingsPath: string,
): SolutionEntry {
	const path = join(solutionsDir, `${name}.json`);
	const raw = readObject(path);
	// The module lists go through the same reader the dev runner and the CRD
	// generator use, so a catalogue entry cannot describe a different selection
	// from the one those two produce.
	const definition = definitionFrom(raw, path);

	return {
		name,
		title: text(raw.title, `${path}.title`),
		summary: text(raw.summary, `${path}.summary`),
		keywords: strings(raw.keywords, `${path}.keywords`),
		...(optionalText(raw.description, `${path}.description`)
			? { description: optionalText(raw.description, `${path}.description`) }
			: {}),
		requires: definition.dependencies ?? [],
		spec: {
			repositories: definition.repositories ?? [],
			lambdas: definition.lambdas ?? [],
			surfaces: definition.surfaces ?? [],
			processors: definition.processors ?? [],
			workflows: (definition.workflows ?? []).map((workflowName) => {
				const workflow = workflows.get(workflowName);
				if (!workflow) {
					throw new Error(
						`[registry] ${path}: workflow "${workflowName}" is missing from ${mappingsPath}`,
					);
				}
				return workflow;
			}),
		},
	};
}

function sha256(text: string): string {
	return new Bun.CryptoHasher("sha256")
		.update(new TextEncoder().encode(text))
		.digest("hex");
}

export type CatalogOptions = {
	/** The checkout whose solutions are being catalogued — the publishing layer's. */
	projectDir: string;
	layer: string;
	extends: string[];
};

/**
 * Read a layer's whole catalogue off disk.
 *
 * Every file under `modules/solutions/solutions` is an entry, including ones no
 * current bundle selects: the catalogue's job is to say what exists, and a
 * solution that is buildable but unlisted is exactly the thing a person would
 * ask the chat for and be told does not exist.
 */
export function solutionCatalog(options: CatalogOptions): SolutionsFile {
	const root = join(options.projectDir, "modules/solutions");
	const solutionsDir = join(root, "solutions");
	const mappingsPath = join(root, "mapping.json");
	if (!existsSync(solutionsDir)) {
		return {
			layer: options.layer,
			extends: options.extends,
			revision: sha256("{}"),
			solutions: {},
		};
	}

	const workflows = existsSync(mappingsPath)
		? (mappingsFrom(readObject(mappingsPath), mappingsPath).get("workflows") ??
			new Map<string, MappingEntry>())
		: new Map<string, MappingEntry>();

	const names = readdirSync(solutionsDir)
		.filter((file) => file.endsWith(".json"))
		.map((file) => basename(file, ".json"))
		.sort();

	const solutions: Record<string, Omit<SolutionEntry, "name">> = {};
	for (const name of names) {
		const { name: _, ...entry } = readEntry(
			solutionsDir,
			name,
			workflows,
			mappingsPath,
		);
		solutions[name] = entry;
	}

	return {
		layer: options.layer,
		extends: options.extends,
		// The catalogue's own digest, for the same reason the mapping has one: two
		// builds of unchanged sources must produce the same revision.
		revision: sha256(JSON.stringify(solutions)),
		solutions,
	};
}

/** The catalogue as a list, which is how everything but the file format reads it. */
export function entriesOf(file: SolutionsFile): SolutionEntry[] {
	return Object.entries(file.solutions).map(([name, entry]) => ({
		name,
		...entry,
	}));
}
