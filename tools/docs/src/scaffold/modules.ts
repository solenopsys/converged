/**
 * Creates the first English documentation page beside every registry module.
 *
 * The scaffold deliberately never overwrites an existing article: it gets a
 * module into the common index with the facts already declared in source, then
 * its owner expands the prose where the implementation lives.
 */

import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { loadConfig } from "../config";
import { type ModuleEntry, type Registry, readRegistry } from "../registry";

const DOMAIN_TITLES: Record<string, string> = {
	ai: "AI and agents",
	analytics: "Analytics and telemetry",
	automation: "Automation and orchestration",
	business: "Business domain",
	communications: "Communications",
	content: "Content and documents",
	convertors: "Model conversion",
	data: "Files and storage",
	providers: "Message delivery providers",
	sequrity: "Access and security",
	workflows: "Workflows",
};

const MODULE_PURPOSES: Record<string, string> = {
	"sf-secrets":
		"Provides the administration interface for creating, viewing, updating, and deleting named secret records.",
	"rp-environment":
		"Stores and retrieves environment configuration associated with platform users.",
	"lm-secrets":
		"Provides the service contract for storing, retrieving, and deleting named secret values.",
	"sf-contexts":
		"Provides the AI workspace for listing, editing, and saving named contexts in multiple languages.",
	"sf-functions":
		"Provides the AI workspace for browsing, searching, registering, and executing function definitions.",
	"rp-contexts":
		"Provides storage and retrieval of named AI contexts, including their language variants.",
	"rp-functions":
		"Provides the registry and search surface for callable AI function definitions and their embeddings.",
	"rp-counters":
		"Provides the service contract for collecting and querying analytical counters.",
	"rp-dashboard":
		"Provides dashboard data and analytical views for platform metrics.",
	"lm-kubernetes":
		"Integrates platform automation with Kubernetes resources through a dedicated client and service contract.",
	"sf-orders":
		"Provides the sales interface for order and request lists, order details, status filtering, and operational dashboards.",
	"rp-events": "Provides creation, storage, and retrieval of business events.",
	"rp-finance":
		"Provides finance operations for transactions, period summaries, cashflow, receivables, and payables.",
	"rp-orders":
		"Provides the service contract for creating, updating, listing, and tracking business orders.",
	"rp-resonus":
		"Provides communication configuration for managed phone numbers and LLM gate settings.",
	"sf-classifier":
		"Provides the classifier interface for navigating entities, mappings, and tree structures.",
	"sf-scripts":
		"Provides the content interface for listing, reading, editing, saving, and deleting script files.",
	"sf-static":
		"Provides the operations interface for inspecting and clearing static SSR cache entries.",
	"rp-scripts":
		"Provides storage operations for script files, including reading, saving, hashing, and deletion.",
	"rp-static":
		"Provides the service contract for static content and SSR cache metadata.",
	"wf-dialogue-summary":
		"Summarizes unprocessed chat and call dialogues with an LLM, then stores titles, descriptions, and noise classification.",
	"wf-files-process":
		"Processes uploaded files in batches: it expands archives, identifies model files, and creates a manufacturing request from them.",
	"wf-file-analyze":
		"Analyzes one stored non-archive file, producing model previews and CNC or 3D-print estimates when supported.",
	"wf-file-unpack":
		"Expands one uploaded archive into a collection of stored files for subsequent analysis.",
};

function legacyPurpose(module: ModuleEntry): string {
	return `Provides the ${module.name} capability in the ${module.domain || module.kind} domain.`;
}

function purpose(module: ModuleEntry): string {
	return (
		MODULE_PURPOSES[module.name] ||
		module.purpose ||
		`${module.name} is a ${module.kind} in the ${module.domain || "platform"} domain. Its detailed purpose is maintained with the module source.`
	);
}

function markdown(module: ModuleEntry, registry: Registry): string {
	const solutions = registry.solutions
		.filter((solution) => solution.modules.includes(module.name))
		.map((solution) => solution.id)
		.sort();
	const boundary =
		module.boundary ||
		"The module boundary is defined by its public contracts and implementation directory.";
	const dependencies = module.dependencies.length
		? module.dependencies.map((name) => `- \`${name}\``).join("\n")
		: "- None";
	const membership = solutions.length
		? solutions.map((id) => `- \`${id}\``).join("\n")
		: "- Not included in a predefined solution";

	return `# ${module.name}

## Purpose

${purpose(module)}

## Responsibility boundary

${boundary}

## Direct module dependencies

${dependencies}

## Solution membership

${membership}

## Source

\`${module.path}\`
`;
}

