/** Reading the trees, hashing what is in them, writing results without tearing. */

import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import type { FileEntry, FileKind, JsonValue } from "./types";

export function hashText(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

export function hashFile(path: string): string {
	return hashText(readFileSync(path, "utf8"));
}

export function readText(path: string): string {
	return readFileSync(path, "utf8");
}

export function readJsonFile(path: string): JsonValue {
	return JSON.parse(readFileSync(path, "utf8")) as JsonValue;
}

/** Rename over the target so a crash cannot leave half a state file behind. */
export function writeJsonAtomic(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.tmp`;
	writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
	renameSync(temporary, path);
}

export function writeTextAtomic(path: string, value: string): void {
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.tmp`;
	writeFileSync(temporary, value, "utf8");
	renameSync(temporary, path);
}

export function fileKind(path: string): FileKind {
	const extension = extname(path).toLowerCase();
	if (extension === ".json") return "json";
	if (extension === ".md" || extension === ".mdx") return "markdown";
	return "other";
}

export function walk(root: string, current = root): FileEntry[] {
	if (!existsSync(current)) return [];
	const entries: FileEntry[] = [];
	for (const entry of readdirSync(current, { withFileTypes: true })) {
		const abs = join(current, entry.name);
		if (entry.isDirectory()) {
			entries.push(...walk(root, abs));
			continue;
		}
		entries.push({
			abs,
			rel: relative(root, abs).split("\\").join("/"),
			type: fileKind(abs),
		});
	}
	return entries;
}

export function pathMatchesPrefix(path: string, prefix: string): boolean {
	const normalized = prefix.replace(/^\.\//, "").replace(/\/$/, "");
	return path === normalized || path.startsWith(`${normalized}/`);
}

export function selectFiles(
	entries: FileEntry[],
	include: string[] = [],
	exclude: string[] = [],
): FileEntry[] {
	return entries.filter((entry) => {
		const included =
			include.length === 0 ||
			include.some((prefix) => pathMatchesPrefix(entry.rel, prefix));
		const excluded = exclude.some((prefix) =>
			pathMatchesPrefix(entry.rel, prefix),
		);
		return included && !excluded;
	});
}
