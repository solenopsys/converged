/**
 * A JSON document reduced to its shape.
 *
 * Comparing values would flag every translated string as a difference, so the
 * tree carries paths and node kinds only. Strings are extracted separately,
 * keyed by the same paths, for the checks that do care about text.
 *
 * Paths are JSON-Pointer-escaped (`~0` for `~`, `~1` for `/`) so a key
 * containing a slash cannot forge a path.
 */

import { hashText, readJsonFile } from "./fs";
import type { JsonValue, NodeKind } from "./types";

export function nodeKind(value: JsonValue): NodeKind {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	if (typeof value === "object") return "object";
	return typeof value as "string" | "number" | "boolean";
}

export function childPath(parent: string, key: string | number): string {
	const escaped = String(key).replaceAll("~", "~0").replaceAll("/", "~1");
	return `${parent}/${escaped}`;
}

export function flattenTree(
	value: JsonValue,
	path = "",
): Map<string, NodeKind> {
	const result = new Map<string, NodeKind>();
	result.set(path || "/", nodeKind(value));

	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			for (const [child, kind] of flattenTree(item, childPath(path, index))) {
				result.set(child, kind);
			}
		});
	} else if (value !== null && typeof value === "object") {
		for (const key of Object.keys(value).sort()) {
			for (const [child, kind] of flattenTree(
				value[key] as JsonValue,
				childPath(path, key),
			)) {
				result.set(child, kind);
			}
		}
	}

	return result;
}

/** Sorted before hashing, so key order in the file cannot change the hash. */
export function treeHash(tree: Map<string, NodeKind>): string {
	return hashText(
		[...tree.entries()]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([path, kind]) => `${path}\t${kind}`)
			.join("\n"),
	);
}

export function flattenStrings(
	value: JsonValue,
	path = "",
	result = new Map<string, string>(),
): Map<string, string> {
	if (typeof value === "string") {
		result.set(path || "/", value);
		return result;
	}
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			flattenStrings(item, childPath(path, index), result);
		});
	} else if (value !== null && typeof value === "object") {
		for (const key of Object.keys(value)) {
			flattenStrings(value[key] as JsonValue, childPath(path, key), result);
		}
	}
	return result;
}

export function readTree(path: string): {
	value?: JsonValue;
	hash?: string;
	error?: string;
} {
	try {
		const value = readJsonFile(path);
		return { value, hash: treeHash(flattenTree(value)) };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}
