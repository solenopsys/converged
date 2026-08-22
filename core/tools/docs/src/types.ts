/**
 * The shape of documentation as it travels through this tool.
 *
 * Authoring happens next to the code: any directory that keeps a
 * `docs/<lang>/<section>/index.json` plus the markdown files it lists is a
 * source, wherever it sits in the tree. The index format is deliberately the
 * same array of `{slug, title, order, id}` that `struct-ms` serves, so an
 * owner's index can be read as-is by anyone who already knows the site's.
 *
 * A section is a site-level chapter (`product`, `club`, ...) and more than one
 * owner may contribute to it; merging those contributions is this tool's job.
 */

/** One entry as written in a module's `index.json`. */
export type IndexEntry = {
	slug: string;
	title: string;
	/** Sort key inside the contributing module. Missing means "keep file order". */
	order?: number;
	/** Markdown basename without `.md`. Defaults to `slug`. */
	id?: string;
};

/** Optional `docs/<lang>/<section>/meta.json` next to the index. */
export type ContributionMeta = {
	/** Heading this owner's docs get when a section has several contributors. */
	group?: string;
};

/** One resolved document, with its markdown located on disk. */
export type Doc = {
	slug: string;
	title: string;
	order: number;
	/** Absolute path of the source markdown file. */
	source: string;
	/** Owner that contributed the doc, e.g. `mf-docs`. */
	module: string;
};

/** Everything one owner says about one section in one language. */
export type Contribution = {
	module: string;
	/** Heading for this block when the section is emitted as a compound index. */
	group: string;
	/** Absolute path of the owner's `index.json`, for error messages. */
	indexPath: string;
	docs: Doc[];
};

/** A section in a single language: the unit every emitter renders. */
export type Book = {
	section: string;
	lang: string;
	/** Human title from config, falling back to the section name. */
	title: string;
	contributions: Contribution[];
	/** All docs, ordered, across contributions. */
	docs: Doc[];
	/** True when several owners contribute and grouping must be preserved. */
	compound: boolean;
};

export type OutputPaths = {
	struct: string;
	markdown: string;
	readme: string;
	html: string;
	pdf: string;
};

/** How the docs sources are handed to `translation-control`. */
export type TranslationConfig = {
	/** Path of the generated translation-control config. */
	config: string;
	/** Directory for that tool's per-project state and report files. */
	stateDir: string;
	sourceLocale: string;
	/** Empty means "every language found in the sources". */
	targetLocales: string[];
};

export type SectionConfig = {
	/** Per-language display title. */
	title?: Record<string, string>;
	/** Force a compound (grouped) index even with a single contributor. */
	compound?: boolean;
};

export type Config = {
	/** Absolute path the relative entries below were resolved against. */
	root: string;
	/** Project roots scanned for modules, absolute. */
	projects: string[];
	out: OutputPaths;
	sections: Record<string, SectionConfig>;
	translation: TranslationConfig;
};

/** One discovered `docs` directory. */
export type DocsRoot = {
	/** Name this root contributes under; unique across a scan. */
	owner: string;
	/** Absolute path of the `docs` directory. */
	path: string;
	/** Project root it was found in. */
	project: string;
	/** Languages this root ships. */
	langs: string[];
};

/** What a scan found, beyond the books themselves. */
export type ScanSummary = {
	roots: DocsRoot[];
	/** Every language any root ships. */
	langs: string[];
};
