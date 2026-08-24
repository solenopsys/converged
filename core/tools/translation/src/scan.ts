/**
 * Walking one project: every source file against every target locale.
 *
 * The source tree is the authority. A target that has no source is an orphan,
 * never a source in its own right, so a translation of a deleted document
 * surfaces instead of quietly living on.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { compareJson, compareMarkdown } from "./compare";
import { hashFile, readText, selectFiles, walk } from "./fs";
import { flattenTree, readTree, treeHash } from "./json-tree";
import { type LedgerVerdict, readEntry, record, verdict } from "./ledger";
import { type MarkdownBlock, outlineHash, parseMarkdown } from "./markdown";
import { isRecordable, statusFor } from "./status";
import type {
	ControlState,
	FileEntry,
	FileSnapshot,
	JsonValue,
	LedgerEntry,
	ProjectConfig,
	ProjectSnapshot,
	RouteSnapshot,
	TargetSnapshot,
	TranslationLedger,
	TreeDiff,
} from "./types";

type SourceView = {
	hash: string;
	structureHash?: string;
	json?: JsonValue;
	markdown?: MarkdownBlock[];
	error?: string;
};

function readView(file: FileEntry): SourceView {
	const hash = hashFile(file.abs);

	if (file.type === "json") {
		const tree = readTree(file.abs);
		return {
			hash,
			structureHash: tree.hash,
			json: tree.value,
			error: tree.error,
		};
	}
	if (file.type === "markdown") {
		const blocks = parseMarkdown(readText(file.abs));
		return { hash, structureHash: outlineHash(blocks), markdown: blocks };
	}
	return { hash };
}

function diffFor(
	source: SourceView,
	target: SourceView,
	config: ProjectConfig,
	locale: string,
): TreeDiff | undefined {
	if (source.json !== undefined && target.json !== undefined) {
		return compareJson(source.json, target.json, config.validation, locale);
	}
	if (source.markdown && target.markdown) {
		return compareMarkdown(
			source.markdown,
			target.markdown,
			config.validation,
			locale,
		);
	}
	return undefined;
}

export function projectRoot(config: ProjectConfig, configPath: string): string {
	return resolve(dirname(configPath), config.root);
}

/** Translations may live in a separate repository from their source files. */
export function projectTargetRoot(
	config: ProjectConfig,
	configPath: string,
): string {
	return resolve(dirname(configPath), config.targetRoot ?? config.root);
}

function targetRelative(config: ProjectConfig, sourceRelative: string): string {
	const prefix = config.targetStripPrefix?.replace(/^\/+|\/+$/g, "");
	if (!prefix) return sourceRelative;
	return sourceRelative === prefix
		? ""
		: sourceRelative.startsWith(`${prefix}/`)
			? sourceRelative.slice(prefix.length + 1)
			: sourceRelative;
}

function targetDirectory(
	config: ProjectConfig,
	targetRoot: string,
	locale: string,
): string {
	return join(targetRoot, locale, config.targetPrefix ?? "");
}

function targetPath(
	config: ProjectConfig,
	targetRoot: string,
	locale: string,
	sourceRelative: string,
): string {
	return join(
		targetDirectory(config, targetRoot, locale),
		targetRelative(config, sourceRelative),
	);
}

