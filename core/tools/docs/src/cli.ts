/**
 * Documentation build.
 *
 *   bun run src/cli.ts <target...> [options]
 *
 * Targets: site, ecosystem, readme, html, pdf, translations, all (default: site).
 *   site          struct-ms indexes + markdown-ms files, what the site reads
 *   ecosystem     the module registry page, derived from the source tree
 *   readme        one README per section, the GitHub shape
 *   html          static pages with a side menu
 *   pdf           the same pages, printed
 *   translations  a translation-control config over the docs sources
 *
 * Options:
 *   --config <path>   configuration file (default: docs.config.json)
 *   --section <name>  build only this section, repeatable
 *   --lang <code>     build only this language, repeatable
 *   --no-prune        keep output files this run did not produce
 *   --dry-run         report what would change, write nothing
 *   --list            print the discovered docs roots and books, then exit
 *   -t, --translate   translate missing or stale locale files before rebuilding
 */

import { resolve } from "node:path";
import { syncCaches } from "./cache";
import { loadConfig } from "./config";
import { assertModuleDocs, missingModuleDocs } from "./coverage";
import { emitContent } from "./emit/content";
import { emitEcosystem } from "./emit/ecosystem";
import { emitHtml } from "./emit/html";
import { emitContentIndexes } from "./emit/index";
import { emitPdf } from "./emit/pdf";
import { emitReadme } from "./emit/readme";
import { emitSite } from "./emit/site";
import { emitTranslations } from "./emit/translations";
import { Manifest, Writer } from "./fs";
import { build } from "./model";
import type { Registry } from "./registry";
import { readRegistry } from "./registry";
import { scaffoldModuleDocs } from "./scaffold/modules";
import type { Book, Config, ScanSummary } from "./types";

const TARGETS = [
	"site",
	"ecosystem",
	"readme",
	"html",
	"pdf",
	"translations",
] as const;
type Target = (typeof TARGETS)[number];

type Args = {
	targets: Target[];
	config?: string;
	sections: string[];
	langs: string[];
	prune: boolean;
	dryRun: boolean;
	list: boolean;
	translate: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = {
		targets: [],
		sections: [],
		langs: [],
		prune: true,
		dryRun: false,
		list: false,
		translate: false,
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i] as string;
		switch (arg) {
			case "--config":
				args.config = argv[++i];
				break;
			case "--section":
				args.sections.push(argv[++i] as string);
				break;
			case "--lang":
				args.langs.push(argv[++i] as string);
				break;
			case "--no-prune":
				args.prune = false;
				break;
			case "--dry-run":
				args.dryRun = true;
				break;
			case "--list":
				args.list = true;
				break;
			case "-t":
			case "--translate":
				args.translate = true;
				break;
			case "all":
				args.targets.push(...TARGETS);
				break;
			default: {
				if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
				if (!TARGETS.includes(arg as Target)) {
					throw new Error(`Unknown target: ${arg}`);
				}
				args.targets.push(arg as Target);
			}
		}
	}

	if (args.targets.length === 0) args.targets.push("site");
	if (args.translate && !args.targets.includes("translations")) {
		args.targets.push("translations");
	}
	return { ...args, targets: [...new Set(args.targets)] };
}

