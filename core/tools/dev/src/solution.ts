import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type JsonObject = Record<string, unknown>;

type SolutionDefinition = {
	dependencies?: string[];
	mappings?: Record<string, string[]>;
	microfrontends?: string[];
	microservices?: string[];
	processors?: string[];
	workflows?: string[];
};

type MappingEntry = {
	id?: string;
	name: string;
	script: string;
	brief?: string;
	description?: string;
	parameters?: Record<string, unknown>;
};

export type ResolvedSolution = {
	apiVersion: string;
	kind: string;
	metadata: { name: string };
	spec: {
		mappings: Record<string, MappingEntry[]>;
		microfrontends: string[];
		microservices: string[];
		processors: string[];
		workflows: MappingEntry[];
	};
};

export type SolutionConfig = {
	containers: string[];
	solutionNames: string[];
	solution: ResolvedSolution;
};

function readObject(path: string): JsonObject {
	let value: unknown;
	try {
		value = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		throw new Error(`[dev] cannot read JSON ${path}: ${String(error)}`);
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`[dev] ${path} must contain a JSON object`);
	}
	return value as JsonObject;
}

function strings(value: unknown, path: string): string[] {
	if (value === undefined) return [];
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		throw new Error(`[dev] ${path} must be an array of strings`);
	}
	return value;
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function mergeMappings(
	mappings: Array<Record<string, MappingEntry[]>>,
): Record<string, MappingEntry[]> {
	const merged: Record<string, MappingEntry[]> = {};
	for (const source of mappings) {
		for (const [group, entries] of Object.entries(source)) {
			const target = merged[group] ?? [];
			for (const entry of entries) {
				if (!target.some(({ name }) => name === entry.name)) target.push(entry);
			}
			merged[group] = target;
		}
	}
	return merged;
}

function definitionFrom(value: JsonObject, path: string): SolutionDefinition {
	const mappings: Record<string, string[]> = {};
	if (value.mappings !== undefined) {
		if (
			!value.mappings ||
			typeof value.mappings !== "object" ||
			Array.isArray(value.mappings)
		) {
			throw new Error(`[dev] ${path}.mappings must be an object`);
		}
		for (const [group, names] of Object.entries(value.mappings as JsonObject)) {
			mappings[group] = strings(names, `${path}.mappings.${group}`);
		}
	}

	return {
		dependencies: strings(value.dependencies, `${path}.dependencies`),
		mappings,
		microfrontends: strings(value.microfrontends, `${path}.microfrontends`),
		microservices: strings(value.microservices, `${path}.microservices`),
		processors: strings(value.processors, `${path}.processors`),
		workflows: strings(value.workflows, `${path}.workflows`),
	};
}

function mappingsFrom(
	value: JsonObject,
	path: string,
): Map<string, Map<string, MappingEntry>> {
	const mappings = new Map<string, Map<string, MappingEntry>>();
	for (const [group, entries] of Object.entries(value)) {
		if (!Array.isArray(entries)) {
			throw new Error(`[dev] ${path}.${group} must be an array`);
		}
		const groupMappings = new Map<string, MappingEntry>();
		for (const entry of entries) {
			if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
				throw new Error(`[dev] ${path}.${group} contains an invalid entry`);
			}
			const { id, name, script, brief, description, parameters } =
				entry as JsonObject;
			if (typeof name !== "string" || typeof script !== "string") {
				throw new Error(
					`[dev] ${path}.${group} entries require name and script`,
				);
			}
			const key = typeof id === "string" ? id : name;
			if (groupMappings.has(key)) {
				throw new Error(`[dev] ${path}.${group} duplicates "${key}"`);
			}
			if (
				parameters !== undefined &&
				(!parameters ||
					typeof parameters !== "object" ||
					Array.isArray(parameters))
			) {
				throw new Error(
					`[dev] ${path}.${group} ${key}.parameters must be an object`,
				);
			}
			groupMappings.set(key, {
				...(typeof id === "string" ? { id } : {}),
				name,
				script,
				...(typeof brief === "string" ? { brief } : {}),
				...(typeof description === "string" ? { description } : {}),
				...(parameters
					? { parameters: parameters as Record<string, unknown> }
					: {}),
			});
		}
		mappings.set(group, groupMappings);
	}
	return mappings;
}

