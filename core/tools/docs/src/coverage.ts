import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type { Registry } from "./registry";

/** Every registered module must own an English page in the common module TOC. */
export function missingModuleDocs(
	registry: Registry,
	projects: string[],
): string[] {
	const roots = new Map(
		projects.map((project) => [basename(project), project]),
	);
	const platformProject = basename(projects[0] ?? "");
	return registry.modules
		.filter((module) => module.project === platformProject)
		.filter((module) => {
			const project = roots.get(module.project);
			return (
				!project ||
				!existsSync(join(project, module.path, "docs", "modules", "index.json"))
			);
		})
		.map((module) => `${module.project}/${module.path}`)
		.sort();
}

export function assertModuleDocs(registry: Registry, projects: string[]): void {
	const missing = missingModuleDocs(registry, projects);
	if (missing.length === 0) return;
	throw new Error(
		`Documentation coverage is incomplete (${missing.length} modules):\n` +
			missing.map((path) => `  - ${path}`).join("\n") +
			"\nRun: bun run build:doc",
	);
}
