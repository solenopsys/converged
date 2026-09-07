/**
 * Source against target, for the two file types that have a shape worth
 * checking. Both produce the same `TreeDiff`, so the status rules and the
 * report never branch on file type.
 *
 * Structure is compared without values; text is compared only where a human
 * was supposed to change it. Those are separate passes on purpose — a
 * correctly translated file differs everywhere in text and nowhere in shape.
 */

import { isUntranslated, pathKey } from "./heuristics";
import { flattenStrings, flattenTree, treeHash } from "./json-tree";
import { type MarkdownBlock, outline, outlineHash } from "./markdown";
import type {
	JsonValue,
	LocaleMismatch,
	StringPair,
	TreeDiff,
	TypeChange,
	ValidationConfig,
} from "./types";

function sortDiff(diff: TreeDiff): TreeDiff {
	return {
		...diff,
		missing: [...diff.missing].sort(),
		extra: [...diff.extra].sort(),
		typeChanged: [...diff.typeChanged].sort((left, right) =>
			left.path.localeCompare(right.path),
		),
		unchangedStrings: [...diff.unchangedStrings].sort((left, right) =>
			left.path.localeCompare(right.path),
		),
		localeMismatches: [...diff.localeMismatches].sort((left, right) =>
			left.path.localeCompare(right.path),
		),
	};
}

export function compareJson(
	source: JsonValue,
	target: JsonValue,
	validation: ValidationConfig = {},
	targetLocale?: string,
): TreeDiff {
	const sourceTree = flattenTree(source);
	const targetTree = flattenTree(target);
	const missing: string[] = [];
	const extra: string[] = [];
	const typeChanged: TypeChange[] = [];

	for (const [path, sourceKind] of sourceTree) {
		const targetKind = targetTree.get(path);
		if (!targetKind) missing.push(path);
		else if (targetKind !== sourceKind) {
			typeChanged.push({ path, source: sourceKind, target: targetKind });
		}
	}
	for (const path of targetTree.keys()) {
		if (!sourceTree.has(path)) extra.push(path);
	}

	const unchangedStrings: StringPair[] = [];
	const localeMismatches: LocaleMismatch[] = [];
	const localeKeys = new Set(validation.localeKeys ?? []);
	const sourceStrings = flattenStrings(source);
	const targetStrings = flattenStrings(target);

	for (const [path, sourceText] of sourceStrings) {
		const targetText = targetStrings.get(path);
		if (targetText === undefined) continue;

		if (
			targetLocale &&
			localeKeys.has(pathKey(path)) &&
			targetText !== targetLocale
		) {
			localeMismatches.push({
				path,
				expected: targetLocale,
				target: targetText,
			});
		}
		if (
			isUntranslated(path, sourceText, targetText, validation, targetLocale)
		) {
			unchangedStrings.push({ path, source: sourceText, target: targetText });
		}
	}

	return sortDiff({
		missing,
		extra,
		typeChanged,
		unchangedStrings,
		localeMismatches,
		sourceHash: treeHash(sourceTree),
		targetHash: treeHash(targetTree),
	});
}

/**
 * Headings are matched by position rather than by text, because the text is
 * exactly what a translation changes. A target with fewer headings reports the
 * missing ones; a different level at the same position is a type change.
 */
export function compareMarkdown(
	source: MarkdownBlock[],
	target: MarkdownBlock[],
	validation: ValidationConfig = {},
	targetLocale?: string,
): TreeDiff {
	const sourceOutline = outline(source);
	const targetOutline = outline(target);
	const missing: string[] = [];
	const extra: string[] = [];
	const typeChanged: TypeChange[] = [];

	const headings = Math.max(sourceOutline.length, targetOutline.length);
	for (let index = 0; index < headings; index += 1) {
		const path = `/heading/${index}`;
		const from = sourceOutline[index];
		const to = targetOutline[index];
		if (from && !to) missing.push(path);
		else if (!from && to) extra.push(path);
		else if (from && to && from !== to) {
			typeChanged.push({ path, source: from, target: to });
		}
	}

	// Blocks line up positionally too. Where they do not — because structure
	// already drifted — the structure diff above is the finding that matters,
	// and comparing misaligned prose would only add noise.
	const unchangedStrings: StringPair[] = [];
	const blocks = Math.min(source.length, target.length);
	for (let index = 0; index < blocks; index += 1) {
		const from = source[index];
		const to = target[index];
		if (!from || !to || from.kind !== to.kind) continue;
		const path = `${from.kind === "heading" ? "/heading" : "/block"}/${index}`;
		if (isUntranslated(path, from.text, to.text, validation, targetLocale)) {
			unchangedStrings.push({ path, source: from.text, target: to.text });
		}
	}

	return sortDiff({
		missing,
		extra,
		typeChanged,
		unchangedStrings,
		localeMismatches: [],
		sourceHash: outlineHash(source),
		targetHash: outlineHash(target),
	});
}
