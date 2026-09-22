import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type JsonObject = Record<string, unknown>;

export type SolutionDefinition = {
	dependencies?: string[];
	mappings?: Record<string, string[]>;
	surfaces?: string[];
	repositories?: string[];
	lambdas?: string[];
	processors?: string[];
	workflows?: string[];
};

export type MappingEntry = {
	id?: string;
	name: string;
	script: string;
	/** Stable workflow category a UI can display and filter by. */
	type?: string;
	brief?: string;
	description?: string;
	parameters?: Record<string, unknown>;
	/** Valid example params, prefilled in the admin run form. */
	paramsExample?: Record<string, unknown>;
};

export type ResolvedSolution = {
	apiVersion: string;
	kind: string;
	metadata: { name: string };
	spec: {
		containers: Record<string, string[]>;
		mappings: Record<string, MappingEntry[]>;
		surfaces: string[];
		repositories: string[];
		lambdas: string[];
		processors: string[];
		workflows: MappingEntry[];
	};
};

export type SolutionConfig = {
	/** Container names grouped by the workspace/namespace that owns them. */
	containers: Record<string, string[]>;
	solutionNames: string[];
	solution: ResolvedSolution;
};

export function readObject(path: string): JsonObject {
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

function containerGroups(
	value: unknown,
	path: string,
): Record<string, string[]> {
	if (value === undefined) return {};
	if (Array.isArray(value)) {
		return { converged: strings(value, path) };
	}
	if (!value || typeof value !== "object") {
		throw new Error(`[dev] ${path} must be an array or an object of arrays`);
	}
	const groups: Record<string, string[]> = {};
	for (const [group, names] of Object.entries(value as JsonObject)) {
		groups[group] = unique(strings(names, `${path}.${group}`));
	}
	return groups;
}

function mergeContainerGroups(
	groups: Array<Record<string, string[]>>,
): Record<string, string[]> {
	const merged: Record<string, string[]> = {};
	for (const group of groups) {
		for (const [name, containers] of Object.entries(group)) {
			merged[name] = unique([...(merged[name] ?? []), ...containers]);
		}
	}
	return merged;
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

export function definitionFrom(
	value: JsonObject,
	path: string,
): SolutionDefinition {
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
		surfaces: strings(value.surfaces, `${path}.surfaces`),
		repositories: strings(value.repositories, `${path}.repositories`),
		lambdas: strings(value.lambdas, `${path}.lambdas`),
		processors: strings(value.processors, `${path}.processors`),
		workflows: strings(value.workflows, `${path}.workflows`),
	};
}

export function mappingsFrom(
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
			const {
				id,
				name,
				script,
				type,
				brief,
				description,
				parameters,
				paramsExample,
			} = entry as JsonObject;
			if (typeof name !== "string" || typeof script !== "string") {
				throw new Error(
					`[dev] ${path}.${group} entries require name and script`,
				);
			}
			const key = typeof id === "string" ? id : name;
			if (groupMappings.has(key)) {
				throw new Error(`[dev] ${path}.${group} duplicates "${key}"`);
			}
			if (type !== undefined && typeof type !== "string") {
				throw new Error(`[dev] ${path}.${group} ${key}.type must be a string`);
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
				...(typeof type === "string" && type.trim()
					? { type: type.trim() }
					: {}),
				...(typeof brief === "string" ? { brief } : {}),
				...(typeof description === "string" ? { description } : {}),
				...(parameters
					? { parameters: parameters as Record<string, unknown> }
					: {}),
				...(paramsExample &&
				typeof paramsExample === "object" &&
				!Array.isArray(paramsExample)
					? { paramsExample: paramsExample as Record<string, unknown> }
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
	const containers = containerGroups(
		root.containers,
		`${configPath}.containers`,
	);
	const mappingsPath = resolve(rootDir, "mapping.json");
	const mappings = mappingsFrom(readObject(mappingsPath), mappingsPath);

	const loaded = new Set<string>();
	const visiting = new Set<string>();
	const repositories: string[] = [];
	const lambdas: string[] = [];
	const surfaces: string[] = [];
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
		repositories.push(...(definition.repositories ?? []));
		lambdas.push(...(definition.lambdas ?? []));
		surfaces.push(...(definition.surfaces ?? []));
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
		containers: mergeContainerGroups([
			...extensions.map((extension) => extension.containers),
			containers,
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
				containers: mergeContainerGroups([
					...extensions.map((extension) => extension.solution.spec.containers),
					containers,
				]),
				mappings: allMappings,
				surfaces: unique([
					...extensions.flatMap(
						(extension) => extension.solution.spec.surfaces,
					),
					...surfaces,
				]),
				repositories: unique([
					...extensions.flatMap(
						(extension) => extension.solution.spec.repositories,
					),
					...repositories,
				]),
				lambdas: unique([
					...extensions.flatMap((extension) => extension.solution.spec.lambdas),
					...lambdas,
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