async function run(
	target: Target,
	books: Book[],
	summary: ScanSummary,
	config: Config,
	args: Args,
	manifest: Manifest,
	registry: Registry,
) {
	const writer = new Writer(args.dryRun);

	switch (target) {
		case "site":
			await emitContent(config, writer, args.langs);
			await emitSite(books, summary.roots, config, writer);
			await emitContentIndexes(summary.roots, config, writer);
			break;
		case "ecosystem": {
			// The page follows the tree, not the docs, so it is built for every
			// language that has authored copy rather than for the scanned books.
			const langs = args.langs.length > 0 ? args.langs : summary.langs;
			const built = await emitEcosystem(registry, config, writer, langs);
			console.log(
				`[docs] ecosystem: ${registry.modules.length} modules, ` +
					`${registry.solutions.length} solutions -> [${built.join(" ")}]`,
			);
			break;
		}
		case "readme":
			await emitReadme(books, config, writer);
			break;
		case "html":
			await emitHtml(books, config, writer);
			break;
		case "pdf":
			await emitPdf(books, config, writer);
			break;
		case "translations": {
			const projects = await emitTranslations(summary, books, config, writer);
			console.log(
				`[docs] translations: ${projects.length} projects -> ${config.translation.config}`,
			);
			break;
		}
	}

	// A filtered build knows only part of a target. Pruning the rest would turn
	// `--section modules` into deletion of every other published section.
	const prune =
		args.prune && args.sections.length === 0 && args.langs.length === 0;
	const removed = manifest.prune(target, writer, prune);
	const suffix = removed.length ? `, ${removed.length} removed` : "";
	console.log(`[docs] ${target}: ${writer.written.size} files${suffix}`);
	for (const path of removed) console.log(`[docs]   - ${path}`);
}

const args = parseArgs(Bun.argv.slice(2));
const config = await loadConfig(args.config);
const registry = await readRegistry(config.projects);
const missingDocs = missingModuleDocs(registry, config.projects);
if (missingDocs.length > 0 && !args.dryRun) {
	const scaffolded = await scaffoldModuleDocs(registry, config.projects);
	console.log(`[docs] scaffold: ${scaffolded.created.length} modules created`);
}
assertModuleDocs(registry, config.projects);
let { books, summary } = await build(config, {
	sections: args.sections,
	langs: args.langs,
});

if (!args.list) {
	const synced = await syncCaches(summary.roots, config, args.dryRun);
	console.log(`[docs] cache: ${synced} files synchronized`);
	if (synced > 0 && !args.dryRun) {
		({ books, summary } = await build(config, {
			sections: args.sections,
			langs: args.langs,
		}));
	}
}

if (args.list) {
	console.log(`[docs] scanned: ${config.projects.join(", ")}`);
	for (const root of summary.roots) {
		console.log(`  ${root.owner}  [${root.sections.join(" ")}]  ${root.path}`);
	}
	for (const book of books) {
		const kind = book.compound ? "compound" : "flat";
		const owners = book.contributions.map((c) => c.module).join(", ");
		console.log(
			`  ${book.lang}/${book.section}  ${book.docs.length} docs  ${kind}  [${owners}]`,
		);
	}
	console.log(
		`  registry: ${registry.modules.length} modules, ${registry.solutions.length} solutions`,
	);
	process.exit(0);
}

if (books.length === 0 && !args.targets.includes("ecosystem")) {
	console.log(
		"[docs] nothing found: no docs/<section>/index.json in the scanned projects",
	);
	console.log(`[docs] scanned: ${config.projects.join(", ")}`);
	process.exit(0);
}

if (args.dryRun) console.log("[docs] dry run, nothing is written");

const manifest = await Manifest.load(config.root, args.dryRun, [
	...Object.values(config.out),
	config.translation.stateDir,
]);
for (const target of args.targets) {
	await run(target, books, summary, config, args, manifest, registry);
}

if (args.translate) {
	const translationCli = resolve(
		import.meta.dir,
		"../../translation/src/cli.ts",
	);
	const child = Bun.spawn(
		[
			process.execPath,
			translationCli,
			"--translate",
			"--config",
			config.translation.config,
		],
		{
			cwd: config.root,
			env: process.env,
			stdout: "inherit",
			stderr: "inherit",
		},
	);
	const exitCode = await child.exited;
	if (exitCode !== 0)
		throw new Error(`Translation failed with exit code ${exitCode}`);

	({ books, summary } = await build(config, {
		sections: args.sections,
		langs: args.langs,
	}));
	for (const target of ["site", "ecosystem"] as const) {
		await run(target, books, summary, config, args, manifest, registry);
	}
}
await manifest.save();
