/**
 * Where a checkout keeps its solutions and their verification.
 *
 * A layer is one `modules/solutions/<layer>.json` — converged, or club on top of
 * it through `extends`. Verification follows the same ownership as the
 * solutions themselves: a story lives beside the layer that owns its solution,
 * and running club's verification also runs converged's, because a club stack
 * is serving those solutions too.
 */
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { definitionFrom, readObject } from "../../dev/src/solution";
import {
	type Coverage,
	coverageOf,
	readStories,
	STORIES_FILE,
	type StoriesFile,
} from "./stories";

export const VERIFICATION_DIR = "verification";

export type Layer = {
	name: string;
	/** The checkout: `converged/` or `club/`. */
	root: string;
	/** Its `modules/solutions`. */
	solutionsDir: string;
	/** Solutions this layer deploys, dependencies first. */
	solutions: string[];
};

export type SolutionVerification = {
	layer: string;
	solution: string;
	/** `modules/solutions/verification/<solution>`, whether or not it exists yet. */
	dir: string;
	/** Absent when nobody has written the solution's stories yet. */
	stories?: StoriesFile;
	coverage?: Coverage;
};

/** The layer config a checkout runs with, matching the dev runner's default. */
export function configPathOf(projectDir: string): string {
	const explicit = process.env.SOLUTION_PATH?.trim();
	if (explicit) return resolve(explicit);
	const own = join(
		projectDir,
		"modules/solutions",
		`${basename(projectDir)}.json`,
	);
	return existsSync(own)
		? own
		: join(projectDir, "modules/solutions/converged.json");
}

function strings(value: unknown, where: string): string[] {
	if (value === undefined) return [];
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		throw new Error(`[verify] ${where} must be an array of strings`);
	}
	return value as string[];
}

/** Every layer a config stands on, the base first. */
export function layersOf(
	configPath: string,
	seen = new Set<string>(),
): Layer[] {
	const path = resolve(configPath);
	if (seen.has(path)) return [];
	seen.add(path);
	const config = readObject(path);
	const solutionsDir = dirname(path);
	const base = strings(config.extends, `${path}.extends`).flatMap((extension) =>
		layersOf(resolve(solutionsDir, extension), seen),
	);

	const solutions: string[] = [];
	const load = (name: string, trail: string[]) => {
		if (solutions.includes(name)) return;
		if (trail.includes(name)) {
			throw new Error(`[verify] cyclic solution dependency at "${name}"`);
		}
		const file = join(solutionsDir, "solutions", `${name}.json`);
		if (!existsSync(file)) {
			throw new Error(`[verify] solution "${name}" not found: ${file}`);
		}
		const definition = definitionFrom(readObject(file), file);
		for (const dependency of definition.dependencies ?? []) {
			load(dependency, [...trail, name]);
		}
		solutions.push(name);
	};
	for (const name of strings(config.solutions, `${path}.solutions`))
		load(name, []);

	const metadata = config.metadata as { name?: unknown } | undefined;
	return [
		...base,
		{
			name:
				typeof metadata?.name === "string"
					? metadata.name
					: basename(path, ".json"),
			root: resolve(solutionsDir, "../.."),
			solutionsDir,
			solutions,
		},
	];
}

export function verificationOf(
	layer: Layer,
	solution: string,
): SolutionVerification {
	const dir = join(layer.solutionsDir, VERIFICATION_DIR, solution);
	if (!existsSync(join(dir, STORIES_FILE))) {
		return { layer: layer.name, solution, dir };
	}
	const stories = readStories(dir);
	return {
		layer: layer.name,
		solution,
		dir,
		stories,
		coverage: coverageOf(dir, stories),
	};
}

/** Every solution the checkout deploys, with whatever verification it has. */
export function verificationsOf(projectDir: string): SolutionVerification[] {
	return layersOf(configPathOf(projectDir)).flatMap((layer) =>
		layer.solutions.map((solution) => verificationOf(layer, solution)),
	);
}
