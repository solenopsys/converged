/**
 * Where the files are — the half of the index the JSON nodes never had.
 *
 * A content-addressed link answers "is this translation current". It cannot
 * answer "which translations belong to `product/`", because a hash has no
 * location. Recording placement gives folder-shaped questions a query:
 * invalidation, per-folder statistics and orphan hunting all read from here
 * instead of walking the tree again.
 *
 * Placement is a projection of the last scan and is rewritten wholesale per
 * project. The links are not: they are durable evidence and survive rescans.
 */

import type { TranslationStore } from "./store";
import type { ProjectConfig, ProjectSnapshot, TargetStatus } from "./types";

export function dirOf(rel: string): string {
	const cut = rel.lastIndexOf("/");
	return cut === -1 ? "" : rel.slice(0, cut);
}

/** `a/b/c` is inside `a/b` and inside `a`, but `a/bc` is inside neither. */
function underPrefix(dir: string, prefix: string): boolean {
	if (prefix === "") return true;
	return dir === prefix || dir.startsWith(`${prefix}/`);
}

export function recordProject(
	store: TranslationStore,
	config: ProjectConfig,
	snapshot: ProjectSnapshot,
): void {
	const { db } = store;
	const now = new Date().toISOString();

	db.transaction(() => {
		db.query(
			"INSERT INTO project (name, root, target_root, source_locale, scanned_at) VALUES (?, ?, ?, ?, ?) " +
				"ON CONFLICT(name) DO UPDATE SET root = excluded.root, target_root = excluded.target_root, " +
				"source_locale = excluded.source_locale, scanned_at = excluded.scanned_at",
		).run(
			config.name,
			snapshot.root,
			snapshot.targetRoot,
			snapshot.sourceLocale,
			now,
		);
		const projectId = db
			.query<{ id: number }, [string]>("SELECT id FROM project WHERE name = ?")
			.get(config.name)?.id as number;

		// A project's placement is only ever true as a whole: a file the scan
		// no longer sees has to leave, or a deleted document keeps showing up
		// in the volume table forever.
		db.query("DELETE FROM source_file WHERE project_id = ?").run(projectId);
		db.query("DELETE FROM target_file WHERE project_id = ?").run(projectId);

		const insertSource = db.query(
			"INSERT INTO source_file (project_id, rel, dir, kind, bytes, mtime_ms, source_hash, seen_at) " +
				"VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		);
		const insertTarget = db.query(
			"INSERT INTO target_file (project_id, rel, dir, locale, present, bytes, source_hash, target_hash, status, reasons, seen_at) " +
				"VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		);

		for (const [rel, file] of Object.entries(snapshot.files)) {
			const dir = dirOf(rel);
			insertSource.run(
				projectId,
				rel,
				dir,
				file.fileType,
				file.bytes ?? 0,
				file.mtimeMs ?? 0,
				file.sourceHash,
				now,
			);
			for (const [locale, target] of Object.entries(file.targets)) {
				insertTarget.run(
					projectId,
					rel,
					dir,
					locale,
					target.exists ? 1 : 0,
					target.bytes ?? 0,
					file.sourceHash,
					target.hash,
					target.status,
					target.reasons.join(", "),
					now,
				);
			}
		}
	})();
}

/**
 * The last scan of this project, rebuilt from placement.
 *
 * The scanner takes "what did I conclude last time" as evidence: it is what
 * separates *untracked* from *ok*, and what lets a settled target skip the
 * shape comparison. That evidence used to come from a state file nobody
 * wrote, so every run started blind and every target came back `untracked`.
 * The placement tables are that state, and they are written on every scan.
 */
export function previousSnapshot(
	store: TranslationStore,
	project: string,
): ProjectSnapshot | undefined {
	const row = store.db
		.query<
			{ id: number; root: string; target_root: string; source_locale: string },
			[string]
		>("SELECT id, root, target_root, source_locale FROM project WHERE name = ?")
		.get(project);
	if (!row) return undefined;

	const files: ProjectSnapshot["files"] = {};
	for (const source of store.db
		.query<{ rel: string; kind: string; source_hash: string }, [number]>(
			"SELECT rel, kind, source_hash FROM source_file WHERE project_id = ?",
		)
		.all(row.id)) {
		files[source.rel] = {
			fileType: source.kind as ProjectSnapshot["files"][string]["fileType"],
			sourceHash: source.source_hash,
			targets: {},
		};
	}
	for (const target of store.db
		.query<
			{
				rel: string;
				locale: string;
				present: number;
				target_hash: string;
				status: string;
				reasons: string;
			},
			[number]
		>(
			"SELECT rel, locale, present, target_hash, status, reasons FROM target_file WHERE project_id = ?",
		)
		.all(row.id)) {
		const file = files[target.rel];
		if (!file) continue;
		file.targets[target.locale] = {
			exists: target.present === 1,
			hash: target.target_hash,
			status: target.status as TargetStatus,
			reasons: target.reasons ? target.reasons.split(", ") : [],
		};
	}

	return {
		root: row.root,
		targetRoot: row.target_root,
		sourceLocale: row.source_locale,
		targetLocales: [
			...new Set(
				Object.values(files).flatMap((file) => Object.keys(file.targets)),
			),
		].sort(),
		files,
		orphans: {},
		routes: [],
	};
}

export type InvalidateResult = {
	sources: number;
	links: number;
	locales: string[];
};

/**
 * Forget the translations of everything under one folder, so the next `-t`
 * run retranslates it.
 *
 * The unit is the source hash, not the file: two files with identical content
 * share one link, and dropping it for one path necessarily drops it for the
 * other. That is the same rule the store has always followed; making it
 * visible here is better than pretending a per-path invalidation exists.
 */
export function invalidateFolder(
	store: TranslationStore,
	prefix: string,
	options: { project?: string; locale?: string } = {},
): InvalidateResult {
	const { db } = store;
	const normalized = prefix.replace(/^\.?\/+/, "").replace(/\/+$/, "");

	const rows = db
		.query<{ source_hash: string; dir: string }, []>(
			"SELECT DISTINCT s.source_hash AS source_hash, s.dir AS dir FROM source_file s JOIN project p ON p.id = s.project_id" +
				(options.project ? " WHERE p.name = ?" : ""),
		)
		.all(...((options.project ? [options.project] : []) as []));

	const hashes = [
		...new Set(
			rows
				.filter((row) => underPrefix(row.dir, normalized))
				.map((row) => row.source_hash),
		),
	];
	if (hashes.length === 0) return { sources: 0, links: 0, locales: [] };

	const placeholders = hashes.map(() => "?").join(", ");
	const where = `source_hash IN (${placeholders})${options.locale ? " AND locale = ?" : ""}`;
	const params = options.locale ? [...hashes, options.locale] : hashes;

	const locales = db
		.query<{ locale: string }, string[]>(
			`SELECT DISTINCT locale FROM translation WHERE ${where} ORDER BY locale`,
		)
		.all(...params)
		.map((row) => row.locale);

	const result = db
		.query(`DELETE FROM translation WHERE ${where}`)
		.run(...params);
	if (result.changes > 0) store.markDirty();

	return { sources: hashes.length, links: result.changes, locales };
}

/** Folders a project actually has, for `--invalidate` autocompletion and errors. */
export function folders(store: TranslationStore, project?: string): string[] {
	return store.db
		.query<{ dir: string }, []>(
			"SELECT DISTINCT s.dir AS dir FROM source_file s JOIN project p ON p.id = s.project_id" +
				(project ? " WHERE p.name = ?" : "") +
				" ORDER BY dir",
		)
		.all(...((project ? [project] : []) as []))
		.map((row) => row.dir)
		.filter(Boolean);
}
