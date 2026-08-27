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
 */

import { loadConfig } from "./config";
import { assertModuleDocs } from "./coverage";
import { emitContent } from "./emit/content";
import { emitEcosystem } from "./emit/ecosystem";
import { emitHtml } from "./emit/html";
import { emitPdf } from "./emit/pdf";
import { emitReadme } from "./emit/readme";
import { emitSite } from "./emit/site";
import { emitTranslations } from "./emit/translations";
import { Manifest, Writer } from "./fs";
import { build } from "./model";
import type { Registry } from "./registry";
import { readRegistry } from "./registry";
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
};

function parseArgs(argv: string[]): Args {
	const args: Args = {
		targets: [],
		sections: [],
		langs: [],
		prune: true,
		dryRun: false,
		list: false,
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
			const projects = await emitTranslations(summary, config, writer);
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
assertModuleDocs(registry, config.projects);
const { books, summary } = await build(config, {
	sections: args.sections,
	langs: args.langs,
});

if (args.list) {
	console.log(`[docs] scanned: ${config.projects.join(", ")}`);
	for (const root of summary.roots) {
		console.log(`  ${root.owner}  [${root.langs.join(" ")}]  ${root.path}`);
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
		"[docs] nothing found: no docs/<lang>/<section>/index.json in the scanned projects",
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
await manifest.save();
