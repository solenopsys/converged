/** Keeps project content caches complete without overwriting translations. */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { Writer } from "./fs";
import type { Config, DocsRoot } from "./types";

const NON_LOCALES = new Set(["html", "pdf", "readme"]);

function isLocale(name: string): boolean {
	return /^[a-z]{2,3}$/.test(name) && !NON_LOCALES.has(name);
}

function files(root: string): string[] {
	if (!existsSync(root)) return [];
	const found: string[] = [];
	const visit = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.name.startsWith(".")) continue;
			const path = join(dir, entry.name);
			if (entry.isDirectory()) visit(path);
			else if (entry.isFile()) found.push(path);
		}
	};
	visit(root);
	return found.sort();
}

function locales(config: Config): string[] {
	const found = new Set(config.translation.targetLocales);
	for (const cache of config.docsCaches.values()) {
		if (!existsSync(cache)) continue;
		for (const entry of readdirSync(cache, { withFileTypes: true })) {
			if (entry.isDirectory() && isLocale(entry.name)) {
				found.add(entry.name);
			}
		}
	}
	if (config.contentCache) {
		for (const store of ["struct", "markdown"]) {
			const root = join(config.contentCache, store);
			if (!existsSync(root)) continue;
			for (const entry of readdirSync(root, { withFileTypes: true })) {
				if (entry.isDirectory() && isLocale(entry.name)) {
					found.add(entry.name);
				}
			}
		}
	}
	found.delete(config.translation.sourceLocale);
	return [...found].sort();
}

function same(path: string, content: Buffer): boolean {
	return existsSync(path) && readFileSync(path).equals(content);
}

async function syncFile(
	source: string,
	english: string,
	targets: string[],
	writer: Writer,
) {
	const content = readFileSync(source);
	const previousEnglish = existsSync(english)
		? readFileSync(english)
		: undefined;
	if (!same(english, content)) await writer.copy(english, source);

	for (const target of targets) {
		if (same(target, content)) continue;
		if (!existsSync(target)) {
			await writer.copy(target, source);
			continue;
		}
		if (previousEnglish && readFileSync(target).equals(previousEnglish)) {
			await writer.copy(target, source);
		}
	}
}

function docsRelative(
	root: DocsRoot,
	source: string,
): string {
	const rel = relative(root.path, source);
	if (!root.path.includes("/modules/")) return rel;
	const prefix = "modules/";
	return rel === "modules"
		? join(prefix, root.owner)
		: rel.startsWith("modules/")
			? join(prefix, root.owner, rel.slice(prefix.length))
			: join(prefix, root.owner, rel);
}

function cacheRelative(
	root: DocsRoot,
	source: string,
	sharedSections: ReadonlySet<string>,
): string {
	const rel = docsRelative(root, source);
	if (root.path.includes("/modules/")) return rel;
	const [section, ...rest] = rel.split(/[\\/]/);
	if (!section || rest.length === 0 || !sharedSections.has(section)) return rel;

	// Keep the project-level contribution flat for backwards compatibility with
	// existing translated caches. Additional owners are namespaced so their
	// index.json and meta.json files cannot overwrite one another.
	if (dirname(root.path) === root.project) return rel;
	return join(section, root.owner, ...rest);
}

export async function syncCaches(
	roots: DocsRoot[],
	config: Config,
	dryRun = false,
): Promise<number> {
	const writer = new Writer(dryRun);
	const sourceLocale = config.translation.sourceLocale;
	const targetLocales = locales(config);
	const sectionOwners = new Map<string, number>();
	for (const root of roots) {
		for (const section of root.sections) {
			sectionOwners.set(section, (sectionOwners.get(section) ?? 0) + 1);
		}
	}
	const sharedSections = new Set(
		[...sectionOwners].filter(([, count]) => count > 1).map(([section]) => section),
	);

	for (const root of roots) {
		const cache = config.docsCaches.get(root.project);
		if (!cache) continue;
		for (const source of files(root.path)) {
			const rel = cacheRelative(root, source, sharedSections);
			await syncFile(
				source,
				join(cache, sourceLocale, rel),
				targetLocales.map((locale) => join(cache, locale, rel)),
				writer,
			);
		}
	}

	if (config.content && config.contentCache) {
		for (const store of ["struct", "markdown"]) {
			const sourceRoot = join(config.content, store, sourceLocale);
			for (const source of files(sourceRoot)) {
				const rel = relative(sourceRoot, source);
				await syncFile(
					source,
					join(config.contentCache, store, sourceLocale, rel),
					targetLocales.map((locale) =>
						join(config.contentCache, store, locale, rel),
					),
					writer,
				);
			}
		}
	}

	return writer.written.size;
}
