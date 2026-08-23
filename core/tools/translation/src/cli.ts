/**
 * Translation control.
 *
 *   bun run src/cli.ts [options]
 *
 * Options:
 *   --config <path>   configuration file (default: ./config.json)
 *   --project <name>  scan one configured project, repeatable
 *   --check           read-only: write neither state nor report, exit 1 on issues
 *   --record          stamp the ledger: the translations on disk are current
 *   --prune           drop ledger entries whose source no longer exists
 *
 * `--record` is the verb a translation pass ends with. Scanning cannot infer
 * it: only whoever produced the translations knows they correspond to the
 * sources now on disk.
 */

import { dirname, join, resolve } from "node:path";
import { readConfig, readState } from "./config";
import { writeJsonAtomic } from "./fs";
import { prune, readLedger } from "./ledger";
import { displayDiff, reportForProject } from "./report";
import { countIssues, recordProject, scanProject } from "./scan";
import type {
	ControlState,
	ProjectConfig,
	TranslationLedger,
	TranslationReport,
} from "./types";

type Args = {
	config: string;
	projects: string[];
	check: boolean;
	record: boolean;
	prune: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = {
		config: join(import.meta.dir, "..", "config.json"),
		projects: [],
		check: false,
		record: false,
		prune: false,
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
			case "--record":
				args.record = true;
				break;
			case "--prune":
				args.prune = true;
				break;
			default:
				throw new Error(`Unknown option: ${arg}`);
		}
	}

	if (args.check && args.record) {
		throw new Error("--check and --record are mutually exclusive");
	}
	return args;
}

function pathFor(
	configPath: string,
	project: ProjectConfig,
	key: "stateFile" | "reportFile" | "ledgerFile",
	fallback: string,
): string {
	return resolve(dirname(configPath), project[key] ?? fallback);
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

	const states = new Map<string, ControlState>();
	const ledgers = new Map<string, TranslationLedger>();
	const reports = new Map<string, TranslationReport>();
	let totalIssues = 0;
	let totalRecorded = 0;

	for (const project of projects) {
		const statePath = pathFor(configPath, project, "stateFile", "./state.json");
		const ledgerPath = pathFor(
			configPath,
			project,
			"ledgerFile",
			"./ledger.json",
		);
		const reportPath = pathFor(
			configPath,
			project,
			"reportFile",
			"./report.json",
		);

		if (!states.has(statePath)) states.set(statePath, readState(statePath));
		if (!ledgers.has(ledgerPath))
			ledgers.set(ledgerPath, readLedger(ledgerPath));
		const state = states.get(statePath) as ControlState;
		const ledger = ledgers.get(ledgerPath) as TranslationLedger;

		console.log(`▶ ${project.name}`);
		const snapshot = scanProject(project, configPath, state, ledger);

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

		state.projects[project.name] = snapshot;
		const issues = countIssues(snapshot);
		totalIssues += issues;

		if (args.record) {
			totalRecorded += recordProject(
				snapshot,
				ledger,
				project.name,
				new Date().toISOString(),
			);
		}
		if (args.prune) {
			const dropped = prune(ledger, project.name, Object.keys(snapshot.files));
			for (const rel of dropped) console.log(`  PRUNED ${rel} from the ledger`);
		}

		const report = reports.get(reportPath) ?? {
			version: 1 as const,
			generatedAt: "",
			projects: [],
		};
		report.projects.push(reportForProject(project.name, snapshot));
		reports.set(reportPath, report);

		console.log(
			`  files ${Object.keys(snapshot.files).length}; issues ${issues}\n`,
		);
	}

	if (args.check) {
		console.log("Check-only mode: nothing was written.");
	} else {
		const now = new Date().toISOString();
		for (const [path, state] of states) {
			state.updatedAt = now;
			writeJsonAtomic(path, state);
			console.log(`Saved ${path}`);
		}
		for (const [path, report] of reports) {
			report.generatedAt = now;
			writeJsonAtomic(path, report);
			console.log(`Report ${path}`);
		}
		if (args.record || args.prune) {
			for (const [path, ledger] of ledgers) {
				ledger.updatedAt = now;
				writeJsonAtomic(path, ledger);
				console.log(
					`Ledger ${path}${args.record ? ` (+${totalRecorded})` : ""}`,
				);
			}
		}
	}

	console.log(`Done. Issues: ${totalIssues}`);
	if (args.check && totalIssues > 0) process.exitCode = 1;
}

await main();
