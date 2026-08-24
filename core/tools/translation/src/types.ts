/**
 * What this tool knows about a translation, and where each fact comes from.
 *
 * Two records with deliberately different lifecycles:
 *
 * - the **state** is a snapshot of the last scan. It answers "what changed
 *   since I last looked", and every scan overwrites it.
 * - the **ledger** records translation events. It answers "what changed since
 *   this was translated", and only `--record` writes it.
 *
 * Keeping them apart is the whole point. A status derived from the state
 * survives exactly one scan — the scan that reports it also updates the
 * baseline it was measured against. A status derived from the ledger survives
 * until somebody actually translates the file.
 */

export type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

export type NodeKind =
	| "object"
	| "array"
	| "string"
	| "number"
	| "boolean"
	| "null";

/** Files are compared structurally; how depends on what they are. */
export type FileKind = "json" | "markdown" | "other";

export type ValidationConfig = {
	minUnchangedStringLength?: number;
	shortUnchangedStringKeys?: string[];
	ignoreStringPaths?: string[];
	sameTextScriptByLocale?: Record<string, "cyrillic" | "latin">;
	localeKeys?: string[];
};

export type ProjectConfig = {
	name: string;
	/** Root holding the source locale. */
	root: string;
	/**
	 * Root holding translated locales. Omit it when sources and translations
	 * share one tree; documentation keeps translations in docs-cache instead.
	 */
	targetRoot?: string;
	/** Directory inside each target locale, before the translated source path. */
	targetPrefix?: string;
	/** Source-relative prefix removed before applying `targetPrefix`. */
	targetStripPrefix?: string;
	sourceLocale: string;
	targetLocales: string[];
	routes?: Array<{ path: string; config: string }>;
	include?: string[];
	exclude?: string[];
	validation?: ValidationConfig;
	stateFile?: string;
	reportFile?: string;
	/** Translation ledger; defaults to `./translation-ledger.json`. */
	ledgerFile?: string;
};

export type ControlConfig = {
	projects: ProjectConfig[];
};

/**
 * A shape difference at one path. Values are `NodeKind` for JSON and heading
 * levels (`h2`) for markdown, so the field is a plain string and both
 * comparisons feed the same report.
 */
export type TypeChange = { path: string; source: string; target: string };
export type StringPair = { path: string; source: string; target: string };
export type LocaleMismatch = {
	path: string;
	expected: string;
	target: string;
};

export type TreeDiff = {
	missing: string[];
	extra: string[];
	typeChanged: TypeChange[];
	unchangedStrings: StringPair[];
	localeMismatches: LocaleMismatch[];
	sourceHash: string;
	targetHash: string;
};

/**
 * Ordered most specific first: a file with drifted structure is reported as
 * drifted even though it is also stale, because the structure is what the
 * reader has to fix.
 */
export type TargetStatus =
	| "ok"
	| "untracked"
	| "missing"
	| "stale"
	| "unrecorded"
	| "source-changed"
	| "target-modified"
	| "structure-drift"
	| "untranslated-text"
	| "invalid-json";

export type TargetSnapshot = {
	exists: boolean;
	hash: string;
	structureHash?: string;
	/** Source hash this translation was made from, per the ledger. */
	translatedFromHash?: string;
	status: TargetStatus;
	reasons: string[];
	diff?: TreeDiff;
};

export type FileSnapshot = {
	fileType: FileKind;
	sourceHash: string;
	sourceStructureHash?: string;
	targets: Record<string, TargetSnapshot>;
};

export type RouteSnapshot = {
	path: string;
	config: string;
	locale: string;
	status: "ok" | "missing" | "structure-drift";
	missing: string[];
	extra: string[];
	typeChanged: TypeChange[];
};

export type ProjectSnapshot = {
	root: string;
	targetRoot: string;
	sourceLocale: string;
	targetLocales: string[];
	files: Record<string, FileSnapshot>;
	orphans: Record<string, string[]>;
	routes: RouteSnapshot[];
};

export type ControlState = {
	version: 1;
	updatedAt: string;
	projects: Record<string, ProjectSnapshot>;
};

/** One recorded translation event. */
export type LedgerEntry = {
	/** Hash of the source text the translation was made from. */
	translatedFromHash: string;
	/** Hash of the translation as recorded, to detect later hand edits. */
	translationHash: string;
	translatedAt: string;
};

export type LedgerProject = {
	/** `<rel path>` → `<locale>` → entry. */
	files: Record<string, Record<string, LedgerEntry>>;
};

export type TranslationLedger = {
	version: 1;
	updatedAt: string;
	projects: Record<string, LedgerProject>;
};

export type ReportFile = {
	file: string;
	locale: string;
	status: TargetStatus;
	reasons: string[];
	structure: Pick<TreeDiff, "missing" | "extra" | "typeChanged">;
	unchangedStrings: StringPair[];
	localeMismatches: LocaleMismatch[];
};

export type ReportProject = {
	name: string;
	root: string;
	sourceLocale: string;
	targetLocales: string[];
	issues: number;
	files: ReportFile[];
	orphans: Record<string, string[]>;
	routes: RouteSnapshot[];
};

export type TranslationReport = {
	version: 1;
	generatedAt: string;
	projects: ReportProject[];
};

export type FileEntry = {
	abs: string;
	rel: string;
	type: FileKind;
};
