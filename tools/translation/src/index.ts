export { compareJson, compareMarkdown } from "./compare";
export { readConfig, readState } from "./config";
export { closeIndex, INDEX_FILE, openIndex, SCHEMA_VERSION } from "./db";
export {
	fileKind,
	hashFile,
	hashText,
	pathMatchesPrefix,
	selectFiles,
	walk,
	writeJsonAtomic,
	writeTextAtomic,
} from "./fs";
export { directHasher, type Hasher, sqliteHasher } from "./hashcache";
export {
	isShortTranslatableString,
	isTechnicalString,
	isUntranslated,
	matchesScript,
	normalizeText,
	pathKey,
} from "./heuristics";
export {
	childPath,
	flattenStrings,
	flattenTree,
	nodeKind,
	readTree,
	treeHash,
} from "./json-tree";
export {
	type MarkdownBlock,
	outline,
	outlineHash,
	parseMarkdown,
} from "./markdown";
export {
	dirOf,
	folders,
	type InvalidateResult,
	invalidateFolder,
	previousSnapshot,
	recordProject,
} from "./placement";
export {
	configuredConcurrency,
	DEFAULT_CONCURRENCY,
	HttpError,
	pool,
	withRetry,
} from "./pool";
export {
	type ProviderName,
	type ResolvedProvider,
	resolveProvider,
} from "./providers";
export {
	buildQueue,
	chunks,
	type Job,
	JSON_STRING_LEVEL_THRESHOLD,
	needsTranslation,
	type Route,
	routeFor,
} from "./queue";
export { type ReindexSummary, rebuildIndex } from "./reindex";
export { displayDiff, reportForProject } from "./report";
export { countIssues, projectRoot, scanProject } from "./scan";
export {
	beginRun,
	finishRun,
	type RunHandle,
	recentRuns,
	recordItem,
	renderRuns,
	renderVolume,
	type Volume,
	volume,
} from "./stats";
export { type Evidence, statusFor } from "./status";
export {
	type StoreVerdict,
	type TranslationRecord,
	TranslationStore,
} from "./store";
export {
	emptyTally,
	type Tally,
	type TranslateOptions,
	translateProject,
} from "./translate";
export type * from "./types";
