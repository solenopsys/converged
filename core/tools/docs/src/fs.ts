import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/** Records what a run produced, so the manifest can prune what it did not. */
export class Writer {
	readonly written = new Set<string>();

	constructor(readonly dryRun = false) {}

	async write(path: string, content: string): Promise<void> {
		this.written.add(path);
		if (this.dryRun) return;
		mkdirSync(dirname(path), { recursive: true });
		await Bun.write(path, content);
	}

	async copy(path: string, source: string): Promise<void> {
		this.written.add(path);
		if (this.dryRun) return;
		mkdirSync(dirname(path), { recursive: true });
		await Bun.write(path, Bun.file(source));
	}

	/** For output a third party writes, such as a browser printing a PDF. */
	claim(path: string): void {
		this.written.add(path);
	}
}

/**
 * What the previous run wrote, per target.
 *
 * Pruning by pattern was the alternative, and it cannot work here: the doc tree
 * shares directories with hand-maintained content — `landing/`, `functions/`,
 * loose json — and a docs root can now be named anything, so no rule over names
 * separates our output from someone else's. A record of what this tool wrote is
 * the only thing that does.
 */
export class Manifest {
	private targets: Record<string, string[]> = {};

	private constructor(
		private readonly path: string,
		private readonly dryRun: boolean,
		/** Output roots: emptying one does not entitle us to delete it. */
		private readonly boundaries: string[],
	) {}

	static async load(
		dir: string,
		dryRun = false,
		boundaries: string[] = [],
	): Promise<Manifest> {
		const manifest = new Manifest(
			join(dir, ".docs-build.json"),
			dryRun,
			boundaries.map((path) => resolve(path)),
		);
		if (existsSync(manifest.path)) {
			manifest.targets = (await Bun.file(manifest.path).json()) as Record<
				string,
				string[]
			>;
		}
		return manifest;
	}

	private get dir(): string {
		return dirname(this.path);
	}

	/**
	 * Replaces a target's record and deletes what dropped out of it. Directories
	 * emptied by the deletions go too, up to the output root.
	 */
	prune(target: string, writer: Writer, enabled: boolean): string[] {
		const current = [...writer.written].sort();
		const previous = (this.targets[target] ?? []).map((path) =>
			resolve(this.dir, path),
		);
		this.targets[target] = current.map((path) => relative(this.dir, path));

		if (!enabled) return [];

		const kept = new Set(current);
		const removed: string[] = [];

		for (const path of previous) {
			if (kept.has(path) || !existsSync(path)) continue;
			removed.push(path);
			if (!this.dryRun) {
				rmSync(path, { force: true });
				removeEmptyParents(dirname(path), this.boundaries);
			}
		}

		return removed;
	}

	async save(): Promise<void> {
		if (this.dryRun) return;
		mkdirSync(this.dir, { recursive: true });
		await Bun.write(this.path, `${JSON.stringify(this.targets, null, 2)}\n`);
	}
}

/**
 * Walks up deleting directories that the deletion left empty, stopping at the
 * output roots — an empty `markdown/data` is still the store's own directory.
 */
function removeEmptyParents(dir: string, boundaries: string[]): void {
	let current = dir;
	for (let depth = 0; depth < 16; depth += 1) {
		if (
			boundaries.some(
				(root) => root === current || root.startsWith(`${current}/`),
			)
		) {
			return;
		}
		try {
			if (readdirSync(current).length > 0) return;
			// Verified empty just above, so recursion cannot take anything with it.
			rmSync(current, { recursive: true, force: true });
		} catch {
			return;
		}
		current = dirname(current);
	}
}
