export { compareJson, compareMarkdown } from "./compare";
export { readConfig, readState } from "./config";
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
export { type ReindexSummary, rebuildIndex } from "./reindex";
export { displayDiff, reportForProject } from "./report";
export { countIssues, projectRoot, scanProject } from "./scan";
export { type Evidence, statusFor } from "./status";
export {
	type StoreVerdict,
	type TranslationRecord,
	TranslationStore,
} from "./store";
export type * from "./types";
