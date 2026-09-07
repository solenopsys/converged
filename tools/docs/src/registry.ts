/**
 * The module registry, read from the source tree.
 *
 * Nothing here is authored: a module exists because its directory exists, it
 * belongs to a domain because it sits in that domain's folder, and it belongs
 * to a solution because `modules/solutions/solutions.json` lists it. The one
 * hand-written part is the prose, and that lives in the module's own README —
 * still at the source, still next to the code it describes.
 *
 *   <project>/modules/repositories/<domain>/rp-<name>
 *   <project>/modules/lambdas/<domain>/lm-<name>
 *   <project>/modules/surfaces/<domain>/sf-<name>
 *   <project>/modules/workflows/wf-<name>
 *
 * A downstream product may drop the domain level (`club` does), so the domain
 * segment is optional and its absence means "the project is the group".
 */

import { existsSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";

export type ModuleKind = "repository" | "lambda" | "surface" | "workflow";

/** Directory under `modules/` → what lives in it. */
const LAYOUT: Record<string, { kind: ModuleKind; prefix: string }> = {
	repositories: { kind: "repository", prefix: "rp-" },
	lambdas: { kind: "lambda", prefix: "lm-" },
	surfaces: { kind: "surface", prefix: "sf-" },
	workflows: { kind: "workflow", prefix: "wf-" },
};

/**
 * How a solution names its members. Both spellings occur: one file per
 * solution uses the long keys, the aggregate `solutions.json` uses the short
 * ones. Either way the value is a bare name, and the prefix comes from here.
 */
const MEMBER_KEYS: Array<{ long: string; short: string; prefix: string }> = [
	{ long: "repositories", short: "rp", prefix: "rp-" },
	{ long: "lambdas", short: "lm", prefix: "lm-" },
	{ long: "surfaces", short: "sf", prefix: "sf-" },
	{ long: "workflows", short: "wf", prefix: "wf-" },
];

export type ModuleEntry = {
	/** Package name, e.g. `rp-notify`. */
	name: string;
	kind: ModuleKind;
	/** Folder the module sits in; empty when the project has no domain level. */
	domain: string;
	/** Project the module belongs to, by directory name. */
	project: string;
	/** Path inside the project, for source links. */
	path: string;
	/** First paragraph under `## Purpose` / `## UI Purpose` in the README. */
	purpose: string;
	/** First paragraph under the `Boundary` heading, when the README has one. */
	boundary: string;
	/** Direct workspace-module dependencies declared by the package. */
	dependencies: string[];
};

export type SolutionEntry = {
	id: string;
	project: string;
	/** Module names, in registry order. */
	modules: string[];
	/** Ids of solutions this one needs. */
	depends: string[];
};

export type Registry = {
	modules: ModuleEntry[];
	solutions: SolutionEntry[];
};

function subdirs(path: string): string[] {
	if (!existsSync(path)) return [];
	return readdirSync(path, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
}

/**
 * The paragraph under a heading, as plain text.
 *
 * READMEs are the contract here, so the parse stays deliberately shallow: the
 * first paragraph after the heading, stopping at the next heading. Anything
 * richer belongs in `docs/`, which has a real pipeline.
 */
function section(markdown: string, heading: RegExp): string {
	const lines = markdown.split("\n");
	const start = lines.findIndex((line) => heading.test(line));
	if (start === -1) return "";

	const body: string[] = [];
	for (const line of lines.slice(start + 1)) {
		if (/^#{1,6}\s/.test(line)) break;
		if (line.trim().length === 0) {
			if (body.length > 0) break;
			continue;
		}
		body.push(line.trim());
	}
	return body.join(" ").replace(/\s+/g, " ").trim();
}

async function readPurpose(
	dir: string,
): Promise<{ purpose: string; boundary: string }> {
	const path = join(dir, "README.md");
	if (!existsSync(path)) return { purpose: "", boundary: "" };

	const markdown = await Bun.file(path).text();
	return {
		purpose: section(markdown, /^#{2,3}\s+(UI\s+)?Purpose\b/i),
		boundary: section(markdown, /^#{2,3}\s+.*Boundary\b/i),
	};
}

async function readDependencies(dir: string): Promise<string[]> {
	const path = join(dir, "package.json");
	if (!existsSync(path)) return [];

	const pkg = (await Bun.file(path).json()) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	return [
		...Object.keys(pkg.dependencies ?? {}),
		...Object.keys(pkg.devDependencies ?? {}),
	]
		.filter((name) => /^(rp|lm|sf|wf)-/.test(name))
		.filter((name, index, values) => values.indexOf(name) === index)
		.sort();
}

async function readModules(
	project: string,
	projectName: string,
): Promise<ModuleEntry[]> {
	const modulesRoot = join(project, "modules");
	const found: ModuleEntry[] = [];

	for (const [dir, { kind, prefix }] of Object.entries(LAYOUT)) {
		const kindRoot = join(modulesRoot, dir);

		// One pass over both layouts: a child either is a module already, or is a
		// domain holding them. Nothing deeper is a module.
		for (const child of subdirs(kindRoot)) {
			const childPath = join(kindRoot, child);
			const candidates = child.startsWith(prefix)
				? [{ name: child, path: childPath, domain: "" }]
				: subdirs(childPath)
						.filter((name) => name.startsWith(prefix))
						.map((name) => ({
							name,
							path: join(childPath, name),
							domain: child,
						}));

			for (const candidate of candidates) {
				const { purpose, boundary } = await readPurpose(candidate.path);
				found.push({
					name: candidate.name,
					kind,
					domain: candidate.domain,
					project: projectName,
					path: relative(project, candidate.path),
					purpose,
					boundary,
					dependencies: await readDependencies(candidate.path),
				});
			}
		}
	}

	return found;
}

/** One solution as written, in either spelling. */
type RawSolution = Record<string, string[] | undefined>;

function toSolution(
	id: string,
	body: RawSolution,
	projectName: string,
	modules: ModuleEntry[],
): SolutionEntry {
	const known = new Set(modules.map((module) => module.name));
	const order = new Map(modules.map((module, index) => [module.name, index]));
	const names: string[] = [];

	for (const { long, short, prefix } of MEMBER_KEYS) {
		for (const member of body[long] ?? body[short] ?? []) {
			const name = `${prefix}${member}`;
			// A solution may name a module that is not checked out — the product
			// layer is a submodule — so unknown names are dropped, not fatal.
			if (known.has(name)) names.push(name);
		}
	}

	names.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
	return {
		id,
		project: projectName,
		modules: names,
		depends: body.dependencies ?? body.depends ?? [],
	};
}

/**
 * Solutions of one project.
 *
 * `solutions/<id>.json` is the form every project has, so it is read first;
 * the aggregate `solutions.json` is the older shape and only answers when the
 * directory is absent. Reading both would double-count.
 */
async function readSolutions(
	project: string,
	projectName: string,
	modules: ModuleEntry[],
): Promise<SolutionEntry[]> {
	const root = join(project, "modules", "solutions");
	const perFile = join(root, "solutions");

	if (existsSync(perFile)) {
		const files = readdirSync(perFile)
			.filter((name) => name.endsWith(".json"))
			.sort();
		const solutions: SolutionEntry[] = [];
		for (const file of files) {
			const body = (await Bun.file(join(perFile, file)).json()) as RawSolution;
			solutions.push(
				toSolution(file.replace(/\.json$/, ""), body, projectName, modules),
			);
		}
		return solutions;
	}

	const aggregate = join(root, "solutions.json");
	if (!existsSync(aggregate)) return [];

	const raw = (await Bun.file(aggregate).json()) as Record<string, RawSolution>;
	return Object.entries(raw).map(([id, body]) =>
		toSolution(id, body, projectName, modules),
	);
}

/** Everything the ecosystem page needs, across every checked-out project. */
export async function readRegistry(projects: string[]): Promise<Registry> {
	const modules: ModuleEntry[] = [];
	const solutions: SolutionEntry[] = [];

	for (const project of projects) {
		const name = basename(project);
		const found = await readModules(project, name);
		modules.push(...found);
		solutions.push(...(await readSolutions(project, name, found)));
	}

	modules.sort(
		(a, b) =>
			a.project.localeCompare(b.project) ||
			a.domain.localeCompare(b.domain) ||
			a.name.localeCompare(b.name),
	);
	const knownModules = new Set(modules.map((module) => module.name));
	for (const module of modules) {
		module.dependencies = module.dependencies.filter((name) =>
			knownModules.has(name),
		);
	}

	return { modules, solutions };
}
