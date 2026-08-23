import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	fileKind,
	hashText,
	pathMatchesPrefix,
	selectFiles,
	walk,
	writeJsonAtomic,
} from "./fs";
import { flattenStrings, flattenTree, treeHash } from "./json-tree";
import { outline, parseMarkdown } from "./markdown";

let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "translation-fs-"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

function write(rel: string, content = "x"): void {
	const path = join(root, rel);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
}

describe("fileKind", () => {
	test("json, markdown and everything else", () => {
		expect(fileKind("a/b.json")).toBe("json");
		expect(fileKind("a/b.md")).toBe("markdown");
		expect(fileKind("a/b.MDX")).toBe("markdown");
		expect(fileKind("a/b.txt")).toBe("other");
	});
});

describe("walk", () => {
	test("finds files at any depth with paths relative to the root", () => {
		write("a.md");
		write("deep/nested/b.json");

		expect(
			walk(root)
				.map((entry) => entry.rel)
				.sort(),
		).toEqual(["a.md", "deep/nested/b.json"]);
	});

	test("a missing root yields nothing rather than throwing", () => {
		expect(walk(join(root, "absent"))).toEqual([]);
	});
});

describe("selectFiles", () => {
	test("no include means everything", () => {
		write("a.md");
		write("b/c.md");
		expect(selectFiles(walk(root))).toHaveLength(2);
	});

	test("include keeps only matching prefixes", () => {
		write("keep/a.md");
		write("skip/b.md");
		expect(selectFiles(walk(root), ["keep"]).map((f) => f.rel)).toEqual([
			"keep/a.md",
		]);
	});

	test("exclude wins over include", () => {
		write("keep/a.md");
		write("keep/inner/b.md");
		expect(
			selectFiles(walk(root), ["keep"], ["keep/inner"]).map((f) => f.rel),
		).toEqual(["keep/a.md"]);
	});
});

describe("pathMatchesPrefix", () => {
	test("matches a whole segment, never a partial name", () => {
		expect(pathMatchesPrefix("club/a.json", "club")).toBe(true);
		expect(pathMatchesPrefix("club", "club")).toBe(true);
		expect(pathMatchesPrefix("clubhouse/a.json", "club")).toBe(false);
	});

	test("tolerates ./ and trailing slashes in the prefix", () => {
		expect(pathMatchesPrefix("club/a.json", "./club/")).toBe(true);
	});
});

describe("writeJsonAtomic", () => {
	test("creates parents and leaves no temporary behind", () => {
		const path = join(root, "deep/state.json");
		writeJsonAtomic(path, { a: 1 });

		expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ a: 1 });
		expect(walk(root).map((entry) => entry.rel)).toEqual(["deep/state.json"]);
	});
});

describe("hashing", () => {
	test("is stable and content-sensitive", () => {
		expect(hashText("a")).toBe(hashText("a"));
		expect(hashText("a")).not.toBe(hashText("b"));
	});
});

describe("flattenTree", () => {
	test("records every path with its kind", () => {
		expect([...flattenTree({ a: [1, null] })]).toEqual([
			["/", "object"],
			["/a", "array"],
			["/a/0", "number"],
			["/a/1", "null"],
		]);
	});

	test("treeHash ignores key order but not shape", () => {
		expect(treeHash(flattenTree({ a: 1, b: 2 }))).toBe(
			treeHash(flattenTree({ b: 2, a: 1 })),
		);
		expect(treeHash(flattenTree({ a: 1 }))).not.toBe(
			treeHash(flattenTree({ a: "1" })),
		);
	});
});

describe("flattenStrings", () => {
	test("collects only strings, keyed by the same paths", () => {
		expect([...flattenStrings({ a: "x", b: 1, c: ["y"] })]).toEqual([
			["/a", "x"],
			["/c/0", "y"],
		]);
	});
});

describe("parseMarkdown", () => {
	test("separates headings from prose and drops fenced code", () => {
		const blocks = parseMarkdown(
			"# Title\n\nOne two.\n\n```js\ncode();\n```\n\n## Sub\n",
		);
		expect(blocks.map((block) => block.kind)).toEqual([
			"heading",
			"text",
			"heading",
		]);
		expect(outline(blocks)).toEqual(["h1", "h2"]);
	});

	test("joins wrapped lines into one paragraph", () => {
		const blocks = parseMarkdown("Line one\nline two.\n\nNext.\n");
		expect(blocks.map((block) => block.text)).toEqual([
			"Line one line two.",
			"Next.",
		]);
	});

	test("a document with no headings has an empty outline", () => {
		expect(outline(parseMarkdown("Just prose.\n"))).toEqual([]);
	});
});
