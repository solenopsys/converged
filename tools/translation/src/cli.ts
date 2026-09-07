/**
 * Translation control.
 *
 *   bun run src/cli.ts [options]
 *
 * Options:
 *   --config <path>   configuration file (default: ./config.json)
 *   --project <name>  scan one configured project, repeatable
 *   --check           read-only: write neither state nor report, exit 1 on issues
 *   --reindex         rebuild source-hash links from existing target files
 *   --translate       translate missing source-hash links
 */

import { dirname, join, resolve } from "node:path";
import { readConfig } from "./config";
import { rebuildIndex } from "./reindex";
import { displayDiff } from "./report";
import { countIssues, scanProject } from "./scan";
import { TranslationStore } from "./store";
import { translateProject } from "./translate";
import type { ControlState, ProjectConfig } from "./types";

type Args = {
	config: string;
	projects: string[];
	check: boolean;
	reindex: boolean;
	translate: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = {
		config: join(import.meta.dir, "..", "config.json"),
		projects: [],
		check: false,
		reindex: false,
		translate: false,
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i] as string;
		switch (arg) {
			case "--config":
				args.config = argv[++i] as string;
				break;
			case "--project":
				args.projects.push(argv[++i] as string);
				break;
			case "--check":
				args.check = true;
				break;
			case "--translate":
				args.translate = true;
				break;
			case "--reindex":
				args.reindex = true;
				break;
			default:
				throw new Error(`Unknown option: ${arg}`);
		}
	}

	return args;
}

function indexPath(configPath: string, project: ProjectConfig): string {
	return resolve(
		dirname(configPath),
		project.translationIndex ??
			join(project.targetRoot ?? project.root, ".translation"),
	);
}

async function main(): Promise<void> {
	const args = parseArgs(Bun.argv.slice(2));
	const { config, path: configPath } = readConfig(args.config);

	const projects = args.projects.length
		? config.projects.filter((project) => args.projects.includes(project.name))
		: config.projects;
	if (args.projects.length && projects.length === 0) {
		throw new Error(`Project not found in config: ${args.projects.join(", ")}`);
	}

	const stores = new Map<string, TranslationStore>();
	let totalIssues = 0;
	const runs: Array<{
		project: ProjectConfig;
		state: ControlState;
		store: TranslationStore;
		snapshot: ReturnType<typeof scanProject>;
	}> = [];

	for (const project of projects) {
		const storePath = indexPath(configPath, project);
		if (!stores.has(storePath))
			stores.set(storePath, new TranslationStore(storePath));
		const state: ControlState = { version: 1, updatedAt: "", projects: {} };
		const store = stores.get(storePath) as TranslationStore;

		runs.push({
			project,
			state,
			store,
			snapshot: scanProject(project, configPath, state, store),
		});
	}

	if ((args.translate || args.reindex) && !args.check) {
		const byStore = new Map<TranslationStore, typeof runs>();
		for (const run of runs) {
			const grouped = byStore.get(run.store) ?? [];
			grouped.push(run);
			byStore.set(run.store, grouped);
		}
		for (const [store, grouped] of byStore) {
			const summary = rebuildIndex(
				store,
				grouped.map((run) => run.snapshot),
			);
			console.log(
				`[translations] index: sources ${summary.sources}, targets ${summary.targets}, ` +
					`linked ${summary.linked}, english ${summary.english}, missing ${summary.missing}, invalid ${summary.invalid}, ` +
					`nodes changed ${summary.changed}`,
			);
			for (const run of grouped) {
				run.snapshot = scanProject(run.project, configPath, run.state, store);
			}
		}
	}

	for (const run of runs) {
		const { project, state, store } = run;
		let { snapshot } = run;
		if (args.translate) {
			const translated = await translateProject(project, snapshot, store);
			snapshot = scanProject(project, configPath, state, store);
			if (translated > 0) console.log(`  translated ${translated} files`);
		}

		if (!args.translate && !args.reindex) {
			console.log(`▶ ${project.name}`);
			for (const [rel, file] of Object.entries(snapshot.files)) {
				for (const [locale, target] of Object.entries(file.targets)) {
					if (target.status === "ok") continue;
					console.log(
						`  ${target.status.toUpperCase()} ${rel} → ${locale} ` +
							`[${target.reasons.join(", ")}]${displayDiff(target.diff)}`,
					);
				}
			}
			for (const [locale, orphans] of Object.entries(snapshot.orphans)) {
				for (const orphan of orphans)
					console.log(`  ORPHAN ${orphan} in ${locale}`);
			}
			for (const route of snapshot.routes) {
				if (route.status === "ok") continue;
				console.log(
					`  ROUTE ${route.status.toUpperCase()} ${route.path} → ${route.locale} (${route.config})`,
				);
			}
		}

		const issues = countIssues(snapshot);
		totalIssues += issues;

		if (!args.translate && !args.reindex)
			console.log(
				`  files ${Object.keys(snapshot.files).length}; issues ${issues}\n`,
			);
	}

	if (args.check) console.log("Check-only mode: nothing was written.");

	console.log(
		args.translate || args.reindex ? "Done." : `Done. Issues: ${totalIssues}`,
	);
	if (args.check && totalIssues > 0) process.exitCode = 1;
}

await main();
