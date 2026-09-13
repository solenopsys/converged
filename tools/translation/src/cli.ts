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
 *   --stats           print the volume table and the recent run ledger, then exit
 *   --invalidate <p>  forget the translations of everything under folder <p>,
 *                     so the next --translate redoes it. Narrow it with
 *                     --project and --locale.
 *   --locale <code>   restrict --invalidate to one locale, repeatable
 *   --concurrency <n> parallel in-flight requests (default from
 *                     DOCS_TRANSLATION_CONCURRENCY, else 4)
 *   --no-cache        hash every file instead of trusting size+mtime
 *   --validate        list files failing structural validation, exit 1 on any.
 *                     Read-only: it reports and repairs nothing, because the
 *                     only thing it could repair is the docs index, which is
 *                     an authored input rather than a generated artifact.
 */

import { dirname, join, resolve } from "node:path";
import { readConfig } from "./config";
import { directHasher, type Hasher, sqliteHasher } from "./hashcache";
import { invalidateFolder, previousSnapshot, recordProject } from "./placement";
import { configuredConcurrency } from "./pool";
import { buildQueue, type Job } from "./queue";
import { rebuildIndex } from "./reindex";
import { displayDiff } from "./report";
import { countIssues, scanProject } from "./scan";
import {
	beginRun,
	finishRun,
	recentRuns,
	renderRuns,
	renderVolume,
	volume,
} from "./stats";
import { TranslationStore } from "./store";
import { emptyTally, translateProject } from "./translate";
import type { ControlState, ProjectConfig } from "./types";
import { type ValidationIssue, validateProject } from "./validate";

