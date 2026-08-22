/**
 * Documentation build.
 *
 *   bun run src/cli.ts <target...> [options]
 *
 * Targets: site, readme, html, pdf, translations, all (default: site).
 *   site          struct-ms indexes + markdown-ms files, what the site reads
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
import { emitHtml } from "./emit/html";
import { emitPdf } from "./emit/pdf";
import { emitReadme } from "./emit/readme";
import { emitSite } from "./emit/site";
import { emitTranslations } from "./emit/translations";
import { Manifest, Writer } from "./fs";
import { build } from "./model";
import type { Book, Config, ScanSummary } from "./types";

const TARGETS = ["site", "readme", "html", "pdf", "translations"] as const;
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
) {
	const writer = new Writer(args.dryRun);

	switch (target) {
		case "site":
			await emitSite(books, config, writer);
			break;
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

	const removed = manifest.prune(target, writer, args.prune);
	const suffix = removed.length ? `, ${removed.length} removed` : "";
	console.log(`[docs] ${target}: ${writer.written.size} files${suffix}`);
	for (const path of removed) console.log(`[docs]   - ${path}`);
}

const args = parseArgs(Bun.argv.slice(2));
const config = await loadConfig(args.config);
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
	process.exit(0);
}

if (books.length === 0) {
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
	await run(target, books, summary, config, args, manifest);
}
await manifest.save();