export function scanProject(
	config: ProjectConfig,
	configPath: string,
	state: ControlState,
	ledger: TranslationLedger,
): ProjectSnapshot {
	const root = projectRoot(config, configPath);
	const targetRoot = projectTargetRoot(config, configPath);
	const sourceRoot = join(root, config.sourceLocale);
	if (!existsSync(sourceRoot)) {
		throw new Error(
			`[${config.name}] source root does not exist: ${sourceRoot}`,
		);
	}

	const sourceFiles = selectFiles(
		walk(sourceRoot),
		config.include,
		config.exclude,
	).sort((left, right) => left.rel.localeCompare(right.rel));
	const sourceByRel = new Map(
		sourceFiles.map((file) => [targetRelative(config, file.rel), file]),
	);
	const previous = state.projects[config.name];
	const files: Record<string, FileSnapshot> = {};

	for (const sourceFile of sourceFiles) {
		const source = readView(sourceFile);
		const previousFile = previous?.files[sourceFile.rel];
		const sourceChanged = Boolean(
			previousFile && previousFile.sourceHash !== source.hash,
		);
		const targets: Record<string, TargetSnapshot> = {};

		for (const locale of config.targetLocales) {
			const targetFile = targetPath(config, targetRoot, locale, sourceFile.rel);
			const targetExists = existsSync(targetFile);
			const target = targetExists
				? readView({ ...sourceFile, abs: targetFile })
				: undefined;
			const targetHash = target?.hash ?? "";
			const previousTarget = previousFile?.targets[locale];
			const entry = readEntry(ledger, config.name, sourceFile.rel, locale);
			const ledgerVerdict: LedgerVerdict = targetExists
				? verdict(entry, source.hash, targetHash)
				: "unrecorded";

			const diff = target ? diffFor(source, target, config, locale) : undefined;
			const { status, reasons } = statusFor({
				tracked: Boolean(previousTarget),
				targetExists,
				sourceChanged,
				targetModified: Boolean(
					previousTarget?.hash && previousTarget.hash !== targetHash,
				),
				invalidJson: Boolean(target?.error),
				ledger: ledgerVerdict,
				diff,
			});

			targets[locale] = {
				exists: targetExists,
				hash: targetHash,
				structureHash: target?.structureHash,
				translatedFromHash: entry?.translatedFromHash,
				status,
				reasons,
				diff,
			};
		}

		files[sourceFile.rel] = {
			fileType: sourceFile.type,
			sourceHash: source.hash,
			sourceStructureHash: source.structureHash,
			targets,
		};
	}

	return {
		root,
		sourceLocale: config.sourceLocale,
		targetLocales: config.targetLocales,
		files,
		orphans: findOrphans(config, targetRoot, sourceByRel),
		routes: scanRoutes(config, root, targetRoot),
		targetRoot,
	};
}

function findOrphans(
	config: ProjectConfig,
	root: string,
	sourceByRel: Map<string, FileEntry>,
): Record<string, string[]> {
	const orphans: Record<string, string[]> = {};
	for (const locale of config.targetLocales) {
		orphans[locale] = selectFiles(
			walk(targetDirectory(config, root, locale)),
			config.include,
			config.exclude,
		)
			.filter((file) => !sourceByRel.has(file.rel))
			.map((file) => file.rel)
			.sort();
	}
	return orphans;
}

/**
 * Landing configs get a second pass of their own. A page whose config drifted
 * is broken for a whole route rather than for one string, and that deserves to
 * be visible without reading the per-file list.
 */
function scanRoutes(
	config: ProjectConfig,
	root: string,
	targetRoot: string,
): RouteSnapshot[] {
	const routes: RouteSnapshot[] = [];

	for (const route of config.routes ?? []) {
		const source = readTree(join(root, config.sourceLocale, route.config));
		for (const locale of config.targetLocales) {
			const targetFile = targetPath(config, targetRoot, locale, route.config);
			const target = existsSync(targetFile) ? readTree(targetFile) : undefined;
			const diff =
				source.value !== undefined && target?.value !== undefined
					? compareJson(source.value, target.value, config.validation, locale)
					: undefined;

			const broken = !target || target.error;
			const missing = broken ? [route.config] : (diff?.missing ?? []);
			const extra = diff?.extra ?? [];
			const typeChanged = diff?.typeChanged ?? [];
			const status =
				missing.length || extra.length || typeChanged.length
					? broken
						? "missing"
						: "structure-drift"
					: "ok";

			routes.push({ ...route, locale, status, missing, extra, typeChanged });
		}
	}

	return routes;
}

export function countIssues(project: ProjectSnapshot): number {
	let count = Object.values(project.orphans).reduce(
		(sum, files) => sum + files.length,
		0,
	);
	count += project.routes.filter((route) => route.status !== "ok").length;
	for (const file of Object.values(project.files)) {
		for (const target of Object.values(file.targets)) {
			if (target.status !== "ok") count += 1;
		}
	}
	return count;
}

/**
 * Stamps the current source hash onto every target that exists and is not
 * broken, declaring it translated from what is there now.
 *
 * This is what `--record` runs after a translation pass. It is a separate verb
 * from scanning because it asserts something a scan cannot know: that the
 * translations on disk correspond to the sources on disk.
 */
export function recordProject(
	snapshot: ProjectSnapshot,
	ledger: TranslationLedger,
	projectName: string,
	now: string,
): number {
	let recorded = 0;

	for (const [rel, file] of Object.entries(snapshot.files)) {
		for (const [locale, target] of Object.entries(file.targets)) {
			if (!target.exists || !isRecordable(target.status)) continue;
			const entry: LedgerEntry = {
				translatedFromHash: file.sourceHash,
				translationHash: target.hash,
				translatedAt: now,
			};
			record(ledger, projectName, rel, locale, entry);
			recorded += 1;
		}
	}

	return recorded;
}

/** Re-exported so callers do not have to know which module owns the maths. */
export { flattenTree, treeHash };