type Args = {
	config: string;
	projects: string[];
	locales: string[];
	check: boolean;
	reindex: boolean;
	translate: boolean;
	validate: boolean;
	stats: boolean;
	invalidate?: string;
	concurrency?: number;
	cache: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = {
		config: join(import.meta.dir, "..", "config.json"),
		projects: [],
		locales: [],
		check: false,
		reindex: false,
		translate: false,
		validate: false,
		stats: false,
		cache: true,
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
			case "--locale":
				args.locales.push(argv[++i] as string);
				break;
			case "--check":
				args.check = true;
				break;
			case "--translate":
				args.translate = true;
				break;
			case "--validate":
				args.validate = true;
				break;
			case "--reindex":
				args.reindex = true;
				break;
			case "--stats":
				args.stats = true;
				break;
			case "--invalidate":
				args.invalidate = argv[++i] as string;
				break;
			case "--concurrency":
				args.concurrency = Number(argv[++i]);
				break;
			case "--no-cache":
				args.cache = false;
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
			join(project.targetRoot ?? project.root, ".index"),
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
	const hashers = new Map<TranslationStore, Hasher>();
	const storeFor = (project: ProjectConfig): TranslationStore => {
		const path = indexPath(configPath, project);
		let store = stores.get(path);
		if (!store) {
			store = new TranslationStore(path);
			stores.set(path, store);
			hashers.set(store, args.cache ? sqliteHasher(store.db) : directHasher());
		}
		return store;
	};

	try {
		// Invalidation is a maintenance command: it edits the index and stops,
		// so it must not be preceded by a scan that would race its own results.
		if (args.invalidate !== undefined) {
			let sources = 0;
			let links = 0;
			for (const project of projects) {
				const store = storeFor(project);
				const result = invalidateFolder(store, args.invalidate, {
					project: project.name,
					locale: args.locales[0],
				});
				if (result.links === 0) continue;
				sources += result.sources;
				links += result.links;
				console.log(
					`[translations] ${project.name}: dropped ${result.links} links ` +
						`over ${result.sources} sources in ${args.invalidate} ` +
						`[${result.locales.join(" ")}]`,
				);
			}
			console.log(
				links === 0
					? `Nothing linked under ${args.invalidate}.`
					: `Done. ${links} links over ${sources} sources will be retranslated.`,
			);
			return;
		}

		let totalIssues = 0;
		const validationIssues: ValidationIssue[] = [];
		const runs: Array<{
			project: ProjectConfig;
			state: ControlState;
			store: TranslationStore;
			snapshot: ReturnType<typeof scanProject>;
		}> = [];

		const scan = (
			project: ProjectConfig,
			store: TranslationStore,
			state: ControlState,
		) => {
			// The previous scan is the index's own placement, so a fresh
			// process starts with the same evidence the last one ended with.
			const previous = previousSnapshot(store, project.name);
			if (previous) state.projects[project.name] = previous;
			return scanProject(
				project,
				configPath,
				state,
				store,
				hashers.get(store) as Hasher,
			);
		};

		for (const project of projects) {
			const store = storeFor(project);
			const state: ControlState = { version: 1, updatedAt: "", projects: {} };
			runs.push({
				project,
				state,
				store,
				snapshot: scan(project, store, state),
			});
		}
		for (const hasher of hashers.values()) hasher.flush();

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
					args.projects.length === 0,
				);
				console.log(
					`[translations] index: sources ${summary.sources}, targets ${summary.targets}, ` +
						`linked ${summary.linked}, english ${summary.english}, missing ${summary.missing}, stale ${summary.stale}, invalid ${summary.invalid}, ` +
						`links changed ${summary.changed}`,
				);
				for (const run of grouped) {
					run.snapshot = scan(run.project, store, run.state);
				}
			}
			for (const hasher of hashers.values()) hasher.flush();
		}

		// Placement is written before the volume table so the table and the
		// database agree even if the run is interrupted straight after.
		if (!args.check) {
			for (const run of runs)
				recordProject(run.store, run.project, run.snapshot);
		}

		const queues = new Map<ProjectConfig, Job[]>(
			runs.map((run) => [
				run.project,
				buildQueue(run.project, run.snapshot, run.store),
			]),
		);
		const wholeQueue = [...queues.values()].flat();

		if (args.stats || args.translate) {
			console.log(
				renderVolume(
					volume(
						runs.map((run) => ({
							name: run.project.name,
							snapshot: run.snapshot,
						})),
						wholeQueue,
					),
				),
			);
			for (const [store, hasher] of hashers) {
				console.log(
					`  hashes: ${hasher.hits} cached, ${hasher.misses} computed  (${store.indexRoot})`,
				);
			}
			console.log("");
		}

		if (args.stats) {
			for (const store of stores.values()) {
				console.log(`Recent runs — ${store.indexRoot}`);
				console.log(renderRuns(recentRuns(store.db)));
			}
			return;
		}

		const concurrency = args.concurrency
			? configuredConcurrency(String(args.concurrency))
			: configuredConcurrency();
		const tally = emptyTally();
		const handles = args.translate
			? new Map(
					[...stores.values()].map((store) => [
						store,
						beginRun(store.db, "translate", {
							model: process.env.DOCS_TRANSLATION_MODEL,
							concurrency,
							queued: wholeQueue.length,
						}),
					]),
				)
			: new Map();

		for (const run of runs) {
			const { project, state, store } = run;
			let { snapshot } = run;
			if (args.translate) {
				const translated = await translateProject(project, snapshot, store, {
					concurrency,
					queue: queues.get(project),
					run: handles.get(store),
					tally,
				});
				snapshot = scan(project, store, state);
				recordProject(store, project, snapshot);
				if (translated > 0) console.log(`  translated ${translated} files`);
			}

			if (args.validate) {
				validationIssues.push(...validateProject(project, snapshot, store));
			}

			if (!args.translate && !args.reindex && !args.validate) {
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

			if (!args.translate && !args.reindex && !args.validate)
				console.log(
					`  files ${Object.keys(snapshot.files).length}; issues ${issues}\n`,
				);
		}

		for (const handle of handles.values()) finishRun(handle, tally);
		for (const hasher of hashers.values()) hasher.flush();

		if (args.translate) {
			console.log(
				`[translations] run: ${tally.translated} translated, ${tally.skipped} skipped, ` +
					`${tally.requests} requests, ${tally.retries} retries, ` +
					`${tally.sourceChars} source characters, concurrency ${concurrency}`,
			);
		}

		if (args.check) console.log("Check-only mode: nothing was written.");

		if (args.validate) {
			// One line per file, not per finding: a file with nine broken entries
			// is one thing to go and fix.
			const files = [
				...new Set(validationIssues.map((issue) => issue.file)),
			].sort();
			for (const file of files) console.log(file);
			console.log(
				files.length === 0
					? "Done. No files with errors."
					: `Done. ${files.length} files with errors, ${validationIssues.length} findings.`,
			);
		} else {
			console.log(
				args.translate || args.reindex
					? "Done."
					: `Done. Issues: ${totalIssues}`,
			);
		}
		if (args.check && totalIssues > 0) process.exitCode = 1;
		if (args.validate && validationIssues.length > 0) process.exitCode = 1;
	} finally {
		// Leaves one file per index on disk, never a WAL sidecar: the database
		// is committed, and a stray journal is both diff noise and a database
		// another checkout cannot open.
		for (const store of stores.values()) store.close();
	}
}

await main();