/**
 * Assemble the legacy Solution manifest from the declarative solution set.
 * `mapping.json` is the registry of source links. `workflows` selects the
 * current Centimanus group, while `mappings` can select any future group.
 */
export function resolveSolutionConfig(configPath: string): SolutionConfig {
	const root = readObject(configPath);
	const rootDir = dirname(configPath);
	const extensions = strings(root.extends, `${configPath}.extends`).map(
		(extension) => resolveSolutionConfig(resolve(rootDir, extension)),
	);
	const solutionNames = strings(root.solutions, `${configPath}.solutions`);
	if (solutionNames.length === 0) {
		throw new Error(
			`[dev] ${configPath}.solutions must select at least one solution`,
		);
	}

	const metadata = root.metadata;
	const metadataName =
		metadata && typeof metadata === "object" && !Array.isArray(metadata)
			? (metadata as JsonObject).name
			: undefined;
	const name = typeof metadataName === "string" ? metadataName : "converged";
	const containers = strings(root.containers, `${configPath}.containers`);
	const mappingsPath = resolve(rootDir, "mapping.json");
	const mappings = mappingsFrom(readObject(mappingsPath), mappingsPath);

	const loaded = new Set<string>();
	const visiting = new Set<string>();
	const microservices: string[] = [];
	const microfrontends: string[] = [];
	const processors: string[] = [];
	const mappingNames = new Map<string, string[]>();
	const selectMappings = (group: string, names: string[]) => {
		if (names.length === 0) return;
		const selected = mappingNames.get(group) ?? [];
		selected.push(...names);
		mappingNames.set(group, selected);
	};

	const load = (solutionName: string) => {
		if (loaded.has(solutionName)) return;
		if (visiting.has(solutionName)) {
			throw new Error(`[dev] cyclic solution dependency at "${solutionName}"`);
		}
		const path = resolve(rootDir, "solutions", `${solutionName}.json`);
		if (!existsSync(path)) {
			throw new Error(`[dev] solution "${solutionName}" not found: ${path}`);
		}
		visiting.add(solutionName);
		const definition = definitionFrom(readObject(path), path);
		for (const dependency of definition.dependencies ?? []) load(dependency);
		microservices.push(...(definition.microservices ?? []));
		microfrontends.push(...(definition.microfrontends ?? []));
		processors.push(...(definition.processors ?? []));
		selectMappings("workflows", definition.workflows ?? []);
		for (const [group, names] of Object.entries(definition.mappings ?? {})) {
			selectMappings(group, names);
		}
		visiting.delete(solutionName);
		loaded.add(solutionName);
	};

	for (const solutionName of solutionNames) load(solutionName);
	const resolvedMappings: Record<string, MappingEntry[]> = {};
	for (const [group, selectedNames] of mappingNames) {
		const available = mappings.get(group);
		if (!available) {
			throw new Error(
				`[dev] solution references mapping group "${group}" missing from ${mappingsPath}`,
			);
		}
		resolvedMappings[group] = unique(selectedNames).map((mappingName) => {
			const mapping = available.get(mappingName);
			if (!mapping) {
				throw new Error(
					`[dev] solution references ${group} mapping "${mappingName}" missing from ${mappingsPath}`,
				);
			}
			return mapping;
		});
	}

	const allMappings = mergeMappings([
		...extensions.map((extension) => extension.solution.spec.mappings),
		resolvedMappings,
	]);

	return {
		containers: unique([
			...extensions.flatMap((extension) => extension.containers),
			...containers,
		]),
		solutionNames: [
			...extensions.flatMap((extension) => extension.solutionNames),
			...loaded,
		],
		solution: {
			apiVersion: "ptah.io/v1alpha1",
			kind: "Solution",
			metadata: { name },
			spec: {
				mappings: allMappings,
				microfrontends: unique([
					...extensions.flatMap(
						(extension) => extension.solution.spec.microfrontends,
					),
					...microfrontends,
				]),
				microservices: unique([
					...extensions.flatMap(
						(extension) => extension.solution.spec.microservices,
					),
					...microservices,
				]),
				processors: unique([
					...extensions.flatMap(
						(extension) => extension.solution.spec.processors,
					),
					...processors,
				]),
				workflows: allMappings.workflows ?? [],
			},
		},
	};
}
