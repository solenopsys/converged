/**
 * Finds authored documentation anywhere in the tree.
 *
 * A directory named `docs` opts its owner in, wherever it sits — a module, a
 * library, a tool, the project root. It is recognised by its contents, not its
 * location:
 *
 *   <owner>/docs/<section>/index.json   entries, struct-ms format
 *   <owner>/docs/<section>/<id>.md      one file per entry
 *   <owner>/docs/<section>/meta.json    optional, group heading
 *
 * Authored documentation is always English. Locales exist only in the
 * project content cache.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import type {
	Contribution,
	ContributionMeta,
	Doc,
	DocsRoot,
	IndexEntry,
	ScanSummary,
} from "./types";

/** Directories never worth descending into while looking for docs. */
const SKIP = new Set([
	"node_modules",
	".git",
	".cache",
	"dist",
	"build",
	"out",
	"coverage",
	"docs-cache",
	"vendor",
	"target",
	"tmp",
]);

const NON_LOCALES = new Set(["html", "pdf", "readme"]);

function subdirs(path: string): string[] {
	if (!existsSync(path)) return [];
	return readdirSync(path, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
}

/**
 * A `docs` directory counts only when it holds at least one
 * `<lang>/<section>/index.json`. Third-party checkouts are full of `docs`
 * folders, and the index is what separates ours from theirs.
 */
function holdsDocs(path: string): boolean {
	for (const section of subdirs(path)) {
		if (existsSync(join(path, section, "index.json"))) return true;
	}
	return false;
}

function walk(dir: string, found: string[]): void {
	let entries: string[];
	try {
		entries = readdirSync(dir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
			.map((entry) => entry.name);
	} catch {
		return;
	}

	for (const name of entries) {
		if (SKIP.has(name) || name.startsWith(".")) continue;
		const path = join(dir, name);
		try {
			if (!statSync(path).isDirectory()) continue;
		} catch {
			continue;
		}
		// A docs tree is a leaf for this search: nothing inside it is another
		// owner's docs, and descending would find its own subdirectories.
		if (name === "docs") {
			if (holdsDocs(path)) found.push(path);
			continue;
		}
		walk(path, found);
	}
}

/**
 * Names a docs root by the directory that owns it. Two owners can share a
 * basename — `content/mf-docs` and `ai/mf-docs` would — so a clashing name
 * grows leftwards until it is unique.
 */
function nameRoots(paths: { path: string; project: string }[]): DocsRoot[] {
	const segments = paths.map(({ path, project }) => ({
		path,
		project,
		parts: relative(project, dirname(path)).split(sep).filter(Boolean),
	}));

	const roots: DocsRoot[] = [];
	for (const entry of segments) {
		let depth = 1;
		let owner = entry.parts.slice(-depth).join("-") || basename(entry.project);

		while (
			segments.some(
				(other) =>
					other !== entry &&
					(other.parts.slice(-depth).join("-") || basename(other.project)) ===
						owner,
			) &&
			depth < entry.parts.length
		) {
			depth += 1;
			owner = entry.parts.slice(-depth).join("-");
		}

		roots.push({
			owner,
			path: entry.path,
			project: entry.project,
			sections: subdirs(entry.path).filter((section) =>
				existsSync(join(entry.path, section, "index.json")),
			),
		});
	}

	return roots.sort((a, b) => a.owner.localeCompare(b.owner));
}

/** Every docs tree across the given project roots. */
export function findDocsRoots(projects: string[]): DocsRoot[] {
	const seen = new Set<string>();
	const found: { path: string; project: string }[] = [];

	for (const project of projects) {
		const paths: string[] = [];
		if (holdsDocs(join(project, "docs"))) paths.push(join(project, "docs"));
		walk(project, paths);

		for (const path of paths) {
			if (seen.has(path)) continue;
			seen.add(path);
			found.push({ path, project });
		}
	}

	return nameRoots(found);
}

function assertEntries(value: unknown, indexPath: string): IndexEntry[] {
	if (!Array.isArray(value)) {
		throw new Error(`${indexPath}: expected an array of entries`);
	}
	return value.map((item, position) => {
		const record = (item ?? {}) as Record<string, unknown>;
		const slug = record.slug;
		if (typeof slug !== "string" || slug.trim().length === 0) {
			throw new Error(`${indexPath}: entry #${position} has no slug`);
		}
		const title = typeof record.title === "string" ? record.title : slug;
		const id = typeof record.id === "string" && record.id ? record.id : slug;
		const order = typeof record.order === "number" ? record.order : position;
		return { slug: slug.trim(), title, id, order };
	});
}

async function readMeta(dir: string): Promise<ContributionMeta> {
	const path = join(dir, "meta.json");
	if (!existsSync(path)) return {};
	return (await Bun.file(path).json()) as ContributionMeta;
}

/**
 * Reads one `docs/<section>` directory. Returns null when it holds no
 * index — an empty or half-created directory is not an error.
 */
async function readContribution(
	owner: string,
	dir: string,
): Promise<Contribution | null> {
	const indexPath = join(dir, "index.json");
	if (!existsSync(indexPath)) return null;

	const entries = assertEntries(await Bun.file(indexPath).json(), indexPath);
	const meta = await readMeta(dir);
	const seen = new Set<string>();
	const docs: Doc[] = [];

	for (const entry of entries) {
		if (seen.has(entry.slug)) {
			throw new Error(`${indexPath}: duplicate slug "${entry.slug}"`);
		}
		seen.add(entry.slug);

		const source = join(dir, `${entry.id}.md`);
		if (!existsSync(source)) {
			throw new Error(
				`${indexPath}: "${entry.slug}" points at missing ${source}`,
			);
		}
		docs.push({
			slug: entry.slug,
			title: entry.title,
			order: entry.order as number,
			source,
			module: owner,
		});
	}

	docs.sort((a, b) => a.order - b.order);
	return { module: owner, group: meta.group ?? owner, indexPath, docs };
}

export type ScanResult = ScanSummary & {
	/** Keyed by `<section>/<lang>`. */
	contributions: Map<string, Contribution[]>;
};

/**
 * Translations, read from the cache.
 *
 * The cache mirrors what an owner would have written had it kept the language
 * itself, so a translated section is read exactly like an authored one. It is
 * laid out flat while a section has a single contributor and grows an `<owner>`
 * level when it has several — the same shape `emitSite` writes.
 *
 * Cache contributions never appear in `roots`: a root is somewhere a human
 * authors, and nobody authors here.
 */
async function readCache(
	cache: string,
	defaultOwner: string,
	contributions: Map<string, Contribution[]>,
	langs: Set<string>,
	sourceLocale: string,
): Promise<void> {
	for (const lang of subdirs(cache).filter(
		(lang) =>
			/^[a-z]{2,3}$/.test(lang) &&
			!NON_LOCALES.has(lang) &&
			lang !== sourceLocale,
	)) {
		for (const section of subdirs(join(cache, lang))) {
			if (section === "content") continue;
			const dir = join(cache, lang, section);
			const owners = [
				...(existsSync(join(dir, "index.json"))
					? [{ owner: defaultOwner, path: dir }]
					: []),
				...subdirs(dir).map((owner) => ({ owner, path: join(dir, owner) })),
			];

			for (const { owner, path } of owners) {
				const contribution = await readContribution(owner, path);
				if (!contribution) continue;
				langs.add(lang);
				const key = `${section}/${lang}`;
				contributions.set(key, [
					...(contributions.get(key) ?? []),
					contribution,
				]);
			}
		}
	}
}

export async function scan(
	projects: string[],
	caches: ReadonlyMap<string, string> = new Map(),
	sourceLocale = "en",
): Promise<ScanResult> {
	const roots = findDocsRoots(projects);
	const contributions = new Map<string, Contribution[]>();
	const langs = new Set<string>();

	langs.add(sourceLocale);
	for (const { owner, path, sections } of roots) {
		for (const section of sections) {
			const contribution = await readContribution(owner, join(path, section));
			if (!contribution) continue;
			const key = `${section}/${sourceLocale}`;
			contributions.set(key, [...(contributions.get(key) ?? []), contribution]);
		}
	}

	for (const [project, cache] of caches) {
		await readCache(
			cache,
			basename(project),
			contributions,
			langs,
			sourceLocale,
		);
	}

	return { contributions, roots, langs: [...langs].sort() };
}
