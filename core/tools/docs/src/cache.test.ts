import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { syncCaches } from "./cache";
import { scan } from "./discover";
import type { Config, DocsRoot } from "./types";

let project: string;
let cache: string;

function write(path: string, content: string) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
}

function config(targetLocales = ["de", "ru"]): Config {
	return {
		root: project,
		projects: [project],
		content: "",
		out: {
			struct: "",
			markdown: "",
			static: "",
			readme: "",
			html: "",
			pdf: "",
		},
		sections: {},
		docsCaches: new Map([[project, cache]]),
		contentCache: "",
		docsPage: {},
		ecosystem: { landing: "landings/ecosystem", repos: {} },
		translation: {
			config: "",
			stateDir: "",
			sourceLocale: "en",
			targetLocales,
		},
	};
}

function root(): DocsRoot {
	return {
		owner: "project",
		path: join(project, "docs"),
		project,
		sections: ["guide"],
	};
}

function appRoot(owner: string): DocsRoot {
	return {
		owner,
		path: join(project, "core", "apps", owner, "docs"),
		project,
		sections: ["guide"],
	};
}

beforeEach(() => {
	project = mkdtempSync(join(tmpdir(), "docs-cache-"));
	cache = join(project, "content", "docs-cache");
	write(join(project, "docs", "guide", "index.json"), "[]\n");
	write(join(project, "docs", "guide", "intro.md"), "English v1\n");
});

afterEach(() => rmSync(project, { recursive: true, force: true }));

test("fills missing locales, advances fallbacks and preserves translations", async () => {
	expect(await syncCaches([root()], config())).toBe(6);
	expect(readFileSync(join(cache, "ru", "guide", "intro.md"), "utf8")).toBe(
		"English v1\n",
	);

	write(join(cache, "ru", "guide", "intro.md"), "Русский перевод\n");
	write(join(project, "docs", "guide", "intro.md"), "English v2\n");

	expect(await syncCaches([root()], config())).toBe(2);
	expect(readFileSync(join(cache, "en", "guide", "intro.md"), "utf8")).toBe(
		"English v2\n",
	);
	expect(readFileSync(join(cache, "de", "guide", "intro.md"), "utf8")).toBe(
		"English v2\n",
	);
	expect(readFileSync(join(cache, "ru", "guide", "intro.md"), "utf8")).toBe(
		"Русский перевод\n",
	);
	expect(await syncCaches([root()], config())).toBe(0);
});

test("namespaces additional owners in a shared section", async () => {
	const app = appRoot("runtime");
	write(join(app.path, "guide", "index.json"), "[]\n");
	write(join(app.path, "guide", "runtime.md"), "Runtime guide\n");

	expect(await syncCaches([root(), app], config())).toBe(12);
	expect(readFileSync(join(cache, "en", "guide", "intro.md"), "utf8")).toBe(
		"English v1\n",
	);
	expect(
		readFileSync(
			join(cache, "en", "guide", "runtime", "runtime.md"),
			"utf8",
		),
	).toBe("Runtime guide\n");

	const scanned = await scan([project], new Map([[project, cache]]));
	const translated = scanned.contributions.get("guide/ru") ?? [];
	expect(translated).toHaveLength(2);
	expect(translated.some((contribution) => contribution.module === "runtime")).toBe(
		true,
	);
});