function catalog(registry: Registry, project: string): string {
	const solutionsByModule = new Map<string, string[]>();
	for (const solution of registry.solutions) {
		for (const module of solution.modules) {
			solutionsByModule.set(module, [
				...(solutionsByModule.get(module) ?? []),
				solution.id,
			]);
		}
	}

	const groups = new Map<string, ModuleEntry[]>();
	for (const module of registry.modules.filter(
		(module) => module.project === project,
	)) {
		const domain =
			DOMAIN_TITLES[module.domain] ??
			(module.domain || (module.kind === "workflow" ? "Workflows" : "Other"));
		groups.set(domain, [...(groups.get(domain) ?? []), module]);
	}

	const lines = [
		"# Module catalogue",
		"",
		"This index is generated from the Converged module registry. Every entry links to documentation owned by that module; dependencies are taken from its workspace package manifest, and solution membership comes from `modules/solutions`.",
		"",
	];

	for (const [domain, modules] of [...groups.entries()].sort(([a], [b]) =>
		a.localeCompare(b),
	)) {
		lines.push(`## ${domain}`, "");
		for (const module of modules.sort((a, b) => a.name.localeCompare(b.name))) {
			lines.push(`### [${module.name}](/en/docs/modules/${module.name})`, "");
			lines.push(purpose(module), "");
			lines.push(
				`- Direct dependencies: ${module.dependencies.length ? module.dependencies.map((name) => `\`${name}\``).join(", ") : "none"}`,
			);
			const solutions = solutionsByModule.get(module.name) ?? [];
			lines.push(
				`- Solutions: ${solutions.length ? solutions.map((id) => `\`${id}\``).join(", ") : "none"}`,
				"",
			);
		}
	}

	lines.push("## Solution dependencies", "");
	for (const solution of registry.solutions.filter(
		(solution) => solution.project === project,
	)) {
		lines.push(
			`- \`${solution.id}\`: ${solution.depends.length ? solution.depends.map((id) => `\`${id}\``).join(", ") : "no solution dependencies"}`,
		);
	}

	return `${lines.join("\n").trimEnd()}\n`;
}

async function write(
	path: string,
	content: string,
	dryRun: boolean,
): Promise<boolean> {
	if (existsSync(path)) return false;
	if (!dryRun) {
		mkdirSync(dirname(path), { recursive: true });
		await Bun.write(path, content);
	}
	return true;
}

/** Refresh only pages written by the first generated template, never owner prose. */
async function writeArticle(
	path: string,
	content: string,
	module: ModuleEntry,
	dryRun: boolean,
): Promise<"created" | "updated" | "existing"> {
	if (!existsSync(path)) {
		if (!dryRun) {
			mkdirSync(dirname(path), { recursive: true });
			await Bun.write(path, content);
		}
		return "created";
	}

	const existing = await Bun.file(path).text();
	if (!existing.includes(legacyPurpose(module))) return "existing";
	if (!dryRun) await Bun.write(path, content);
	return "updated";
}

/** Repair only the empty group written by the first generated template. */
async function writeMeta(
	path: string,
	content: string,
	dryRun: boolean,
): Promise<"created" | "updated" | "existing"> {
	if (!existsSync(path)) {
		await write(path, content, dryRun);
		return "created";
	}
	const current = (await Bun.file(path).json()) as { group?: unknown };
	if (current.group !== "") return "existing";
	if (!dryRun) await Bun.write(path, content);
	return "updated";
}

export async function scaffoldModuleDocs(
	registry: Registry,
	projects: string[],
	dryRun = false,
): Promise<{ created: string[]; updated: string[]; existing: string[] }> {
	const roots = new Map(
		projects.map((project) => [basename(project), project]),
	);
	const created: string[] = [];
	const updated: string[] = [];
	const existing: string[] = [];

	const platformProject = basename(projects[0] ?? "");
	const platformRoot = roots.get(platformProject);
	if (!platformRoot)
		throw new Error(`Project root not found: ${platformProject}`);
	for (const module of registry.modules.filter(
		(module) => module.project === platformProject,
	)) {
		const project = roots.get(module.project);
		if (!project) throw new Error(`Project root not found: ${module.project}`);

		const docs = join(project, module.path, "docs");
		const index = join(docs, "index.json");
		const article = join(docs, `${module.name}.md`);
		const meta = join(docs, "meta.json");
		const group =
			DOMAIN_TITLES[module.domain] ??
			(module.domain || (module.kind === "workflow" ? "Workflows" : "Other"));
		const indexContent = `${JSON.stringify(
			[
				{
					slug: module.name,
					title: module.name,
					order: 0,
					id: module.name,
				},
			],
			null,
			2,
		)}\n`;

		const articleState = await writeArticle(
			article,
			markdown(module, registry),
			module,
			dryRun,
		);
		const [indexCreated, metaState] = await Promise.all([
			write(index, indexContent, dryRun),
			writeMeta(meta, `${JSON.stringify({ group }, null, 2)}\n`, dryRun),
		]);
		if (articleState === "created" || indexCreated || metaState === "created")
			created.push(module.name);
		else if (articleState === "updated" || metaState === "updated")
			updated.push(module.name);
		else existing.push(module.name);
	}

	const systemDocs = join(platformRoot, "docs", "system");
	const systemIndex = join(systemDocs, "index.json");
	const systemCatalog = join(systemDocs, "module-catalog.md");
	if (!dryRun) {
		mkdirSync(systemDocs, { recursive: true });
		if (!existsSync(systemIndex)) {
			await Bun.write(
				systemIndex,
				`${JSON.stringify(
					[
						{
							slug: "module-catalog",
							title: "Module catalogue and dependencies",
							order: 0,
						},
					],
					null,
					2,
				)}\n`,
			);
		}
		await Bun.write(systemCatalog, catalog(registry, platformProject));
	}

	if (!existsSync(systemCatalog)) created.push("system/module-catalog");

	return { created, updated, existing };
}

if (import.meta.main) {
	const dryRun = Bun.argv.includes("--dry-run");
	const config = await loadConfig();
	const registry = await readRegistry(config.projects);
	const result = await scaffoldModuleDocs(registry, config.projects, dryRun);
	console.log(
		`[docs] module sources: ${result.created.length} created, ${result.updated.length} updated, ${result.existing.length} already present`,
	);
	for (const name of result.created) console.log(`[docs]   + ${name}`);
	for (const name of result.updated) console.log(`[docs]   ~ ${name}`);
}
